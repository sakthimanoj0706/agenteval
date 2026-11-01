"""
Evaluation Router.
Triggers evaluation runs, retrieves evaluation metrics, and handles human review annotations.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import AgentRun, EvaluationResult, EvaluationDataset
from app.schemas.schemas import EvaluationResultResponse, HumanReviewRequest, MetricsSummaryResponse
from app.services.eval.evaluator import EvaluationEngine

router = APIRouter(prefix="/api/evaluation", tags=["Evaluation Engine"])


@router.post("/run/{run_id}", response_model=List[EvaluationResultResponse])
def evaluate_agent_run(run_id: int, db: Session = Depends(get_db)):
    run = db.query(AgentRun).filter(AgentRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Agent run not found.")

    results = EvaluationEngine.evaluate_run(db, run.id)
    return results


@router.post("/dataset/{dataset_id}")
def evaluate_dataset_runs(dataset_id: int, db: Session = Depends(get_db)):
    ds = db.query(EvaluationDataset).filter(EvaluationDataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    runs = db.query(AgentRun).filter(AgentRun.dataset_id == dataset_id).all()
    if not runs:
        raise HTTPException(status_code=400, detail="No runs found for this dataset.")

    evaluated_count = 0
    for r in runs:
        try:
            EvaluationEngine.evaluate_run(db, r.id)
            evaluated_count += 1
        except Exception:
            pass

    return {
        "status": "completed",
        "dataset_id": dataset_id,
        "runs_evaluated": evaluated_count,
        "total_runs": len(runs)
    }


@router.get("/results/{run_id}", response_model=List[EvaluationResultResponse])
def get_evaluation_results(run_id: int, db: Session = Depends(get_db)):
    return db.query(EvaluationResult).filter(EvaluationResult.agent_run_id == run_id).all()


@router.post("/human-review", response_model=EvaluationResultResponse)
def submit_human_review(req: HumanReviewRequest, db: Session = Depends(get_db)):
    run = db.query(AgentRun).filter(AgentRun.id == req.agent_run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Agent run not found.")

    res = EvaluationResult(
        agent_run_id=run.id,
        eval_type="answer",
        metric_name="human_reviewed_faithfulness",
        metric_value=req.faithfulness_score,
        evaluation_method="human",
        details=req.notes,
        is_evaluated=True,
    )
    db.add(res)
    db.commit()
    db.refresh(res)
    return res


@router.get("/metrics/summary", response_model=MetricsSummaryResponse)
def get_metrics_summary(project_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(AgentRun)
    if project_id:
        query = query.filter(AgentRun.project_id == project_id)
    runs = query.all()

    total_runs = len(runs)
    if total_runs == 0:
        return MetricsSummaryResponse()

    run_ids = [r.id for r in runs]
    evals = db.query(EvaluationResult).filter(
        EvaluationResult.agent_run_id.in_(run_ids),
        EvaluationResult.is_evaluated == True,
        EvaluationResult.metric_value.isnot(None)
    ).all()

    def avg_metric(name: str) -> Optional[float]:
        vals = [e.metric_value for e in evals if e.metric_name == name and e.metric_value is not None]
        return round(sum(vals) / len(vals), 4) if vals else None

    # Latencies
    total_lats = [r.total_latency_ms for r in runs if r.total_latency_ms]
    ret_lats = [r.retrieval_latency_ms for r in runs if r.retrieval_latency_ms]
    gen_lats = [r.generation_latency_ms for r in runs if r.generation_latency_ms]

    total_tokens = sum((r.token_usage_prompt or 0) + (r.token_usage_completion or 0) for r in runs)
    failed_count = sum(1 for r in runs if r.status == "failed")

    task_comp = avg_metric("task_completion")
    if task_comp is None:
        completed = sum(1 for r in runs if r.status == "completed")
        task_comp = round(completed / total_runs, 4) if total_runs else 0.0

    return MetricsSummaryResponse(
        total_runs=total_runs,
        avg_faithfulness=avg_metric("faithfulness"),
        avg_answer_relevance=avg_metric("answer_relevance"),
        avg_context_relevance=avg_metric("context_relevance"),
        avg_recall_at_k=avg_metric("recall_at_k"),
        task_completion_rate=task_comp,
        avg_total_latency_ms=round(sum(total_lats) / len(total_lats), 2) if total_lats else None,
        avg_retrieval_latency_ms=round(sum(ret_lats) / len(ret_lats), 2) if ret_lats else None,
        avg_generation_latency_ms=round(sum(gen_lats) / len(gen_lats), 2) if gen_lats else None,
        total_tokens_used=total_tokens,
        failed_runs_count=failed_count,
    )
