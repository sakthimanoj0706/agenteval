"""
Document processing and chunking service.
Supports PDF, DOCX, and TXT files with configurable chunk size and overlap.
"""

import json
import logging
import os
import re
from typing import Dict, List, Tuple
from sqlalchemy.orm import Session

from app.models.models import Document, DocumentChunk
from app.services.rag.retriever import get_retriever

logger = logging.getLogger(__name__)


class DocumentProcessor:
    @staticmethod
    def extract_text(file_path: str, file_type: str) -> str:
        """Extract plain text from PDF, DOCX, or TXT."""
        file_type = file_type.lower().strip(".")
        if file_type == "txt":
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()

        elif file_type == "pdf":
            text = ""
            # Try pypdf / PyPDF2
            try:
                import pypdf
                reader = pypdf.PdfReader(file_path)
                for page in reader.pages:
                    t = page.extract_text()
                    if t:
                        text += t + "\n"
            except Exception:
                try:
                    import PyPDF2
                    reader = PyPDF2.PdfReader(file_path)
                    for page in reader.pages:
                        t = page.extract_text()
                        if t:
                            text += t + "\n"
                except Exception:
                    # Fallback to pdfplumber or pdfminer if installed
                    try:
                        import pdfplumber
                        with pdfplumber.open(file_path) as pdf:
                            for page in pdf.pages:
                                t = page.extract_text()
                                if t:
                                    text += t + "\n"
                    except Exception as e:
                        raise ValueError(f"Failed to extract text from PDF: {e}")
            return text

        elif file_type in ("docx", "doc"):
            try:
                import docx
                doc = docx.Document(file_path)
                full_text = []
                for para in doc.paragraphs:
                    if para.text.strip():
                        full_text.append(para.text.strip())
                for table in doc.tables:
                    for row in table.rows:
                        row_text = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                        if row_text:
                            full_text.append(" | ".join(row_text))
                return "\n".join(full_text)
            except Exception as e:
                raise ValueError(f"Failed to extract text from DOCX: {e}")

        else:
            raise ValueError(f"Unsupported file type: {file_type}")

    @staticmethod
    def clean_text(text: str) -> str:
        """Normalize whitespaces and remove non-printable characters."""
        if not text:
            return ""
        # Replace carriage returns and excessive whitespace
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        # Collapse multi-newlines
        text = re.sub(r"\n{3,}", "\n\n", text)
        # Collapse multiple spaces
        text = re.sub(r"[ \t]+", " ", text)
        return text.strip()

    @staticmethod
    def chunk_text(
        text: str,
        chunk_size: int = 512,
        chunk_overlap: int = 50
    ) -> List[Tuple[str, int, int]]:
        """
        Split text into overlapping chunks using token/word boundaries.
        Returns list of (chunk_content, start_char, end_char).
        """
        if not text:
            return []

        words = text.split()
        if not words:
            return []

        chunks = []
        # Estimate ~4 chars per token/word
        words_per_chunk = max(10, chunk_size // 4)
        overlap_words = max(0, min(words_per_chunk - 1, chunk_overlap // 4))

        step = max(1, words_per_chunk - overlap_words)
        curr_idx = 0

        # Create mapping of word start char index
        word_starts = []
        pos = 0
        for w in words:
            p = text.find(w, pos)
            word_starts.append(p if p != -1 else pos)
            pos = p + len(w) if p != -1 else pos + len(w)

        for i in range(0, len(words), step):
            chunk_word_slice = words[i:i + words_per_chunk]
            if not chunk_word_slice:
                break
            chunk_content = " ".join(chunk_word_slice)
            start_char = word_starts[i]
            last_word_idx = min(len(words) - 1, i + len(chunk_word_slice) - 1)
            end_char = word_starts[last_word_idx] + len(words[last_word_idx])

            chunks.append((chunk_content, start_char, end_char))
            if i + words_per_chunk >= len(words):
                break

        return chunks

    @classmethod
    def process_and_index_document(
        cls,
        document_id: int,
        db: Session,
        chunk_size: int = 512,
        chunk_overlap: int = 50
    ) -> int:
        """
        Extract text, chunk it, persist in database, and index in project vector store.
        Returns count of chunks created.
        """
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            raise ValueError(f"Document with id {document_id} not found.")

        doc.status = "processing"
        db.commit()

        try:
            raw_text = cls.extract_text(doc.file_path, doc.file_type)
            clean_text = cls.clean_text(raw_text)

            if not clean_text:
                raise ValueError("No extractable text found in document.")

            chunks_data = cls.chunk_text(clean_text, chunk_size, chunk_overlap)

            # Clear existing chunks if re-indexing
            db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).delete()

            chunk_records = []
            for idx, (content, start_char, end_char) in enumerate(chunks_data):
                chunk = DocumentChunk(
                    document_id=doc.id,
                    chunk_index=idx,
                    content=content,
                    start_char=start_char,
                    end_char=end_char,
                    metadata_json=json.dumps({
                        "filename": doc.filename,
                        "chunk_size": len(content),
                    })
                )
                db.add(chunk)
                chunk_records.append(chunk)

            db.commit()

            # Refresh to get IDs
            for c in chunk_records:
                db.refresh(c)

            # Add to FAISS / vector store
            retriever = get_retriever(doc.project_id)
            retriever.add_chunks([
                {
                    "id": c.id,
                    "content": c.content,
                    "document_id": doc.id,
                }
                for c in chunk_records
            ])

            doc.chunk_count = len(chunk_records)
            doc.status = "indexed"
            doc.error_message = None
            db.commit()

            return len(chunk_records)

        except Exception as e:
            logger.error(f"Document indexing failed for doc_id={document_id}: {e}", exc_info=True)
            doc.status = "failed"
            doc.error_message = str(e)
            db.commit()
            raise e
