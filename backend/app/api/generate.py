from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from app.core.security import verify_api_key
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.postgres import get_db
from app.rag.hyde import generate_hyde_document
from app.rag.embedder import generate_embeddings
from app.rag.retriever import dense_search, sparse_search, reciprocal_rank_fusion
from app.rag.reranker import rerank_chunks
from app.services.proposal_service import generate_proposal_stream
import json

router = APIRouter()

class ProposalRequest(BaseModel):
    topic: str
    requirements: str
    limit: int = 15
    document_ids: list[str] | None = None  # Optional document filtering

@router.post("/", dependencies=[Depends(verify_api_key)])
async def generate_proposal(request: ProposalRequest, db: Session = Depends(get_db)):
    """SSE API to generate a full proposal based on RAG context."""
    
    # We combine topic and requirements for a rich search query
    search_query = f"{request.topic}\n{request.requirements}"
    
    # 1. RAG Retrieval Pipeline
    try:
        hyde_doc = generate_hyde_document(search_query)
        hyde_embedding = generate_embeddings([hyde_doc])
        
        doc_ids = request.document_ids if request.document_ids else None
        dense_results = dense_search(hyde_embedding[0], limit=20, document_ids=doc_ids) if hyde_embedding else []
        sparse_results = sparse_search(search_query, db, limit=20, document_ids=doc_ids)
        fused_results = reciprocal_rank_fusion(dense_results, sparse_results, k=60)
        
        # Rerank to get high quality context for the proposal
        top_chunks = rerank_chunks(search_query, fused_results[:20], top_k=request.limit)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Context retrieval failed: {str(e)}")

    # 2. Streaming Generator
    def event_stream():
        try:
            # Send initial sources meta-event
            sources = [{"filename": c.get("filename"), "chunk_id": c.get("chunk_id")} for c in top_chunks]
            yield f"data: {json.dumps({'type': 'sources', 'data': sources})}\n\n"
            
            # Stream proposal text
            stream = generate_proposal_stream(
                topic=request.topic,
                requirements=request.requirements,
                retrieved_context=top_chunks
            )
            
            for text_chunk in stream:
                payload = json.dumps({"type": "chunk", "data": text_chunk})
                yield f"data: {payload}\n\n"
                
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'data': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
