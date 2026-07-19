from langchain_groq import ChatGroq
from app.core.config import settings

def classify_intent(query: str) -> str:
    """
    Uses the Groq LLM to classify the user's intent into one of the specific modules.
    Supports English, Hindi, and Hinglish.
    """
    if not settings.GROQ_API_KEY:
        return "general"
        
    # Using temperature=0.0 for deterministic classification
    llm = ChatGroq(
        api_key=settings.GROQ_API_KEY,
        model_name="llama-3.1-8b-instant",
        temperature=0.0 
    )
    
    prompt = f"""
    You are an intent classification system for an Indian SME business intelligence platform.
    Analyze the user's query (which may be in English, Hindi, or Hinglish) and classify it into EXACTLY ONE of these categories:
    
    - 'sql' : Exact numbers, totals, averages, counts (e.g., "meri total sales kitni hai?", "what is the revenue?").
    - 'rag' : Context, reasons, explanations, text analysis, "why" questions (e.g., "sales kyu giri?", "analyze performance").
    - 'forecasting' : Predictions or future trends (e.g., "agle mahine ki sales batao", "forecast revenue").
    - 'inventory' : Stock, ordering, or warehouse queries.
    - 'market' : General market trends or competitor analysis.
    - 'general' : Basic greetings or unrelated chat.
    
    User Query: "{query}"
    
    Return ONLY the category word in lowercase. Do not include any other text or punctuation.
    """
    
    try:
        response = llm.invoke(prompt)
        intent = response.content.strip().lower()
        
        # Failsafe parsing
        valid_intents = ['sql', 'rag', 'forecasting', 'inventory', 'market', 'general']
        for v in valid_intents:
            if v in intent:
                return v
        return "general"
    except Exception as e:
        print(f"Intent classification failed: {e}")
        # Fallback to standard RAG on API failure
        return "rag"
