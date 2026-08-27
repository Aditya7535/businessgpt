from app.modules.orchestrator.llm import invoke_llm

def classify_intent(query: str) -> str:
    """
    Uses an LLM (Groq primary, local Ollama fallback) to classify the user's
    intent into one of the specific modules. Supports English, Hindi, and Hinglish.
    """
    prompt = f"""
    You are an intent classification system for an Indian SME business intelligence platform.
    Analyze the user's query (which may be in English, Hindi, or Hinglish) and classify it into EXACTLY ONE of these categories:

    - 'sql' : Exact numbers, totals, averages, counts (e.g., "meri total sales kitni hai?", "what is the revenue?").
    - 'rag' : Context, reasons, explanations, text analysis, "why" questions (e.g., "sales kyu giri?", "analyze performance").
    - 'forecasting' : Predictions or future trends (e.g., "agle mahine ki sales batao", "forecast revenue").
    - 'inventory' : Stock, ordering, or warehouse queries.
    - 'market' : General market trends, competitor analysis, or trending products.
    - 'health' : Overall business health/score queries (e.g., "business kaisa chal raha hai?", "how is my business doing?").
    - 'alerts' : Pending warnings/notifications (e.g., "koi alert hai kya?", "any warnings?").
    - 'general' : Basic greetings or unrelated chat.

    User Query: "{query}"

    Return ONLY the category word in lowercase. Do not include any other text or punctuation.
    """

    try:
        response = invoke_llm(prompt, temperature=0.0)
        intent = response.content.strip().lower()

        # Failsafe parsing
        valid_intents = ['sql', 'rag', 'forecasting', 'inventory', 'market', 'health', 'alerts', 'general']
        for v in valid_intents:
            if v in intent:
                return v
        return "general"
    except Exception as e:
        print(f"Intent classification failed: {e}")
        # Fallback to standard RAG on API failure
        return "rag"
