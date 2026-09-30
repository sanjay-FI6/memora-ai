import os
from qdrant_client import QdrantClient
from qdrant_client.http import models

# Qdrant vector database URL configurations
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
COLLECTION_NAME = "concept_embeddings"

def init_qdrant_db():
    print(f"Connecting to Qdrant vector database at: {QDRANT_URL}")
    try:
        client = QdrantClient(url=QDRANT_URL)
        
        # Check current existing collections
        collections_response = client.get_collections()
        existing_names = [c.name for c in collections_response.collections]
        
        if COLLECTION_NAME in existing_names:
            print(f"Collection '{COLLECTION_NAME}' already exists. Setup skipped.")
            return True
            
        # Create collection with 1536 dimensions and Cosine similarity metric
        print(f"Creating new Qdrant collection: '{COLLECTION_NAME}' (dim=1536, metric=COSINE)")
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=models.VectorParams(
                size=1536,
                distance=models.Distance.COSINE
            )
        )
        print(f"Collection '{COLLECTION_NAME}' successfully initialized!")
        return True
    except Exception as e:
        print(f"Error establishing or initializing Qdrant database: {e}")
        return False

if __name__ == "__main__":
    init_qdrant_db()
