from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
from sqlalchemy.orm import Session
from qdrant_client.http.models import PointStruct
from typing import Dict, Any
import os
import shutil
import uuid

from app.pdf.parser import process_pdf
from app.pdf.chunker import chunk_document
from app.db.postgres import get_db, Document, DocumentChunk
from app.rag.embedder import generate_embeddings
from app.rag.indexer import upsert_vectors

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("/")
def list_documents(db: Session = Depends(get_db)):
    """Returns all uploaded documents."""
    docs = db.query(Document).order_by(Document.id).all()
    return [
        {"id": d.id, "filename": d.filename, "status": d.status}
        for d in docs
    ]

@router.post("/upload")
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Uploads a PDF, processes it, and chunks the results."""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
    doc_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Process PDF
        extraction_result = process_pdf(file_path)
        
        # Chunk Document
        chunks = chunk_document(
            text=extraction_result["text"], 
            document_id=doc_id
        )
        
        # Store chunks and metadata in Database
        db_doc = Document(id=doc_id, filename=file.filename, status="processed")
        db.add(db_doc)
        
        db_chunks = []
        for chunk_data in chunks:
            chunk_text = chunk_data["text"]
            db_chunk = DocumentChunk(
                id=str(uuid.uuid4()),
                document_id=doc_id,
                text=chunk_text,
                chunk_index=chunk_data["chunk_index"]
            )
            db_chunks.append(db_chunk)
            db.add(db_chunk)
            
        db.commit()

        # Trigger indexing of chunks embeddings
        if chunks:
            texts_to_embed = [c["text"] for c in chunks]
            embeddings = generate_embeddings(texts_to_embed)
            if embeddings:
                points = [
                    PointStruct(
                        id=db_chunk.id,
                        vector=embedding,
                        payload={
                            "document_id": doc_id,
                            "chunk_index": db_chunk.chunk_index,
                            "text": db_chunk.text,
                            "filename": file.filename
                        }
                    )
                    for db_chunk, embedding in zip(db_chunks, embeddings)
                ]
                upsert_vectors(points)
        
        return {
            "status": "success",
            "document_id": doc_id,
            "filename": file.filename,
            "type": extraction_result["type"],
            "chunk_count": len(chunks)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing document: {str(e)}")
