from typing import Dict, TypedDict, Any
from langgraph.graph import StateGraph, END
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage
import json

from app.modules.orchestrator.intent import classify_intent
from app.modules.rag.retriever import retrieve_context
from app.core.config import settings
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
        sales_col = _detect_col(columns, ["sales", "revenue", "quantity", "units", "amount", "qty"])
        product_col = _detect_col(columns, ["product", "item", "sku", "category", "product_name"])
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


def placeholder_node(state: GraphState):
    """For market module (Phase 5+)."""
    return {"context": "Market intelligence module Phase 5 mein aayega. Abhi ke liye RAG se answer de raha hoon."}

def synthesize_node(state: GraphState):
    """Uses Groq to generate the final natural language answer."""
    query = state["query"]
    context = state.get("context", "")

    llm = ChatGroq(
        api_key=settings.GROQ_API_KEY,
        model_name="llama-3.1-8b-instant",
        temperature=0.3
    )

    prompt = f"""
    You are BusinessGPT, a helpful AI business consultant for Indian SME owners.
    Answer the user's query based ONLY on the provided context.
    If the context mentions a feature is coming, politely say so.
    Reply in the same language the user used (English, Hindi, or Hinglish).
    Be concise, friendly, and actionable.
    
    Context:
    {context}
    
    User Query: {query}
    """

    response = llm.invoke([SystemMessage(content=prompt)])
    return {"final_response": response.content}

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
        return "placeholder"
    else:
        return "rag"   # rag + general

# Build the Graph
workflow = StateGraph(GraphState)

workflow.add_node("classify", classify_node)
workflow.add_node("sql", sql_node)
workflow.add_node("rag", rag_node)
workflow.add_node("forecasting", forecasting_node)
workflow.add_node("inventory", inventory_node)
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
        "placeholder": "placeholder",
    }
)

workflow.add_edge("sql", "synthesize")
workflow.add_edge("rag", "synthesize")
workflow.add_edge("forecasting", "synthesize")
workflow.add_edge("inventory", "synthesize")
workflow.add_edge("placeholder", "synthesize")
workflow.add_edge("synthesize", END)

# Compile graph
app_graph = workflow.compile()
