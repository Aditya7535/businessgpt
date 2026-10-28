from datetime import datetime
import re
from app.modules.orchestrator.llm import invoke_llm

VALID_INTENTS = ['sql', 'forecasting', 'inventory', 'health', 'alerts', 'general']

def classify_intent(query: str) -> str:
    """
    Uses rule-based heuristics + LLM to classify user intent.
    Final valid intents: sql, forecasting, inventory, health, alerts, general.
    """
    q_lower = (query or "").lower().strip()
    current_date = datetime.now().strftime("%B %d, %Y")

    # 1. Fast-path for festival, market trend, business advice, strategy, ideas -> 'general'
    festival_keywords = [
        "festival", "festivals", "tyohar", "tyoohar", "teohar", "festive",
        "diwali", "deepawali", "holi", "eid", "navratri", "dussehra", "rakhi", "raksha bandhan",
        "christmas", "new year", "makar sankranti", "pongal", "onam", "ganesh chaturthi", "chhat", "ipl"
    ]
    market_advice_keywords = [
        "market", "trend", "trends", "advice", "suggest", "sujhav", "salah", "idea", "ideas",
        "strategy", "strategies", "pricing", "margin", "margins", "grow", "badhaye", "badhana",
        "kaise kare", "tips", "competition", "compete", "expand", "best practice", "consultant",
        "marketing", "promotion", "discount", "offer"
    ]
    greeting_keywords = ["hi", "hello", "hey", "namaste", "pranam", "kaise ho", "kya haal hai"]

    is_festival = any(w in q_lower for w in festival_keywords)
    is_market_advice = any(w in q_lower for w in market_advice_keywords)
    is_greeting = any(q_lower == g or q_lower.startswith(g + " ") for g in greeting_keywords)

    if is_festival or is_market_advice or is_greeting:
        return "general"

    # 2. Rule-based heuristics for high-priority routing
    is_forecast = any(w in q_lower for w in ["forecast", "predict", "agle mahine ki sales", "bhavishya ki bikri", "sales prediction", "sales forecast"]) or (
        any(w in q_lower for w in ["agle mahine", "next month", "aane wale hafte", "aane wale mahine"]) and any(w in q_lower for w in ["sales", "bikri", "revenue", "demand", "units"])
    )
    is_health = any(w in q_lower for w in ["business health", "health score", "kaisa chal raha", "how is business"])
    is_alerts = any(w in q_lower for w in ["koi alert", "any alert", "warnings", "notifications"])

    # Reorder / Restock recommendations -> 'inventory'
    # Reorder and restock recommendations route to inventory_node, while specific price/stock queries route to sql.
    reorder_keywords = [
        "reorder", "restock", "replenish", "replenishment",
        "mangwaye", "mangwao", "mangwana", "maal mangwa",
        "kya order kare", "kya order karein", "order kya kare", "kya restock", "kya reorder"
    ]
    is_reorder = any(w in q_lower for w in reorder_keywords) and not ("reorder point" in q_lower or "reorder level" in q_lower)

    if is_reorder:
        return "inventory"
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
        "low stock", "out of stock", "inventory", "sales", "revenue", "kamai", "bikri", "total",
        "kharide", "khatam", "shortage", "units", "quantity", "sold", "profit", "count", "category",
        "bill", "bills", "transaction"
    ]

    has_product = any(p in q_lower for p in product_keywords)
    has_stock_price = any(s in q_lower for s in stock_price_keywords)

    if has_product or has_stock_price:
        return "sql"

    # LLM-based intent classification for conversational queries
    prompt = f"""
    You are an intent classification system for an Indian SME business intelligence platform.
    Today's Date: {current_date}

    Analyze the user's query (in English, Hindi, or Hinglish) and classify it into EXACTLY ONE of these categories:

    - 'general' : Festivals, upcoming celebrations, market trends, business advice, strategy, ideas, pricing guidance, or greetings.
      Examples:
      * "aane waala festival konsa h?"
      * "market mein kya trend chal raha h?"
      * "sales kaise badhaye?"
      * "pricing strategy kya honi chahiye?"
      * "hello / namaste"
    - 'inventory' : Reorder and restock recommendations, replenishment suggestions, stock shortage purchasing decisions, or warehouse reordering advice.
      Examples:
      * "Which products should I reorder?"
      * "Which products should I reorder and restock?"
      * "What should I restock today?"
      * "Konsa maal mangwana chahiye?"
      * "Reorder recommendations batao"
      * "Kya order karna chahiye?"
    - 'sql' : Questions about store database products, stock, price, rate, availability, critical stock, sales numbers, revenue, totals, or uploaded CSV/Excel tables.
      Examples:
      * "Colgate ka stock kitna hai?"
      * "Colgate MaxFresh price kya hai?"
      * "Kaunse products critical stock mein hain?"
      * "Total sales kitni hui?"
      * "Top selling products kaunse hain?"
      * "Aaj ki sales kitni hai?"
    - 'forecasting' : Future statistical sales predictions or seasonal forecasting models (e.g., "agle mahine ki sales predict karo", "forecast revenue").
    - 'health' : Overall business health/score queries (e.g., "business health kaisa chal raha hai?", "what is my business health score?").
    - 'alerts' : Pending warnings/notifications (e.g., "koi alert hai kya?", "any warnings?").

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
        if is_reorder:
            return "inventory"
        if has_product or has_stock_price:
            return "sql"
        return "general"
    except Exception as e:
        print(f"[Intent] Classification error: {e}")
        if is_reorder:
            return "inventory"
        if has_product or has_stock_price:
            return "sql"
        return "general"
