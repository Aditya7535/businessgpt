from typing import Dict, TypedDict, Any
from langgraph.graph import StateGraph, END
from langchain_core.messages import SystemMessage
import json

from app.modules.orchestrator.intent import classify_intent
from app.modules.orchestrator.llm import invoke_llm
from app.modules.rag.retriever import retrieve_context
from app.core.database import SessionLocal
from app.models.dataset import Dataset

# Define the state dictionary
class GraphState(TypedDict):
    query: str
    intent: str
    context: str
    final_response: str
    module_used: str
    confidence: float

# Nodes
def classify_node(state: GraphState):
    """Detects intent and sets it in the state."""
    query = state["query"]
    intent = classify_intent(query)
    return {"intent": intent, "module_used": intent, "confidence": 0.95}

def sql_node(state: GraphState):
    """Queries PostgreSQL for exact numerical data."""
    db = SessionLocal()
    try:
        latest_dataset = db.query(Dataset).order_by(Dataset.id.desc()).first()
        if latest_dataset:
            context = f"Database holds file '{latest_dataset.filename}' with {latest_dataset.row_count} rows. Columns: {', '.join(latest_dataset.columns)}."
        else:
            context = "No data available in the SQL database."
    finally:
        db.close()
    return {"context": context}

def rag_node(state: GraphState):
    """Retrieves context from ChromaDB."""
    query = state["query"]
    context = retrieve_context(query)
    return {"context": context}

def forecasting_node(state: GraphState):
    """Runs the forecasting engine and returns structured context."""
    query = state["query"]
    db = SessionLocal()
    try:
        latest_dataset = db.query(Dataset).order_by(Dataset.id.desc()).first()
        if not latest_dataset or not latest_dataset.data:
            return {"context": "Forecasting ke liye koi data nahi mila. Pehle file upload karein."}

        # Parse horizon from query
        horizon = "month"
        query_lower = query.lower()
        if any(w in query_lower for w in ["week", "hafte", "hafta"]):
            horizon = "week"
        elif any(w in query_lower for w in ["quarter", "teen mahine", "3 month"]):
            horizon = "quarter"

        from app.modules.forecasting.engine import run_forecast
        from app.modules.forecasting.router import (
            _detect_date_column, _detect_sales_column, _detect_product_column
        )

        columns = list(latest_dataset.data[0].keys())
        date_col = _detect_date_column(columns)
        sales_col = _detect_sales_column(columns)
        product_col = _detect_product_column(columns)

        if not date_col or not sales_col:
            return {"context": f"Date ya sales column detect nahi hua. Available columns: {columns}"}

        result = run_forecast(
            raw_data=latest_dataset.data,
            date_col=date_col,
            sales_col=sales_col,
            horizon=horizon,
        )

        avg_pred = sum(p["predicted"] for p in result["forecast"]) / len(result["forecast"])
        context = (
            f"Forecast result: {result['insights']}\n"
            f"Model used: {result['model_used']}\n"
            f"Accuracy (MAPE): {result['accuracy']['mape']}%\n"
            f"Average predicted: {avg_pred:.0f} units per day\n"
            f"Festival impact: {result['festival_impact']}\n"
            f"Inventory suggestion: {result['inventory_suggestion']}"
        )
    except ValueError as e:
        context = str(e)
    except Exception as e:
        context = f"Forecasting mein error aaya: {str(e)}"
    finally:
        db.close()

    return {"context": context}

def inventory_node(state: GraphState):
    """Runs the inventory analysis engine."""
    query = state["query"]
    db = SessionLocal()
    try:
        latest_dataset = db.query(Dataset).order_by(Dataset.id.desc()).first()
        if not latest_dataset or not latest_dataset.data:
            return {"context": "Inventory analysis ke liye koi data nahi mila. Pehle file upload karein."}

        from app.modules.inventory.engine import analyze_all_products
        from app.modules.inventory.health_score import get_inventory_alerts, compute_inventory_health_score
        from app.modules.inventory.router import _detect_col

        columns = list(latest_dataset.data[0].keys())
        date_col = _detect_col(columns, ["date", "order_date", "invoice_date", "month", "time"])
        sales_col = _detect_col(columns, ["quantity", "units", "qty", "sales", "revenue", "amount"])
        product_col = _detect_col(columns, ["product_name", "product", "item", "sku", "category"])
        stock_col = _detect_col(columns, ["stock", "current_stock", "inventory", "on_hand"])
        price_col = _detect_col(columns, ["price", "unit_price", "rate", "mrp", "cost"])

        if not date_col or not sales_col or not product_col:
            return {"context": f"Required columns nahi mile. Available: {columns}"}

        results = analyze_all_products(
            data=latest_dataset.data,
            date_col=date_col,
            sales_col=sales_col,
            product_col=product_col,
            stock_col=stock_col,
            price_col=price_col,
        )

        alerts = get_inventory_alerts(results)
        health = compute_inventory_health_score(results)

        context = (
            f"Inventory Health Score: {health['score']}/100 (Grade: {health['grade']})\n"
            f"Critical: {alerts['critical']}\n"
            f"Low Stock: {alerts['low_stock']}\n"
            f"Overstock: {alerts['overstock']}\n"
            f"Optimal: {alerts['optimal']}\n\n"
        )
        for item in results:
            if "error" not in item:
                context += f"- {item.get('insight', '')}\n"

    except Exception as e:
        context = f"Inventory analysis mein error: {str(e)}"
    finally:
        db.close()

    return {"context": context}


def market_node(state: GraphState):
    """Fetches Google Trends + News for the query topic."""
    query = state["query"]
    # Extract category from query (use query itself as the keyword)
    category = query.replace("trend", "").replace("market", "").replace("naya product", "").strip()
    if not category:
        category = "business"

    try:
        from app.modules.market_intel.trends import get_google_trends, get_market_recommendation
        from app.modules.market_intel.news import get_business_news
        trends = get_google_trends(category)
        news = get_business_news(category)
        rec = get_market_recommendation(category, trends)
        context = (
            f"Market Trends for '{category}':\n"
            f"Direction: {trends['trend_direction']}\n"
            f"Trending: {', '.join(trends.get('trending_products', []))}\n"
            f"Seasonal Opportunity: {trends.get('seasonal_opportunity', '')}\n"
            f"News Sentiment: {news.get('sentiment', 'neutral')}\n"
            f"News: {news.get('news_summary', '')}\n"
            f"Recommendation: {rec}"
        )
    except Exception as e:
        context = f"Market intelligence data available. Error: {str(e)[:80]}"

    return {"context": context}


def health_node(state: GraphState):
    """Returns Business Health Score."""
    db = SessionLocal()
    try:
        from app.modules.health.scorer import compute_health_score
        health = compute_health_score(db)
        context = (
            f"Business Health Score: {health['total_score']}/100 — Grade {health['grade']}\n"
            f"{health.get('message', '')}\n"
            f"Components: {health.get('components', {})}\n"
            f"Top Issue: {health.get('top_issue', '')}"
        )
    except Exception as e:
        context = f"Health score error: {str(e)[:80]}"
    finally:
        db.close()
    return {"context": context}


def alerts_node(state: GraphState):
    """Returns pending alerts."""
    db = SessionLocal()
    try:
        from app.models.alert import Alert
        alerts = db.query(Alert).filter(Alert.is_read == False).order_by(Alert.created_at.desc()).limit(10).all()
        if not alerts:
            from app.modules.alerts.checker import run_all_checks
            live_alerts = run_all_checks(db)
            if live_alerts:
                context = f"{len(live_alerts)} alerts:\n" + "\n".join(a["message"] for a in live_alerts[:5])
            else:
                context = "Abhi koi alert nahi hai. Sab theek hai! ✅"
        else:
            context = f"{len(alerts)} unread alerts:\n" + "\n".join(f"• {a.message}" for a in alerts[:5])
    except Exception as e:
        context = f"Alerts error: {str(e)[:80]}"
    finally:
        db.close()
    return {"context": context}


def placeholder_node(state: GraphState):
    """Generic fallback."""
    return {"context": "Yeh feature abhi available nahi hai. RAG se answer dene ki koshish karta hoon."}

def synthesize_node(state: GraphState):
    """Uses Groq to generate the final natural language answer in Hinglish (Latin/English script)."""
    query = state["query"]
    context = state.get("context", "")

    prompt = f"""
    You are BusinessGPT, a smart, friendly, and practical AI business advisor for Indian SME (Small and Medium Enterprise) owners.
    
    CRITICAL LANGUAGE & SCRIPT RULES (MANDATORY):
    1. ALWAYS RESPOND IN HINGLISH: Mix conversational Hindi and English naturally (e.g., "Aapka business health score badhiya chal raha hai", "Thoda stock reorder karna padega", "Total revenue ₹50,000 badh gaya hai").
    2. STRICTLY USE ENGLISH ALPHABET ONLY: Write everything using the Latin / English alphabet (Roman script).
    3. ABSOLUTELY NO DEVANAGARI SCRIPT: Never use Hindi/Devanagari characters (DO NOT write 'नमस्ते', 'बिक्री', 'व्यापार', 'स्टॉक'). Always spell Hindi words phonetically in English letters (e.g. write "Namaste", "sales", "business", "stock", "kam hai", "badha sakte hain").
    4. Keep the tone warm, encouraging, concise, and actionable for an Indian business owner.
    5. Answer the user's query based on the provided context. If the context mentions a feature is missing or coming, politely say so in Hinglish.
    
    Context:
    {context}
    
    User Query: {query}
    """

    try:
        response = invoke_llm([SystemMessage(content=prompt)], temperature=0.3)
        response_text = response.content

        # Failsafe: Ensure zero Devanagari script appears in output
        import re
        if re.search(r'[\u0900-\u097F]', response_text):
            fix_prompt = (
                "Rewrite the following text into conversational HINGLISH written STRICTLY using the ENGLISH / LATIN ALPHABET. "
                "DO NOT USE ANY DEVANAGARI HINDI SCRIPT:\n\n"
                f"{response_text}"
            )
            converted = invoke_llm([SystemMessage(content=fix_prompt)], temperature=0.2)
            if not re.search(r'[\u0900-\u097F]', converted.content):
                response_text = converted.content

        return {"final_response": response_text}
    except RuntimeError as e:
        # Groq unavailable — return context directly with a note
        error_hint = str(e)
        if context and context.strip():
            # We have data — return it raw so user still gets value
            fallback = (
                f"⚠️ AI response generation abhi unavailable hai ({error_hint})\n\n"
                f"Raw data:\n\n{context}"
            )
        else:
            fallback = (
                f"⚠️ Abhi AI service unavailable hai ({error_hint}). "
                "Please thodi der baad try karein."
            )
        return {"final_response": fallback}
    except Exception as e:
        return {"final_response": f"⚠️ Unexpected error: {str(e)[:200]}"}

# Edge router
def route_intent(state: GraphState):
    intent = state["intent"]
    if intent == "sql":
        return "sql"
    elif intent == "forecasting":
        return "forecasting"
    elif intent == "inventory":
        return "inventory"
    elif intent == "market":
        return "market"
    elif intent == "health":
        return "health"
    elif intent == "alerts":
        return "alerts"
    else:
        return "rag"   # rag + general

# Build the Graph
workflow = StateGraph(GraphState)

workflow.add_node("classify", classify_node)
workflow.add_node("sql", sql_node)
workflow.add_node("rag", rag_node)
workflow.add_node("forecasting", forecasting_node)
workflow.add_node("inventory", inventory_node)
workflow.add_node("market", market_node)
workflow.add_node("health", health_node)
workflow.add_node("alerts", alerts_node)
workflow.add_node("placeholder", placeholder_node)
workflow.add_node("synthesize", synthesize_node)

workflow.set_entry_point("classify")

workflow.add_conditional_edges(
    "classify",
    route_intent,
    {
        "sql": "sql",
        "rag": "rag",
        "forecasting": "forecasting",
        "inventory": "inventory",
        "market": "market",
        "health": "health",
        "alerts": "alerts",
        "placeholder": "placeholder",
    }
)

workflow.add_edge("sql", "synthesize")
workflow.add_edge("rag", "synthesize")
workflow.add_edge("forecasting", "synthesize")
workflow.add_edge("inventory", "synthesize")
workflow.add_edge("market", "synthesize")
workflow.add_edge("health", "synthesize")
workflow.add_edge("alerts", "synthesize")
workflow.add_edge("placeholder", "synthesize")
workflow.add_edge("synthesize", END)

# Compile graph
app_graph = workflow.compile()
