import os
import qdrant_client
from qdrant_client.http.models import Distance, VectorParams, PointStruct
from app.core.config import settings
import uuid

# Gemini embedding-2-preview produces 3072-dimensional vectors
VECTOR_SIZE = 3072 

# Initialize Qdrant Client
try:
    client = qdrant_client.QdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT)
except Exception as e:
    print(f"Warning: Failed to initialize Qdrant client: {e}")
    client = None

def init_qdrant():
    """Initializes the Qdrant collection if it does not exist."""
    if not client:
        return
        
    try:
        collections = client.get_collections().collections
        collection_names = [c.name for c in collections]
        
        # Check if collection exists
        if settings.QDRANT_COLLECTION in collection_names:
            # Get collection info to check vector size
            collection_info = client.get_collection(settings.QDRANT_COLLECTION)
            existing_size = collection_info.config.params.vectors.size
            
            # If dimension mismatch, recreate collection
            if existing_size != VECTOR_SIZE:
                print(f"Vector size mismatch: existing={existing_size}, expected={VECTOR_SIZE}")
                print(f"Deleting and recreating collection: {settings.QDRANT_COLLECTION}")
                client.delete_collection(settings.QDRANT_COLLECTION)
                client.create_collection(
                    collection_name=settings.QDRANT_COLLECTION,
                    vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
                )
                print(f"Recreated Qdrant collection with size {VECTOR_SIZE}")
            else:
                print(f"Qdrant collection exists with correct size: {VECTOR_SIZE}")
        else:
            # Create new collection
            client.create_collection(
                collection_name=settings.QDRANT_COLLECTION,
                vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
            )
            print(f"Created Qdrant collection: {settings.QDRANT_COLLECTION} with size {VECTOR_SIZE}")
    except Exception as e:
        print(f"Error initializing Qdrant: {e}")

def upsert_vectors(points: list[PointStruct]):
    """Upserts embedding points into Qdrant collection."""
    if not client or not points:
        return
    
    try:
        # Verify vector dimensions before upserting
        if points:
            first_vector_dim = len(points[0].vector)
            if first_vector_dim != VECTOR_SIZE:
                print(f"Error: Vector dimension mismatch. Expected {VECTOR_SIZE}, got {first_vector_dim}")
                return
                
        client.upsert(
            collection_name=settings.QDRANT_COLLECTION,
            points=points
        )
        print(f"Successfully upserted {len(points)} vectors to Qdrant")
    except Exception as e:
        print(f"Error upserting vectors to Qdrant: {e}")
        # Print more details for debugging
        import traceback
        print("Full error traceback:")
        traceback.print_exc()
