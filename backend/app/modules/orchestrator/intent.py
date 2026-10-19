import re
from app.modules.orchestrator.llm import invoke_llm

VALID_INTENTS = ['sql', 'forecasting', 'inventory', 'health', 'alerts', 'general']

def classify_intent(query: str) -> str:
    """
    Uses rule-based heuristics + LLM to classify user intent.
    Final valid intents: sql, forecasting, inventory, health, alerts, general.
    """
    q_lower = (query or "").lower().strip()

    # Rule-based heuristics for high-priority routing
    is_forecast = any(w in q_lower for w in ["forecast", "predict", "agle mahine", "bhavishya", "next month", "aane wale"])
    is_health = any(w in q_lower for w in ["business health", "health score", "kaisa chal raha", "how is business"])
    is_alerts = any(w in q_lower for w in ["koi alert", "any alert", "warnings", "notifications"])

    if is_forecast:
        return "forecasting"
    if is_health:
        return "health"
    if is_alerts:
        return "alerts"

    # Fast-path for specific product queries, stock lookup, price, availability, critical stock, numerical sales -> 'sql'
    product_keywords = [
        "colgate", "basmati", "tata salt", "sunflower oil", "fortune", "atta",
        "maggi", "parle", "bhujia", "dettol", "amul", "surf excel", "butter", "milk", "soap", "noodle", "rice", "oil"
    ]
    stock_price_keywords = [
        "stock", "price", "rate", "mrp", "cost", "bhav", "keemat", "kimat",
        "available", "bacha", "kitna hai", "kitne hain", "critical stock",
        "low stock", "out of stock", "reorder", "inventory", "sales", "revenue", "kamai", "bikri", "total",
        "mangwaye", "mangwao", "mangwana", "order kare", "order karein", "order karna", "kharide", "khatam", "shortage"
    ]

    has_product = any(p in q_lower for p in product_keywords)
    has_stock_price = any(s in q_lower for s in stock_price_keywords)

    if has_product or has_stock_price:
        return "sql"

    # LLM-based intent classification for conversational queries
    prompt = f"""
    You are an intent classification system for an Indian SME business intelligence platform.
    Analyze the user's query (in English, Hindi, or Hinglish) and classify it into EXACTLY ONE of these categories:

    - 'sql' : Questions about products, stock, price, rate, availability, critical stock, sales numbers, revenue, totals, or uploaded CSV/Excel tables.
      Examples:
      * "Colgate ka stock kitna hai?"
      * "Colgate MaxFresh price kya hai?"
      * "Kaunse products critical stock mein hain?"
      * "Total sales kitni hui?"
      * "Top selling products kaunse hain?"
      * "Aaj ki sales kitni hai?"
    - 'forecasting' : Future sales predictions or seasonal forecasting (e.g., "agle mahine ki sales batao", "forecast revenue").
    - 'inventory' : General warehouse operations or high-level inventory health score ONLY when not asking about specific product stock.
    - 'health' : Overall business health/score queries (e.g., "business kaisa chal raha hai?", "how is my business doing?").
    - 'alerts' : Pending warnings/notifications (e.g., "koi alert hai kya?", "any warnings?").
    - 'general' : General business guidance, advice, greetings (hi, hello, namaste), or general questions.

    User Query: "{query}"

    Return ONLY the category word in lowercase. Do not include any other text or punctuation.
    """

    try:
        response = invoke_llm(prompt, temperature=0.0)
        intent = response.content.strip().lower()

        for v in VALID_INTENTS:
            if v in intent:
                return v
        return "general"
    except RuntimeError as e:
        print(f"[Intent] LLM unavailable: {e}")
        return "general"
    except Exception as e:
        print(f"[Intent] Classification error: {e}")
        return "general"
