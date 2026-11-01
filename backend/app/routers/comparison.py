"""
Model and Prompt Configuration Comparison Router.
Executes an evaluation dataset across multiple model/prompt/RAG configurations and compares side-by-side.
"""

from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import EvaluationDataset, TestCase, AgentRun, EvaluationResult
from app.schemas.schemas import ComparisonRequest
from app.services.agent.executor import AgentExecutor
from app.services.eval.evaluator import EvaluationEngine

router = APIRouter(prefix="/api/comparison", tags=["Model & Prompt Comparison"])


@router.post("/execute")
def execute_comparison(req: ComparisonRequest, db: Session = Depends(get_db)):
    ds = db.query(EvaluationDataset).filter(EvaluationDataset.id == req.dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    test_cases = db.query(TestCase).filter(TestCase.dataset_id == req.dataset_id).all()
    if not test_cases:
        raise HTTPException(status_code=400, detail="The dataset contains no test cases.")

    results_by_config = []

    for cfg in req.configurations:
        config_name = cfg.get("name") or f"{cfg.get('model_name', 'model')} (top_k={cfg.get('top_k', 5)})"
        model_name = cfg.get("model_name", "mock-model")
        provider = cfg.get("model_provider", "mock")
        top_k = cfg.get("top_k", 5)
        sim_thresh = cfg.get("similarity_threshold", 0.2)
        chunk_size = cfg.get("chunk_size", 512)

        config_run_ids = []
        for tc in test_cases:
            executor = AgentExecutor(
                db=db,
                project_id=req.project_id,
                model_name=model_name,
                model_provider=provider,
                dataset_id=req.dataset_id,
                test_case_id=tc.id,
                top_k=top_k,
                similarity_threshold=sim_thresh,
                chunk_size=chunk_size,
            )
            run = executor.execute(tc.query)
            try:
                EvaluationEngine.evaluate_run(db, run.id)
            except Exception:
                pass
            config_run_ids.append(run.id)

        # Aggregate metrics for this configuration
        evals = db.query(EvaluationResult).filter(
            EvaluationResult.agent_run_id.in_(config_run_ids),
            EvaluationResult.is_evaluated == True,
            EvaluationResult.metric_value.isnot(None)
        ).all()

        runs = db.query(AgentRun).filter(AgentRun.id.in_(config_run_ids)).all()
        lats = [r.total_latency_ms for r in runs if r.total_latency_ms]

        def avg_m(metric_name):
            vals = [e.metric_value for e in evals if e.metric_name == metric_name]
            return round(sum(vals) / len(vals), 4) if vals else 0.0

        results_by_config.append({
            "config_name": config_name,
            "model_name": model_name,
            "model_provider": provider,
            "top_k": top_k,
            "chunk_size": chunk_size,
            "total_runs": len(runs),
            "faithfulness": avg_m("faithfulness"),
            "answer_relevance": avg_m("answer_relevance"),
            "context_relevance": avg_m("context_relevance"),
            "recall_at_k": avg_m("recall_at_k"),
            "task_completion": avg_m("task_completion"),
            "avg_latency_ms": round(sum(lats) / len(lats), 2) if lats else 0.0,
            "total_tokens": sum((r.token_usage_prompt or 0) + (r.token_usage_completion or 0) for r in runs),
        })

    return {
        "status": "completed",
        "dataset_id": req.dataset_id,
        "dataset_name": ds.name,
        "configurations_compared": len(results_by_config),
        "results": results_by_config
    }
