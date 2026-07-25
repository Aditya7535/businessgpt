from app.modules.rag.embeddings import get_vector_store

def retrieve_context(query: str, k: int = 5) -> str:
    """
    Retrieves the most relevant chunks from ChromaDB for the given query.
    Returns them as a single concatenated string.
    Falls back gracefully if Ollama is not running.
    """
    try:
        vector_store = get_vector_store()
        docs = vector_store.similarity_search(query, k=k)

        if not docs:
            return "No relevant business data found in the knowledge base. Please upload a CSV/Excel file first."

        context = "\n".join([
            f"- {doc.page_content} (Source: {doc.metadata.get('filename', 'Unknown')})"
            for doc in docs
        ])
        return context

    except Exception as e:
        err_msg = str(e).lower()
        if "10061" in err_msg or "connection refused" in err_msg or "max retries" in err_msg:
            return (
                "Ollama service is currently offline. "
                "Please start it by running 'ollama serve' in a terminal. "
                "I will answer based on general business knowledge for now."
            )
        return f"RAG retrieval error: {str(e)}"
