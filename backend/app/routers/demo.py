"""
Demo Workspace Router.
Setup and cleanup of pre-populated demo documents, benchmark datasets, and evaluated runs.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Project
from app.services.demo.generator import DemoGenerator

router = APIRouter(prefix="/api/demo", tags=["Demo Mode"])


@router.post("/setup")
def setup_demo_environment(db: Session = Depends(get_db)):
    return DemoGenerator.setup_demo_data(db)


@router.delete("/cleanup")
def cleanup_demo_environment(db: Session = Depends(get_db)):
    return DemoGenerator.cleanup_demo_data(db)


@router.get("/status")
def get_demo_status(db: Session = Depends(get_db)):
    demo_proj = db.query(Project).filter(Project.name.like("%[DEMO]%")).first()
    return {
        "has_demo_data": demo_proj is not None,
        "demo_project_id": demo_proj.id if demo_proj else None,
        "demo_project_name": demo_proj.name if demo_proj else None,
    }
