"""
Failure Analysis Router.
Automatic categorization across 8 failure modes with actionable root-cause debugging guidance.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import AgentRun
from app.services.eval.failure_analyzer import FailureAnalyzer

router = APIRouter(prefix="/api/failures", tags=["Failure Analysis"])


@router.get("/analysis")
def get_failure_analysis(project_id: Optional[int] = None, db: Session = Depends(get_db)):
    return FailureAnalyzer.analyze_project_failures(db, project_id=project_id)


@router.get("/category/{category_key}")
def get_failures_by_category(category_key: str, project_id: Optional[int] = None, db: Session = Depends(get_db)):
    all_analysis = FailureAnalyzer.analyze_project_failures(db, project_id=project_id)
    for cat in all_analysis["categories"]:
        if cat["category"] == category_key:
            return cat
    raise HTTPException(status_code=404, detail=f"Category '{category_key}' not found.")


@router.get("/run/{run_identifier}")
def get_run_failures(run_identifier: str, db: Session = Depends(get_db)):
    if run_identifier.isdigit():
        run = db.query(AgentRun).filter(AgentRun.id == int(run_identifier)).first()
    else:
        run = db.query(AgentRun).filter(AgentRun.run_id == run_identifier).first()

    if not run:
        raise HTTPException(status_code=404, detail="Run not found.")

    all_analysis = FailureAnalyzer.analyze_project_failures(db, project_id=run.project_id)
    matched_failures = []
    for cat in all_analysis["categories"]:
        for c in cat["affected_cases"]:
            if c["run_id"] == run.run_id:
                matched_failures.append({
                    "category": cat["category"],
                    "title": cat["title"],
                    "debugging_guidance": cat["debugging_guidance"],
                    "detail": c["error"],
                })

    return {
        "run_id": run.run_id,
        "query": run.query,
        "status": run.status,
        "detected_failures": matched_failures,
    }
