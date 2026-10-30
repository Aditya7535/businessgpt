from datetime import datetime
import re
from typing import Optional
from app.modules.orchestrator.llm import invoke_llm

VALID_INTENTS = ['sql', 'forecasting', 'inventory', 'inventory_adjustment', 'health', 'alerts', 'general']

def is_stock_adjustment_phrase(q_lower: str) -> bool:
    """Detects whether an utterance expresses a physical stock adjustment or conversational product management action."""
    # 1. Product creation keywords
    create_keywords = [
        "naya product", "naya item", "add new product", "create product",
        "new sku", "new item", "product add karo", "item add karo", "add product"
    ]
    if any(k in q_lower for k in create_keywords):
        return True

    # 2. Product price / reorder point update keywords
    update_keywords = [
        "price kar do", "price set kar do", "price badal do", "price change karo",
        "reorder point kar do", "reorder set kar do", "change price to", "set price to"
    ]
    if any(k in q_lower for k in update_keywords):
        return True

    # 3. Product deletion keywords
    delete_keywords = ["product delete", "item delete", "delete kar do", "remove kar do", "catalog se hata do"]
    if any(k in q_lower for k in delete_keywords):
        return True

    # 4. Stock movement actions
    action_keywords = [
        "stock aaya", "godown se aaya", "aaya hai", "aaye hain", "maal aaya",
        "bik gaye", "bik gaya", "bika hai", "sell hue", "bech diya",
        "toot gayi", "toot gaya", "phutli", "kharab ho gaya", "expire ho gaya", "damage hua",
        "aur add kar do", "add kar do", "stock mein daal", "add kara",
        "supplier ko return", "supplier ko wapas", "supplier la parat",
        "customer ne wapas", "grahak ne wapas", "customer return",
        "physical count", "shillak ahet", "actual mein bacha"
    ]
    has_action = any(k in q_lower for k in action_keywords)
    has_number = bool(re.search(r'\b(\d+|ek|do|teen|char|paanch|chhe|saat|aath|nau|das|pandrah|bees|pachees|tees|pachas|hundred|daha|vis)\b', q_lower))
    return has_action and has_number


def classify_intent(query: str, session_id: Optional[str] = None) -> str:
    """
    Uses rule-based heuristics + LLM to classify user intent.
    Final valid intents: sql, forecasting, inventory, inventory_adjustment, health, alerts, general.
    """
    q_lower = (query or "").lower().strip()
    current_date = datetime.now().strftime("%B %d, %Y")

    # 1. Check for active confirmation/cancellation response
    from app.modules.inventory.conversational import is_confirmation_intent
    if is_confirmation_intent(q_lower) is not None:
        if session_id:
            try:
                from app.core.database import SessionLocal
                from app.models.inventory_adjustment import PendingInventoryAdjustment
                db = SessionLocal()
                pending = db.query(PendingInventoryAdjustment).filter(
                    PendingInventoryAdjustment.session_id == session_id,
                    PendingInventoryAdjustment.status == "PENDING"
                ).first()
                db.close()
                if pending:
                    return "inventory_adjustment"
            except Exception:
                pass

    # 2. Fast-path for stock adjustment statements
    if is_stock_adjustment_phrase(q_lower):
        return "inventory_adjustment"

    # 3. Fast-path for festival, market trend, business advice, strategy, ideas -> 'general'
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

    # 4. Rule-based heuristics for high-priority routing
    is_forecast = any(w in q_lower for w in ["forecast", "predict", "agle mahine ki sales", "bhavishya ki bikri", "sales prediction", "sales forecast"]) or (
        any(w in q_lower for w in ["agle mahine", "next month", "aane wale hafte", "aane wale mahine"]) and any(w in q_lower for w in ["sales", "bikri", "revenue", "demand", "units"])
    )
    is_health = any(w in q_lower for w in ["business health", "health score", "kaisa chal raha", "how is business"])
    is_alerts = any(w in q_lower for w in ["koi alert", "any alert", "warnings", "notifications"])

    # Reorder / Restock recommendations -> 'inventory'
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

    Analyze the user's query (in English, Hindi, Hinglish, or Marathi) and classify it into EXACTLY ONE of these categories:

    - 'inventory_adjustment' : Actionable statements updating stock quantities (e.g. stock received, items sold, damaged items, supplier returns, customer returns, or physical count).
      Examples:
      * "50 packet Maggi ka stock aaya hai."
      * "20 Maggi bik gaye."
      * "10 kilo chawal godown se aaya."
      * "5 Coca Cola ki bottle toot gayi."
      * "Maggi ke 30 packet aur add kar do."
      * "20 packet maal supplier ko return kar diya."
      * "Customer ne 2 packet wapas kiye."
    - 'general' : Festivals, celebrations, market trends, business advice, strategy, ideas, or greetings.
    - 'inventory' : Reorder and restock recommendations, replenishment suggestions, stock shortage purchasing decisions.
    - 'sql' : Questions asking to check or look up data (e.g., "Colgate ka stock kitna hai?", "Total sales kitni hui?").
    - 'forecasting' : Future sales statistical predictions.
    - 'health' : Business health score queries.
    - 'alerts' : Pending notifications / warnings.

    User Query: "{query}"

    Return ONLY the category word in lowercase. Do not include any other text.
    """

    try:
        response = invoke_llm(prompt, temperature=0.0)
        intent = response.content.strip().lower()

        for v in VALID_INTENTS:
            if v in intent:
                return v
        return "general"
    except Exception as e:
        if is_stock_adjustment_phrase(q_lower):
            return "inventory_adjustment"
        if is_reorder:
            return "inventory"
        if has_product or has_stock_price:
            return "sql"
        return "general"
