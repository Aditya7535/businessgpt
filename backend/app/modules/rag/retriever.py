from app.modules.rag.embeddings import get_vector_store

def retrieve_context(query: str, k: int = 5) -> str:
    """
    Retrieves the most relevant chunks from ChromaDB for the given query.
    Returns them as a single concatenated string.
    """
    vector_store = get_vector_store()
    
    # Retrieve documents similar to the query
    docs = vector_store.similarity_search(query, k=k)
    
    if not docs:
        return "No relevant business data found in the knowledge base."
        
    # Format the context
    context = "\n".join([f"- {doc.page_content} (Source: {doc.metadata.get('filename', 'Unknown')})" for doc in docs])
    return context
