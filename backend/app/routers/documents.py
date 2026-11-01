"""
Documents Router.
Handles document upload, text extraction, chunking, and FAISS indexing.
"""

import os
from typing import List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.models import Document, DocumentChunk, Project
from app.schemas.schemas import DocumentResponse, DocumentChunkResponse, IndexingRequest
from app.services.rag.document_processor import DocumentProcessor

router = APIRouter(tags=["Documents"])

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt"}


@router.post("/api/projects/{project_id}/documents", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    project_id: int,
    file: UploadFile = File(...),
    auto_index: bool = True,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Allowed: PDF, DOCX, TXT."
        )

    # Read contents and check size
    contents = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum allowed upload size of {settings.MAX_UPLOAD_SIZE_MB}MB."
        )

    # Save to disk
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    safe_filename = f"{project_id}_{file.filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, safe_filename)
    with open(file_path, "wb") as f:
        f.write(contents)

    doc = Document(
        project_id=project_id,
        filename=file.filename,
        file_type=ext.lstrip("."),
        file_size=len(contents),
        file_path=file_path,
        status="uploaded"
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    if auto_index:
        try:
            DocumentProcessor.process_and_index_document(doc.id, db)
            db.refresh(doc)
        except Exception as e:
            # Document status becomes 'failed' inside processor
            pass

    return doc


@router.get("/api/projects/{project_id}/documents", response_model=List[DocumentResponse])
def list_documents(project_id: int, db: Session = Depends(get_db)):
    return db.query(Document).filter(Document.project_id == project_id).order_by(Document.created_at.desc()).all()


@router.get("/api/documents/{document_id}", response_model=DocumentResponse)
def get_document(document_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return doc


@router.delete("/api/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    if os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception:
            pass

    db.delete(doc)
    db.commit()
    return None


@router.post("/api/documents/{document_id}/index")
def index_document(document_id: int, req: Optional[IndexingRequest] = None, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    chunk_size = req.chunk_size if req and req.chunk_size else settings.CHUNK_SIZE
    chunk_overlap = req.chunk_overlap if req and req.chunk_overlap else settings.CHUNK_OVERLAP

    try:
        count = DocumentProcessor.process_and_index_document(
            document_id=doc.id,
            db=db,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )
        return {"status": "indexed", "chunk_count": count, "message": f"Successfully indexed {count} chunks."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/documents/{document_id}/chunks", response_model=List[DocumentChunkResponse])
def get_document_chunks(document_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).order_by(DocumentChunk.chunk_index).all()
