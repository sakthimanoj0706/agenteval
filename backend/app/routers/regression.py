"""
Regression Testing Router.
Repeatable regression runs across configurations, metric delta tracking, and report exports.
"""

import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import EvaluationDataset, RegressionRun, TestCase, AgentRun
from app.schemas.schemas import RegressionRunRequest, RegressionResultResponse
from app.services.agent.executor import AgentExecutor
from app.services.eval.evaluator import EvaluationEngine
from app.services.eval.regression import RegressionService

router = APIRouter(prefix="/api/regression", tags=["Regression Testing"])


@router.post("/run")
def execute_regression_test(req: RegressionRunRequest, db: Session = Depends(get_db)):
    ds = db.query(EvaluationDataset).filter(EvaluationDataset.id == req.dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    test_cases = db.query(TestCase).filter(TestCase.dataset_id == req.dataset_id).all()
    if not test_cases:
        raise HTTPException(status_code=400, detail="Dataset has no test cases.")

    # 1. Execute Baseline
    b_cfg = req.baseline_config
    baseline_run_ids = []
    for tc in test_cases:
        exec_b = AgentExecutor(
            db=db,
            project_id=req.project_id,
            model_name=b_cfg.get("model_name", "mock-model"),
            model_provider=b_cfg.get("model_provider", "mock"),
            dataset_id=req.dataset_id,
            test_case_id=tc.id,
            top_k=b_cfg.get("top_k", 5),
            similarity_threshold=b_cfg.get("similarity_threshold", 0.2),
        )
        r_b = exec_b.execute(tc.query)
        try:
            EvaluationEngine.evaluate_run(db, r_b.id)
        except Exception:
            pass
        baseline_run_ids.append(r_b.id)

    # 2. Execute Comparison
    c_cfg = req.comparison_config
    comparison_run_ids = []
    for tc in test_cases:
        exec_c = AgentExecutor(
            db=db,
            project_id=req.project_id,
            model_name=c_cfg.get("model_name", "mock-model"),
            model_provider=c_cfg.get("model_provider", "mock"),
            dataset_id=req.dataset_id,
            test_case_id=tc.id,
            top_k=c_cfg.get("top_k", 5),
            similarity_threshold=c_cfg.get("similarity_threshold", 0.2),
        )
        r_c = exec_c.execute(tc.query)
        try:
            EvaluationEngine.evaluate_run(db, r_c.id)
        except Exception:
            pass
        comparison_run_ids.append(r_c.id)

    # 3. Calculate regression deltas
    delta_results = RegressionService.compare_runs(db, baseline_run_ids, comparison_run_ids)

    # 4. Save RegressionRun record
    reg_run = RegressionRun(
        project_id=req.project_id,
        dataset_id=req.dataset_id,
        baseline_run_ids=json.dumps(baseline_run_ids),
        comparison_run_ids=json.dumps(comparison_run_ids),
        baseline_config=json.dumps(b_cfg),
        comparison_config=json.dumps(c_cfg),
        results=json.dumps(delta_results),
        status="completed",
    )
    db.add(reg_run)
    db.commit()
    db.refresh(reg_run)

    return {
        "id": reg_run.id,
        "project_id": reg_run.project_id,
        "dataset_id": reg_run.dataset_id,
        "status": reg_run.status,
        "created_at": reg_run.created_at,
        **delta_results
    }


@router.get("/list")
def list_regression_tests(project_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(RegressionRun)
    if project_id:
        query = query.filter(RegressionRun.project_id == project_id)
    runs = query.order_by(RegressionRun.created_at.desc()).all()
    results = []
    for r in runs:
        res_data = json.loads(r.results or "{}")
        results.append({
            "id": r.id,
            "project_id": r.project_id,
            "dataset_id": r.dataset_id,
            "status": r.status,
            "created_at": r.created_at,
            "baseline_config": json.loads(r.baseline_config or "{}"),
            "comparison_config": json.loads(r.comparison_config or "{}"),
            "improved_count": len(res_data.get("improved_metrics", [])),
            "declined_count": len(res_data.get("declined_metrics", [])),
            "latency_delta_ms": res_data.get("latency_delta_ms", 0.0),
        })
    return results


@router.get("/{regression_id}")
def get_regression_test(regression_id: int, db: Session = Depends(get_db)):
    reg = db.query(RegressionRun).filter(RegressionRun.id == regression_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Regression run not found.")

    res_data = json.loads(reg.results or "{}")
    return {
        "id": reg.id,
        "project_id": reg.project_id,
        "dataset_id": reg.dataset_id,
        "status": reg.status,
        "created_at": reg.created_at,
        "baseline_config": json.loads(reg.baseline_config or "{}"),
        "comparison_config": json.loads(reg.comparison_config or "{}"),
        **res_data
    }


@router.get("/{regression_id}/export")
def export_regression_report(regression_id: int, format: str = Query("json", enum=["json", "csv"]), db: Session = Depends(get_db)):
    reg = db.query(RegressionRun).filter(RegressionRun.id == regression_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Regression run not found.")

    res_data = json.loads(reg.results or "{}")

    if format == "json":
        return Response(
            content=json.dumps(res_data, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=regression_report_{regression_id}.json"}
        )
    else:
        import io, csv
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Category", "Metric", "Baseline", "Comparison", "Delta"])
        for item in res_data.get("improved_metrics", []):
            writer.writerow(["Improved", item["metric_name"], item["baseline_value"], item["comparison_value"], item["delta"]])
        for item in res_data.get("declined_metrics", []):
            writer.writerow(["Declined", item["metric_name"], item["baseline_value"], item["comparison_value"], item["delta"]])
        for item in res_data.get("unchanged_metrics", []):
            writer.writerow(["Unchanged", item["metric_name"], item["baseline_value"], item["comparison_value"], item["delta"]])

        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=regression_report_{regression_id}.csv"}
        )
