import re
import requests
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.config import settings

QDRANT_BASE_URL = f"http://{settings.QDRANT_HOST}:{settings.QDRANT_PORT}"

def dense_search(query_vector: list[float], limit: int = 10, document_ids: list[str] | None = None) -> list[dict]:
    """Perform dense vector search in Qdrant via REST API (compatible with v1.9.0)."""
    try:
        url = f"{QDRANT_BASE_URL}/collections/{settings.QDRANT_COLLECTION}/points/search"
        payload = {"vector": query_vector, "limit": limit, "with_payload": True}
        # Apply document filter if specified
        if document_ids:
            payload["filter"] = {
                "must": [{"key": "document_id", "match": {"any": document_ids}}]
            }
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()
        
        results = []
        for hit in response.json().get("result", []):
            results.append({
                "chunk_id": hit["id"],
                "document_id": hit["payload"].get("document_id"),
                "filename": hit["payload"].get("filename"),
                "text": hit["payload"].get("text"),
                "score": hit["score"],
                "source": "dense"
            })
        return results
    except Exception as e:
        print(f"Dense search failed: {e}")
        return []

def sparse_search(query: str, db: Session, limit: int = 10, document_ids: list[str] | None = None) -> list[dict]:
    """Perform sparse (keyword) search using PostgreSQL ILIKE (Korean-compatible)."""
    raw_tokens = query.split()
    keywords = []
    for token in raw_tokens:
        latin_matches = re.findall(r'[A-Za-z][A-Za-z0-9]*', token)
        if latin_matches:
            keywords.extend(latin_matches)
        pure_korean = re.sub(r'[A-Za-z0-9]', '', token).strip()
        if len(pure_korean) >= 2:
            keywords.append(pure_korean)
    seen = set()
    keywords = [k for k in keywords if not (k in seen or seen.add(k))]
    if not keywords:
        return []
    
    try:
        conditions = " OR ".join([f"text ILIKE :kw{i}" for i in range(len(keywords))])
        doc_filter = ""
        if document_ids:
            placeholders = ", ".join([f":doc{i}" for i in range(len(document_ids))])
            doc_filter = f" AND dc.document_id IN ({placeholders})"
        sql = text(f"""
            SELECT dc.id, dc.document_id, dc.text, d.filename,
                   ({" + ".join([f"(CASE WHEN text ILIKE :kw{i} THEN 1 ELSE 0 END)" for i in range(len(keywords))])}) as match_count
            FROM document_chunks dc
            JOIN documents d ON dc.document_id = d.id
            WHERE ({conditions}){doc_filter}
            ORDER BY match_count DESC
            LIMIT :limit
        """)
        
        params = {f"kw{i}": f"%{kw}%" for i, kw in enumerate(keywords)}
        if document_ids:
            for i, did in enumerate(document_ids):
                params[f"doc{i}"] = did
        params["limit"] = limit
        result = db.execute(sql, params).fetchall()
        
        results = []
        for row in result:
            results.append({
                "chunk_id": row[0],
                "document_id": row[1],
                "text": row[2],
                "filename": row[3],
                "score": float(row[4]),
                "source": "sparse"
            })
        return results
    except Exception as e:
        print(f"Sparse search failed: {e}")
        return []

def reciprocal_rank_fusion(dense_results: list[dict], sparse_results: list[dict], k: int = 60) -> list[dict]:
    """Combine Dense and Sparse results using RRF."""
    fused_scores = {}
    
    for rank, doc in enumerate(dense_results):
        chunk_id = doc["chunk_id"]
        if chunk_id not in fused_scores:
            fused_scores[chunk_id] = {"doc": doc, "score": 0.0}
        fused_scores[chunk_id]["score"] += 1.0 / (k + rank + 1)
        
    for rank, doc in enumerate(sparse_results):
        chunk_id = doc["chunk_id"]
        if chunk_id not in fused_scores:
            fused_scores[chunk_id] = {"doc": doc, "score": 0.0}
        if fused_scores[chunk_id]["doc"]["source"] == "dense":
            fused_scores[chunk_id]["doc"]["source"] = "hybrid"
        fused_scores[chunk_id]["score"] += 1.0 / (k + rank + 1)
        
    reranked = sorted(fused_scores.values(), key=lambda x: x["score"], reverse=True)
    return [item["doc"] for item in reranked]
