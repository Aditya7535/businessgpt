import os
from langchain_chroma import Chroma
from langchain_community.embeddings import OllamaEmbeddings
from langchain_core.documents import Document

# Define path for Chroma persistent storage
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__))) # backend/app
CHROMA_PERSIST_DIR = os.path.join(os.path.dirname(BASE_DIR), "data", "chromadb")

def get_vector_store():
    """
    Initializes and returns the Chroma vector store connected to Ollama embeddings.
    """
    # Initialize local embeddings via Ollama (nomic-embed-text)
    embeddings = OllamaEmbeddings(
        model="nomic-embed-text",
        base_url="http://localhost:11434"
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
        vector_store.add_documents(documents)
        print(f"Successfully embedded {len(documents)} rows from {filename} into ChromaDB.")
