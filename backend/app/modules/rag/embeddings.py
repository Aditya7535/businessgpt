import os
from langchain_chroma import Chroma
from langchain_community.embeddings import OllamaEmbeddings
from langchain_core.documents import Document

from app.core.config import settings

# Define path for Chroma persistent storage
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__))) # backend/app
CHROMA_PERSIST_DIR = settings.CHROMA_PERSIST_DIR if settings.CHROMA_PERSIST_DIR else os.path.join(os.path.dirname(BASE_DIR), "data", "chromadb")

def get_vector_store():
    """
    Initializes and returns the Chroma vector store connected to Ollama embeddings.
    """
    # Initialize embeddings via Ollama (nomic-embed-text)
    embeddings = OllamaEmbeddings(
        model=os.getenv("OLLAMA_MODEL", "nomic-embed-text"),
        base_url=settings.OLLAMA_BASE_URL
    )
    
    # Initialize Chroma persistent client
    vector_store = Chroma(
        collection_name="business_data",
        embedding_function=embeddings,
        persist_directory=CHROMA_PERSIST_DIR
    )
    return vector_store

def embed_dataset(data: list[dict], filename: str):
    """
    Takes the cleaned JSON dataset (list of dictionaries), chunks it by row, 
    and embeds it into ChromaDB.
    """
    if not data:
        return
        
    vector_store = get_vector_store()
    
    documents = []
    for idx, row in enumerate(data):
        # Convert the dictionary row into a descriptive string for better embedding
        content = " | ".join(f"{k}: {v}" for k, v in row.items() if v != "" and v != "Unknown")
        
        doc = Document(
            page_content=content,
            metadata={
                "filename": filename,
                "row_index": idx
            }
        )
        documents.append(doc)
        
    # Add documents to the vector store (ChromaDB handles the API calls to Ollama)
    if documents:
        try:
            vector_store.add_documents(documents)
            print(f"Successfully embedded {len(documents)} rows from {filename} into ChromaDB.")
        except Exception as e:
            print(f"[Warning] Ollama embedding skipped for {filename}: {e}")
