import re
from google import genai
from app.core.config import settings

try:
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
except Exception as e:
    client = None

def rerank_chunks(query: str, chunks: list[dict], top_k: int = 5) -> list[dict]:
    """Rerank chunks using Gemini LLM to assess relevance to the query."""
    if not chunks or not client:
        return chunks[:top_k] if chunks else []
        
    prompt = f"Evaluate the relevance of each document chunk to the user's query.\nUser Query: {query}\n\n"
    for i, chunk in enumerate(chunks):
        # Limit text size to avoid huge prompts
        prompt += f"--- Chunk {i} ---\n{chunk['text'][:800]}...\n\n"
        
    prompt += """For each chunk, provide a relevance score from 0 to 10. 
Output ONLY a comma-separated list of numbers corresponding to the chunks in order (e.g. 8,3,9,0,1). No formatting or extra words."""

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_FLASH_MODEL,
            contents=prompt,
        )
        
        scores_text = response.text.strip()
        numbers = re.findall(r'\b\d+(?:\.\d+)?\b', scores_text)
        scores = [float(n) for n in numbers]
        
        if len(scores) != len(chunks):
            print("Mismatch in reranker scores returned by LLM.")
            return chunks[:top_k]
            
        for i, chunk in enumerate(chunks):
            chunk["rerank_score"] = scores[i]
            
        chunks.sort(key=lambda x: x.get("rerank_score", 0), reverse=True)
        return chunks[:top_k]
        
    except Exception as e:
        print(f"Reranking failed: {e}")
        return chunks[:top_k]
