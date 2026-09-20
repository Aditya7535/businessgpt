from langchain_groq import ChatGroq
from app.core.config import settings

# ── Groq model ────────────────────────────────────────────────────────────────
GROQ_MODEL = "openai/gpt-oss-20b"

# NOTE: Ollama local fallback is intentionally DISABLED.
# Reason: GPU OOM (cudaMalloc failed) on this machine.
# If Groq fails, a clear RuntimeError is raised so the chat
# endpoint returns a user-friendly error instead of crashing.


def invoke_llm(messages, temperature: float = 0.3):
    """
    Invokes Groq LLM (llama3-8b-8192).

    Raises RuntimeError with a user-friendly message on failure.
    The calling code (synthesize_node / chat endpoint) catches this
    and returns an actionable error to the frontend.
    """
    if not settings.GROQ_API_KEY:
        raise RuntimeError(
            "GROQ_API_KEY is not configured. "
            "Please add your Groq API key to backend/.env and restart the server."
        )

    try:
        llm = ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model_name=GROQ_MODEL,
            temperature=temperature,
        )
        return llm.invoke(messages)

    except Exception as e:
        error_str = str(e)
        print(f"[LLM] Groq call failed: {error_str}")

        if "401" in error_str or "invalid_api_key" in error_str.lower():
            raise RuntimeError(
                "Groq API key is invalid or expired. "
                "Please update GROQ_API_KEY in backend/.env."
            ) from e
        elif "429" in error_str or "rate_limit" in error_str.lower():
            raise RuntimeError(
                "Groq rate limit reached. Please wait a moment and try again."
            ) from e
        elif any(code in error_str for code in ["503", "502"]) or "connection" in error_str.lower():
            raise RuntimeError(
                "Groq service is temporarily unavailable. Please try again in a few seconds."
            ) from e
        else:
            raise RuntimeError(
                f"AI service error. Please try again. (Detail: {error_str[:150]})"
            ) from e
