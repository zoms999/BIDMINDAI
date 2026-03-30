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
from app.core.config import settings
from google import genai
from google.genai import types
import json

router = APIRouter()

try:
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
except Exception as e:
    print(f"Failed to initialize Gemini Client for Chat: {e}")
    client = None

class ChatMessage(BaseModel):
    role: str
    content: str
    
class ChatRequest(BaseModel):
    query: str
    history: list[ChatMessage] = []
    document_ids: list[str] | None = None  # Optional document filtering

@router.post("/", dependencies=[Depends(verify_api_key)])
async def chat_stream(request: ChatRequest, db: Session = Depends(get_db)):
    """SSE Streaming Chatbot API powered by RAG."""
    if not client:
        raise HTTPException(status_code=500, detail="Gemini client not initialized")
        
    # 1. Retrieve Context from Hybrid Search Pipeline
    hyde_doc = generate_hyde_document(request.query)
    hyde_embedding = generate_embeddings([hyde_doc])
    
    doc_ids = request.document_ids if request.document_ids else None
    dense_results = dense_search(hyde_embedding[0], limit=15, document_ids=doc_ids) if hyde_embedding else []
    sparse_results = sparse_search(request.query, db, limit=15, document_ids=doc_ids)
    fused_results = reciprocal_rank_fusion(dense_results, sparse_results, k=60)
    top_chunks = rerank_chunks(request.query, fused_results[:10], top_k=5)
    
    # 2. Build Generation Prompt
    context_text = "\n\n".join([f"[Source: {chunk.get('filename', 'Unknown')}]\n{chunk['text']}" for chunk in top_chunks])
    
    system_instruction = f"""You are a helpful and expert BidMindAI assistant. Use the following retrieved document context to answer the user's question. 
If the answer cannot be found in the context, politely say that you don't know based on the provided documents.
Always cite the source filename when referencing specific details.

--- RETRIEVED CONTEXT ---
{context_text}
-------------------------"""

    contents = []
    for msg in request.history:
        role = "model" if msg.role in ["assistant", "model"] else "user"
        contents.append({"role": role, "parts": [{"text": msg.content}]})
        
    contents.append({"role": "user", "parts": [{"text": request.query}]})

    # 3. Stream Generator Function
    def event_stream():
        try:
            # Yield contextual sources first
            sources = [{"filename": c.get("filename"), "chunk_id": c.get("chunk_id")} for c in top_chunks]
            yield f"data: {json.dumps({'type': 'sources', 'data': sources})}\n\n"
            
            response_stream = client.models.generate_content_stream(
                model=settings.GEMINI_FLASH_MODEL,
                contents=contents,
                config=types.GenerateContentConfig(system_instruction=system_instruction)
            )
            
            for chunk in response_stream:
                if chunk.text:
                    payload = json.dumps({"type": "chunk", "data": chunk.text})
                    yield f"data: {payload}\n\n"
                    
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'data': str(e)})}\n\n"

    # StreamingResponse returning SSE
    return StreamingResponse(event_stream(), media_type="text/event-stream")
