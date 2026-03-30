from langchain_google_genai import GoogleGenerativeAIEmbeddings
from app.core.config import settings

# Initialize the embedder
embedder = GoogleGenerativeAIEmbeddings(
    model=settings.GEMINI_EMBED_MODEL,
    google_api_key=settings.GEMINI_API_KEY
)

def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Generates embeddings for a list of texts using Gemini API."""
    if not texts:
        return []
    
    # embed_documents handles lists of text via Google GenAI APIs
    try:
        return embedder.embed_documents(texts)
    except Exception as e:
        print(f"Error generating embeddings: {e}")
        return []
