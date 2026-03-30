from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.postgres import get_db
from app.rag.hyde import generate_hyde_document
from app.rag.embedder import generate_embeddings
from app.rag.retriever import dense_search, sparse_search, reciprocal_rank_fusion
from app.rag.reranker import rerank_chunks

router = APIRouter()

class SearchQuery(BaseModel):
    query: str
    limit: int = 5
    document_ids: list[str] | None = None  # Optional document filtering

@router.post("/")
async def perform_search(request: SearchQuery, db: Session = Depends(get_db)):
    """Hybrid search pipeline combining Dense, Sparse, RRF, HyDE and LLM Reranking."""
    
    try:
        # 1. HyDE
        hyde_doc = generate_hyde_document(request.query)
        
        # 2. Embed for Dense Search
        hyde_embedding = generate_embeddings([hyde_doc])
        
        dense_results = []
        if hyde_embedding:
            # Fetch deeper (limit 15) for RRF combination
            dense_results = dense_search(hyde_embedding[0], limit=15, document_ids=request.document_ids)
            
        # 3. Sparse Search
        sparse_results = sparse_search(request.query, db, limit=15, document_ids=request.document_ids)
        
        # 4. RRF
        fused_results = reciprocal_rank_fusion(dense_results, sparse_results, k=60)
        
        # 5. Rerank top 10 candidates using Gemini LLM
        candidates_to_rerank = fused_results[:10]
        final_results = rerank_chunks(request.query, candidates_to_rerank, top_k=request.limit)
        
        return {
            "status": "success",
            "query": request.query,
            "hyde_document": hyde_doc,
            "results": final_results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search pipeline failed: {str(e)}")
