from google import genai
from app.core.config import settings
from app.core.redis import redis_client
import hashlib

# Wait for google-genai initialization, fallback if not set
try:
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
except Exception as e:
    print(f"Failed to initialize Gemini Client for HyDE: {e}")
    client = None

def generate_hyde_document(query: str) -> str:
    """Generate a hypothetical document using Gemini based on the user's query."""
    if not client:
        return query
        
    # Check cache
    cache_key = f"hyde:{hashlib.md5(query.encode()).hexdigest()}"
    if redis_client:
        try:
            cached = redis_client.get(cache_key)
            if cached:
                return cached
        except Exception:
            pass

    prompt = f"""You are an expert proposal writing assistant. 
Given the user's search query, write a hypothetical excerpt from an ideal proposal or document that directly answers or addresses the query. 
Do not include any pleasantries or conversational text, just the hypothetical document content.

User Query: {query}
Hypothetical Document:"""

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_FLASH_MODEL,
            contents=prompt,
        )
        hyde_doc = response.text.strip()
        
        # Store in cache (expire in 24 hours)
        if redis_client:
            try:
                redis_client.setex(cache_key, 86400, hyde_doc)
            except Exception:
                pass
                
        return hyde_doc
    except Exception as e:
        print(f"HyDE generation failed: {e}")
        return query # Fallback to original query
