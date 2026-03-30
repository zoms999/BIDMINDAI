from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.postgres import get_db, Document, DocumentChunk
from app.rag.embedder import generate_embeddings
from app.rag.indexer import upsert_vectors
from qdrant_client.http.models import PointStruct
import uuid

router = APIRouter()

@router.post("/")
async def index_document(document_id: str, db: Session = Depends(get_db)):
    """API endpoint to generate embeddings for a document's chunks and index them into Qdrant."""
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
        
    # Get the document and chunks from Postgres
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).all()
    
    if not chunks:
        raise HTTPException(status_code=400, detail="No chunks found for this document.")

    chunks.sort(key=lambda x: x.chunk_index)
    texts = [chunk.text for chunk in chunks]
    
    try:
        # Generate embeddings
        embeddings = generate_embeddings(texts)
        if not embeddings or len(embeddings) != len(texts):
            raise Exception("Embedding generation failed")
            
        # Prepare Qdrant points
        points = []
        for i, chunk in enumerate(chunks):
            point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, chunk.id))
            points.append(
                PointStruct(
                    id=point_id,
                    vector=embeddings[i],
                    payload={
                        "document_id": document_id,
                        "chunk_id": chunk.id,
                        "text": chunk.text,
                        "chunk_index": chunk.chunk_index,
                        "filename": doc.filename
                    }
                )
            )
            
        # Upsert into Qdrant
        upsert_vectors(points)
        
        # Update Document status
        doc.status = "indexed"
        db.commit()
        
        return {
            "status": "success",
            "message": f"Successfully indexed {len(points)} chunks for document {document_id}"
        }
        
    except Exception as e:
        doc.status = "indexing_failed"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Indexing failed: {str(e)}")
