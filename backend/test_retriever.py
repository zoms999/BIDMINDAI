import asyncio
from sqlalchemy.orm import Session
from app.db.postgres import SessionLocal
from app.rag.hyde import generate_hyde_document
from app.rag.embedder import generate_embeddings
from app.rag.retriever import dense_search, sparse_search, reciprocal_rank_fusion
from app.rag.reranker import rerank_chunks

def test_retrieval(query="UB4R에 대해 설명해줘"):
    print(f"Query: {query}")
    db = SessionLocal()
    
    hyde_doc = generate_hyde_document(query)
    print(f"Hyde Doc: {hyde_doc[:100]}...")
    
    hyde_embedding = generate_embeddings([hyde_doc])
    print(f"Embeddings length: {len(hyde_embedding[0]) if hyde_embedding else 0}")
    
    dense_results = dense_search(hyde_embedding[0], limit=15) if hyde_embedding else []
    print(f"Dense Results Count: {len(dense_results)}")
    
    sparse_results = sparse_search(query, db, limit=15)
    print(f"Sparse Results Count: {len(sparse_results)}")
    
    fused_results = reciprocal_rank_fusion(dense_results, sparse_results, k=60)
    print(f"Fused Results Count: {len(fused_results)}")
    
    top_chunks = rerank_chunks(query, fused_results[:10], top_k=5)
    print(f"Reranked Chunks Count: {len(top_chunks)}")
    
    for i, c in enumerate(top_chunks):
        print(f"\n--- Chunk {i} ---")
        print(f"Source: {c.get('source')}")
        print(f"Score: {c.get('score')} | Rerank: {c.get('rerank_score')}")
        print(f"Text:\n{c.get('text')[:300]}...")

if __name__ == "__main__":
    test_retrieval()
