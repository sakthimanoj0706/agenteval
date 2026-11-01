"""
Datasets and Test Cases Router.
Dataset curation, ground-truth annotation, duplicate, import and export.
"""

import csv
import io
import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, UploadFile, File, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import EvaluationDataset, TestCase, Project
from app.schemas.schemas import DatasetCreate, DatasetUpdate, DatasetResponse, TestCaseCreate, TestCaseUpdate, TestCaseResponse

router = APIRouter(tags=["Evaluation Datasets"])


@router.post("/api/projects/{project_id}/datasets", response_model=DatasetResponse, status_code=status.HTTP_201_CREATED)
def create_dataset(project_id: int, payload: DatasetCreate, db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found.")

    ds = EvaluationDataset(
        project_id=project_id,
        name=payload.name,
        description=payload.description or "",
    )
    db.add(ds)
    db.commit()
    db.refresh(ds)
    return ds


@router.get("/api/projects/{project_id}/datasets", response_model=List[DatasetResponse])
def list_datasets(project_id: int, db: Session = Depends(get_db)):
    datasets = db.query(EvaluationDataset).filter(EvaluationDataset.project_id == project_id).order_by(EvaluationDataset.created_at.desc()).all()
    results = []
    for d in datasets:
        count = db.query(TestCase).filter(TestCase.dataset_id == d.id).count()
        r = DatasetResponse.from_orm(d)
        r.test_case_count = count
        results.append(r)
    return results


@router.get("/api/datasets/{dataset_id}", response_model=DatasetResponse)
def get_dataset(dataset_id: int, db: Session = Depends(get_db)):
    ds = db.query(EvaluationDataset).filter(EvaluationDataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    test_cases = db.query(TestCase).filter(TestCase.dataset_id == ds.id).order_by(TestCase.id.asc()).all()
    r = DatasetResponse.from_orm(ds)
    r.test_case_count = len(test_cases)
    r.test_cases = [TestCaseResponse.from_orm(tc) for tc in test_cases]
    return r


@router.put("/api/datasets/{dataset_id}", response_model=DatasetResponse)
def update_dataset(dataset_id: int, payload: DatasetUpdate, db: Session = Depends(get_db)):
    ds = db.query(EvaluationDataset).filter(EvaluationDataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    if payload.name:
        ds.name = payload.name
    if payload.description is not None:
        ds.description = payload.description

    db.commit()
    db.refresh(ds)
    return ds


@router.delete("/api/datasets/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dataset(dataset_id: int, db: Session = Depends(get_db)):
    ds = db.query(EvaluationDataset).filter(EvaluationDataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    db.delete(ds)
    db.commit()
    return None


# ==================== Test Cases ====================

@router.post("/api/datasets/{dataset_id}/test-cases", response_model=TestCaseResponse, status_code=status.HTTP_201_CREATED)
def add_test_case(dataset_id: int, payload: TestCaseCreate, db: Session = Depends(get_db)):
    ds = db.query(EvaluationDataset).filter(EvaluationDataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    tc = TestCase(
        dataset_id=dataset_id,
        query=payload.query,
        expected_answer=payload.expected_answer,
        reference_context=payload.reference_context,
        relevant_doc_ids=json.dumps(payload.relevant_doc_ids) if payload.relevant_doc_ids is not None else None,
        expected_tool=payload.expected_tool,
        category=payload.category or "normal",
    )
    db.add(tc)
    db.commit()
    db.refresh(tc)
    return tc


@router.put("/api/test-cases/{case_id}", response_model=TestCaseResponse)
def update_test_case(case_id: int, payload: TestCaseUpdate, db: Session = Depends(get_db)):
    tc = db.query(TestCase).filter(TestCase.id == case_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found.")

    if payload.query is not None:
        tc.query = payload.query
    if payload.expected_answer is not None:
        tc.expected_answer = payload.expected_answer
    if payload.reference_context is not None:
        tc.reference_context = payload.reference_context
    if payload.relevant_doc_ids is not None:
        tc.relevant_doc_ids = json.dumps(payload.relevant_doc_ids)
    if payload.expected_tool is not None:
        tc.expected_tool = payload.expected_tool
    if payload.category is not None:
        tc.category = payload.category

    db.commit()
    db.refresh(tc)
    return tc


@router.delete("/api/test-cases/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_test_case(case_id: int, db: Session = Depends(get_db)):
    tc = db.query(TestCase).filter(TestCase.id == case_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found.")
    db.delete(tc)
    db.commit()
    return None


@router.post("/api/test-cases/{case_id}/duplicate", response_model=TestCaseResponse)
def duplicate_test_case(case_id: int, db: Session = Depends(get_db)):
    orig = db.query(TestCase).filter(TestCase.id == case_id).first()
    if not orig:
        raise HTTPException(status_code=404, detail="Test case not found.")

    new_tc = TestCase(
        dataset_id=orig.dataset_id,
        query=f"{orig.query} (Copy)",
        expected_answer=orig.expected_answer,
        reference_context=orig.reference_context,
        relevant_doc_ids=orig.relevant_doc_ids,
        expected_tool=orig.expected_tool,
        category=orig.category,
    )
    db.add(new_tc)
    db.commit()
    db.refresh(new_tc)
    return new_tc


# ==================== Import / Export ====================

@router.post("/api/datasets/{dataset_id}/import")
async def import_test_cases(dataset_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    ds = db.query(EvaluationDataset).filter(EvaluationDataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    contents = await file.read()
    filename = file.filename.lower()
    imported_count = 0

    if filename.endswith(".json"):
        try:
            data = json.loads(contents.decode("utf-8"))
            if isinstance(data, dict) and "test_cases" in data:
                items = data["test_cases"]
            elif isinstance(data, list):
                items = data
            else:
                items = [data]

            for item in items:
                q = item.get("query")
                if not q:
                    continue
                tc = TestCase(
                    dataset_id=dataset_id,
                    query=q,
                    expected_answer=item.get("expected_answer"),
                    reference_context=item.get("reference_context"),
                    relevant_doc_ids=json.dumps(item.get("relevant_doc_ids", [])),
                    expected_tool=item.get("expected_tool"),
                    category=item.get("category", "normal"),
                )
                db.add(tc)
                imported_count += 1
            db.commit()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON file: {e}")

    elif filename.endswith(".csv"):
        try:
            text = contents.decode("utf-8-sig")
            reader = csv.DictReader(io.StringIO(text))
            for row in reader:
                q = row.get("query") or row.get("question")
                if not q:
                    continue
                tc = TestCase(
                    dataset_id=dataset_id,
                    query=q,
                    expected_answer=row.get("expected_answer") or row.get("answer"),
                    reference_context=row.get("reference_context") or row.get("context"),
                    expected_tool=row.get("expected_tool") or row.get("tool"),
                    category=row.get("category", "normal"),
                )
                db.add(tc)
                imported_count += 1
            db.commit()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid CSV file: {e}")
    else:
        raise HTTPException(status_code=400, detail="Only .csv and .json formats supported.")

    return {"status": "success", "imported_count": imported_count}


@router.get("/api/datasets/{dataset_id}/export")
def export_dataset(dataset_id: int, format: str = Query("json", enum=["json", "csv"]), db: Session = Depends(get_db)):
    ds = db.query(EvaluationDataset).filter(EvaluationDataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    test_cases = db.query(TestCase).filter(TestCase.dataset_id == dataset_id).all()

    if format == "json":
        data = {
            "dataset_name": ds.name,
            "description": ds.description,
            "test_cases": [
                {
                    "id": tc.id,
                    "query": tc.query,
                    "expected_answer": tc.expected_answer,
                    "reference_context": tc.reference_context,
                    "relevant_doc_ids": json.loads(tc.relevant_doc_ids) if tc.relevant_doc_ids else [],
                    "expected_tool": tc.expected_tool,
                    "category": tc.category,
                }
                for tc in test_cases
            ]
        }
        return Response(
            content=json.dumps(data, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=dataset_{dataset_id}.json"}
        )
    else:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["id", "query", "expected_answer", "reference_context", "expected_tool", "category"])
        for tc in test_cases:
            writer.writerow([tc.id, tc.query, tc.expected_answer or "", tc.reference_context or "", tc.expected_tool or "", tc.category])
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=dataset_{dataset_id}.csv"}
        )
