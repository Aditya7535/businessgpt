from langchain_groq import ChatGroq
from langchain_ollama import ChatOllama
from app.core.config import settings

GROQ_MODEL = "openai/gpt-oss-20b"
OLLAMA_MODEL = "llama3.2"
OLLAMA_BASE_URL = "http://localhost:11434"


def invoke_llm(messages, temperature: float = 0.3):
    """Groq primary (fast, needs internet), local Ollama fallback (offline)."""
    if settings.GROQ_API_KEY:
        try:
            llm = ChatGroq(api_key=settings.GROQ_API_KEY, model_name=GROQ_MODEL, temperature=temperature)
            return llm.invoke(messages)
        except Exception as e:
            print(f"[LLM] Groq failed ({e}), falling back to Ollama.")

    llm = ChatOllama(model=OLLAMA_MODEL, base_url=OLLAMA_BASE_URL, temperature=temperature)
    return llm.invoke(messages)
