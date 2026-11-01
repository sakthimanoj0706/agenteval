"""
Dashboard Router.
Aggregated analytics, chart datasets, and filtered runs table for observability.
"""

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import AgentRun, EvaluationResult, Project, EvaluationDataset
from app.routers.agent import get_full_run_response
from app.schemas.schemas import AgentRunResponse
from app.services.eval.failure_analyzer import FailureAnalyzer

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard & Analytics"])


@router.get("/summary")
def get_dashboard_summary(project_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(AgentRun)
    if project_id:
        query = query.filter(AgentRun.project_id == project_id)
    runs = query.all()

    total_runs = len(runs)
    if total_runs == 0:
        return {
            "total_runs": 0,
            "avg_faithfulness": None,
            "avg_answer_relevance": None,
            "avg_context_relevance": None,
            "task_completion_rate": None,
            "avg_latency_ms": None,
            "failed_runs_count": 0,
        }

    run_ids = [r.id for r in runs]
    evals = db.query(EvaluationResult).filter(
        EvaluationResult.agent_run_id.in_(run_ids),
        EvaluationResult.is_evaluated == True,
        EvaluationResult.metric_value.isnot(None)
    ).all()

    def avg_val(name: str):
        vals = [e.metric_value for e in evals if e.metric_name == name and e.metric_value is not None]
        return round(sum(vals) / len(vals), 4) if vals else None

    lats = [r.total_latency_ms for r in runs if r.total_latency_ms]
    failed = sum(1 for r in runs if r.status == "failed")
    completed = sum(1 for r in runs if r.status == "completed")

    return {
        "total_runs": total_runs,
        "avg_faithfulness": avg_val("faithfulness"),
        "avg_answer_relevance": avg_val("answer_relevance"),
        "avg_context_relevance": avg_val("context_relevance"),
        "task_completion_rate": round(completed / total_runs, 4) if total_runs else 0.0,
        "avg_latency_ms": round(sum(lats) / len(lats), 2) if lats else None,
        "failed_runs_count": failed,
    }


@router.get("/charts/retrieval-quality")
def get_retrieval_quality_chart(project_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(AgentRun)
    if project_id:
        query = query.filter(AgentRun.project_id == project_id)
    runs = query.order_by(AgentRun.created_at.asc()).limit(30).all()

    chart_data = []
    for r in runs:
        evals = db.query(EvaluationResult).filter(EvaluationResult.agent_run_id == r.id).all()
        eval_map = {e.metric_name: e.metric_value for e in evals if e.is_evaluated}
        chart_data.append({
            "run_id": r.run_id[:8],
            "query": r.query[:30] + "...",
            "context_relevance": eval_map.get("context_relevance", 0.0),
            "similarity_score": eval_map.get("avg_similarity_score", 0.0),
            "recall_at_k": eval_map.get("recall_at_k"),
        })
    return chart_data


@router.get("/charts/faithfulness-relevance")
def get_faithfulness_relevance_chart(project_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(AgentRun)
    if project_id:
        query = query.filter(AgentRun.project_id == project_id)
    runs = query.order_by(AgentRun.created_at.asc()).limit(30).all()

    chart_data = []
    for r in runs:
        evals = db.query(EvaluationResult).filter(EvaluationResult.agent_run_id == r.id).all()
        eval_map = {e.metric_name: e.metric_value for e in evals if e.is_evaluated}
        chart_data.append({
            "run_id": r.run_id[:8],
            "query": r.query[:25] + "...",
            "faithfulness": eval_map.get("faithfulness", 0.0),
            "answer_relevance": eval_map.get("answer_relevance", 0.0),
        })
    return chart_data


@router.get("/charts/model-performance")
def get_model_performance_chart(project_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(AgentRun)
    if project_id:
        query = query.filter(AgentRun.project_id == project_id)
    runs = query.all()

    model_groups = defaultdict(list)
    for r in runs:
        model_groups[r.model_name].append(r)

    chart_data = []
    for model_name, m_runs in model_groups.items():
        m_ids = [r.id for r in m_runs]
        evals = db.query(EvaluationResult).filter(
            EvaluationResult.agent_run_id.in_(m_ids),
            EvaluationResult.is_evaluated == True,
            EvaluationResult.metric_value.isnot(None)
        ).all()

        def avg(metric):
            v = [e.metric_value for e in evals if e.metric_name == metric]
            return round(sum(v) / len(v), 4) if v else 0.0

        lats = [r.total_latency_ms for r in m_runs if r.total_latency_ms]
        chart_data.append({
            "model_name": model_name,
            "faithfulness": avg("faithfulness"),
            "answer_relevance": avg("answer_relevance"),
            "context_relevance": avg("context_relevance"),
            "avg_latency_ms": round(sum(lats) / len(lats), 2) if lats else 0.0,
            "total_runs": len(m_runs),
        })
    return chart_data


@router.get("/charts/latency-trend")
def get_latency_trend_chart(project_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(AgentRun)
    if project_id:
        query = query.filter(AgentRun.project_id == project_id)
    runs = query.order_by(AgentRun.created_at.asc()).limit(40).all()

    chart_data = []
    for r in runs:
        chart_data.append({
            "timestamp": r.created_at.strftime("%H:%M:%S") if r.created_at else "",
            "run_id": r.run_id[:8],
            "total_latency_ms": round(r.total_latency_ms or 0.0, 1),
            "retrieval_latency_ms": round(r.retrieval_latency_ms or 0.0, 1),
            "generation_latency_ms": round(r.generation_latency_ms or 0.0, 1),
        })
    return chart_data


@router.get("/charts/token-usage")
def get_token_usage_chart(project_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(AgentRun)
    if project_id:
        query = query.filter(AgentRun.project_id == project_id)
    runs = query.order_by(AgentRun.created_at.asc()).limit(40).all()

    chart_data = []
    for r in runs:
        chart_data.append({
            "run_id": r.run_id[:8],
            "prompt_tokens": r.token_usage_prompt or 0,
            "completion_tokens": r.token_usage_completion or 0,
            "total_tokens": (r.token_usage_prompt or 0) + (r.token_usage_completion or 0),
        })
    return chart_data


@router.get("/charts/failure-distribution")
def get_failure_distribution_chart(project_id: Optional[int] = None, db: Session = Depends(get_db)):
    analysis = FailureAnalyzer.analyze_project_failures(db, project_id=project_id)
    chart_data = []
    for cat in analysis["categories"]:
        if cat["count"] > 0:
            chart_data.append({
                "name": cat["title"],
                "category": cat["category"],
                "value": cat["count"],
            })
    return chart_data


@router.get("/runs", response_model=List[AgentRunResponse])
def get_dashboard_runs_table(
    project_id: Optional[int] = None,
    dataset_id: Optional[int] = None,
    model_name: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    query = db.query(AgentRun)
    if project_id:
        query = query.filter(AgentRun.project_id == project_id)
    if dataset_id:
        query = query.filter(AgentRun.dataset_id == dataset_id)
    if model_name:
        query = query.filter(AgentRun.model_name == model_name)
    if status:
        query = query.filter(AgentRun.status == status)

    runs = query.order_by(AgentRun.created_at.desc()).offset(offset).limit(limit).all()
    return [get_full_run_response(r.id, db) for r in runs]
