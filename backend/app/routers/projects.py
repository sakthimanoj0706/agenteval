"""
Projects Router.
CRUD operations and summary statistics for evaluation projects.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Project, Document, DocumentChunk, EvaluationDataset, TestCase, AgentRun, EvaluationResult
from app.schemas.schemas import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectStats

router = APIRouter(prefix="/api/projects", tags=["Projects"])


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    existing = db.query(Project).filter(Project.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="A project with this name already exists.")

    project = Project(
        name=payload.name,
        description=payload.description or "",
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("", response_model=List[ProjectResponse])
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    results = []
    for p in projects:
        doc_count = db.query(Document).filter(Document.project_id == p.id).count()
        ds_count = db.query(EvaluationDataset).filter(EvaluationDataset.project_id == p.id).count()
        run_count = db.query(AgentRun).filter(AgentRun.project_id == p.id).count()
        p_dict = {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "status": p.status,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
            "document_count": doc_count,
            "dataset_count": ds_count,
            "run_count": run_count,
        }
        results.append(ProjectResponse(**p_dict))
    return results


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: int, db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found.")

    doc_count = db.query(Document).filter(Document.project_id == p.id).count()
    ds_count = db.query(EvaluationDataset).filter(EvaluationDataset.project_id == p.id).count()
    run_count = db.query(AgentRun).filter(AgentRun.project_id == p.id).count()

    p_dict = {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "status": p.status,
        "created_at": p.created_at,
        "updated_at": p.updated_at,
        "document_count": doc_count,
        "dataset_count": ds_count,
        "run_count": run_count,
    }
    return ProjectResponse(**p_dict)


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: int, payload: ProjectUpdate, db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found.")

    if payload.name and payload.name != p.name:
        existing = db.query(Project).filter(Project.name == payload.name).first()
        if existing:
            raise HTTPException(status_code=400, detail="Project name already in use.")
        p.name = payload.name

    if payload.description is not None:
        p.description = payload.description
    if payload.status is not None:
        p.status = payload.status

    db.commit()
    db.refresh(p)
    return p


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found.")

    # Reset vector index
    from app.services.rag.retriever import get_retriever
    retriever = get_retriever(p.id)
    retriever.reset()

    db.delete(p)
    db.commit()
    return None


@router.get("/{project_id}/stats", response_model=ProjectStats)
def get_project_stats(project_id: int, db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found.")

    total_docs = db.query(Document).filter(Document.project_id == project_id).count()
    total_chunks = (
        db.query(DocumentChunk)
        .join(Document, DocumentChunk.document_id == Document.id)
        .filter(Document.project_id == project_id)
        .count()
    )
    total_ds = db.query(EvaluationDataset).filter(EvaluationDataset.project_id == project_id).count()
    total_tc = (
        db.query(TestCase)
        .join(EvaluationDataset, TestCase.dataset_id == EvaluationDataset.id)
        .filter(EvaluationDataset.project_id == project_id)
        .count()
    )
    runs = db.query(AgentRun).filter(AgentRun.project_id == project_id).all()
    total_runs = len(runs)

    # Average metrics
    run_ids = [r.id for r in runs]
    avg_faith = None
    avg_rel = None
    avg_lat = None

    if run_ids:
        evals = db.query(EvaluationResult).filter(
            EvaluationResult.agent_run_id.in_(run_ids),
            EvaluationResult.is_evaluated == True,
            EvaluationResult.metric_value.isnot(None)
        ).all()

        faiths = [e.metric_value for e in evals if e.metric_name == "faithfulness"]
        rels = [e.metric_value for e in evals if e.metric_name == "answer_relevance"]
        lats = [r.total_latency_ms for r in runs if r.total_latency_ms]

        avg_faith = round(sum(faiths) / len(faiths), 4) if faiths else None
        avg_rel = round(sum(rels) / len(rels), 4) if rels else None
        avg_lat = round(sum(lats) / len(lats), 2) if lats else None

    completed_runs = sum(1 for r in runs if r.status == "completed")
    success_rate = round(completed_runs / total_runs, 4) if total_runs > 0 else None

    return ProjectStats(
        total_documents=total_docs,
        total_chunks=total_chunks,
        total_datasets=total_ds,
        total_test_cases=total_tc,
        total_runs=total_runs,
        avg_faithfulness=avg_faith,
        avg_relevance=avg_rel,
        avg_latency_ms=avg_lat,
        success_rate=success_rate,
    )
