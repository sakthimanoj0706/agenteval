"""
Agent Execution and Run Management Router.
Single query execution, dataset batch execution, run inspection, and trace viewing.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import AgentRun, ExecutionTrace, RetrievedChunk, ToolCall, EvaluationResult, DocumentChunk, Document, TestCase, EvaluationDataset
from app.schemas.schemas import AgentExecuteRequest, ExecuteDatasetRequest, AgentRunResponse, ExecutionTraceResponse, RetrievedChunkResponse
from app.services.agent.executor import AgentExecutor
from app.services.eval.evaluator import EvaluationEngine

router = APIRouter(prefix="/api/agent", tags=["Agent Execution"])


@router.post("/execute", response_model=AgentRunResponse, status_code=status.HTTP_200_OK)
def execute_query(req: AgentExecuteRequest, db: Session = Depends(get_db)):
    executor = AgentExecutor(
        db=db,
        project_id=req.project_id,
        model_name=req.model_name or "mock-model",
        model_provider=req.model_provider or "mock",
        prompt_version_id=req.prompt_version_id,
        dataset_id=req.dataset_id,
        test_case_id=req.test_case_id,
        chunk_size=req.chunk_size or 512,
        chunk_overlap=req.chunk_overlap or 50,
        top_k=req.top_k or 5,
        similarity_threshold=req.similarity_threshold or 0.2,
        tools_enabled=req.tools_enabled,
    )

    run = executor.execute(req.query)

    # Automatically run available deterministic evaluations
    try:
        EvaluationEngine.evaluate_run(db, run.id)
    except Exception:
        pass

    return get_full_run_response(run.id, db)


@router.post("/execute-dataset")
def execute_dataset(req: ExecuteDatasetRequest, db: Session = Depends(get_db)):
    ds = db.query(EvaluationDataset).filter(EvaluationDataset.id == req.dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    test_cases = db.query(TestCase).filter(TestCase.dataset_id == req.dataset_id).all()
    if not test_cases:
        raise HTTPException(status_code=400, detail="The dataset has no test cases to execute.")

    results = []
    for tc in test_cases:
        executor = AgentExecutor(
            db=db,
            project_id=req.project_id,
            model_name=req.model_name or "mock-model",
            model_provider=req.model_provider or "mock",
            dataset_id=req.dataset_id,
            test_case_id=tc.id,
            top_k=req.top_k or 5,
            similarity_threshold=req.similarity_threshold or 0.2,
        )
        run = executor.execute(tc.query)
        try:
            EvaluationEngine.evaluate_run(db, run.id)
        except Exception:
            pass
        results.append({
            "test_case_id": tc.id,
            "run_id": run.run_id,
            "status": run.status,
            "latency_ms": run.total_latency_ms,
        })

    return {
        "status": "completed",
        "dataset_id": req.dataset_id,
        "executed_count": len(results),
        "runs": results
    }


@router.get("/runs", response_model=List[AgentRunResponse])
def list_runs(
    project_id: Optional[int] = None,
    dataset_id: Optional[int] = None,
    status: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db)
):
    query = db.query(AgentRun)
    if project_id:
        query = query.filter(AgentRun.project_id == project_id)
    if dataset_id:
        query = query.filter(AgentRun.dataset_id == dataset_id)
    if status:
        query = query.filter(AgentRun.status == status)

    runs = query.order_by(AgentRun.created_at.desc()).offset(offset).limit(limit).all()
    return [get_full_run_response(r.id, db) for r in runs]


@router.get("/runs/{run_identifier}", response_model=AgentRunResponse)
def get_run(run_identifier: str, db: Session = Depends(get_db)):
    # Match on integer ID or UUID string
    if run_identifier.isdigit():
        run = db.query(AgentRun).filter(AgentRun.id == int(run_identifier)).first()
    else:
        run = db.query(AgentRun).filter(AgentRun.run_id == run_identifier).first()

    if not run:
        raise HTTPException(status_code=404, detail="Agent run not found.")

    return get_full_run_response(run.id, db)


@router.get("/runs/{run_identifier}/trace", response_model=List[ExecutionTraceResponse])
def get_run_trace(run_identifier: str, db: Session = Depends(get_db)):
    if run_identifier.isdigit():
        run = db.query(AgentRun).filter(AgentRun.id == int(run_identifier)).first()
    else:
        run = db.query(AgentRun).filter(AgentRun.run_id == run_identifier).first()

    if not run:
        raise HTTPException(status_code=404, detail="Agent run not found.")

    return (
        db.query(ExecutionTrace)
        .filter(ExecutionTrace.agent_run_id == run.id)
        .order_by(ExecutionTrace.step_index.asc())
        .all()
    )


def get_full_run_response(run_id: int, db: Session) -> AgentRunResponse:
    run = db.query(AgentRun).filter(AgentRun.id == run_id).first()
    traces = db.query(ExecutionTrace).filter(ExecutionTrace.agent_run_id == run_id).order_by(ExecutionTrace.step_index.asc()).all()
    tool_calls = db.query(ToolCall).filter(ToolCall.agent_run_id == run_id).all()
    eval_results = db.query(EvaluationResult).filter(EvaluationResult.agent_run_id == run_id).all()

    retrieved = db.query(RetrievedChunk).filter(RetrievedChunk.agent_run_id == run_id).order_by(RetrievedChunk.rank_position.asc()).all()
    retrieved_responses = []
    for r in retrieved:
        chunk = db.query(DocumentChunk).filter(DocumentChunk.id == r.chunk_id).first()
        doc_name = None
        if chunk:
            doc = db.query(Document).filter(Document.id == chunk.document_id).first()
            doc_name = doc.filename if doc else None

        retrieved_responses.append(RetrievedChunkResponse(
            id=r.id,
            chunk_id=r.chunk_id,
            similarity_score=r.similarity_score,
            rank_position=r.rank_position,
            content=chunk.content if chunk else None,
            document_name=doc_name
        ))

    resp = AgentRunResponse.from_orm(run)
    resp.traces = traces
    resp.tool_calls = tool_calls
    resp.retrieved_chunks = retrieved_responses
    resp.evaluation_results = eval_results
    return resp
