from typing import Dict, TypedDict, Any
from langgraph.graph import StateGraph, END
from langchain_core.messages import SystemMessage
import json
import re

from app.modules.orchestrator.intent import classify_intent
from app.modules.orchestrator.llm import invoke_llm
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
    """Queries PostgreSQL using Text-to-SQL for numerical execution."""
    from app.modules.text_to_sql.engine import run_text_to_sql
    query = state["query"]
    result = run_text_to_sql(query)
    context = (
        f"Data Source: {result.get('source', 'Live PostgreSQL Database')}\n"
        f"SQL Query executed: {result['sql']}\n"
        f"Execution Result:\n{result['answer']}\n"
        f"Raw data rows: {result['data']}"
    )
    return {"context": context, "module_used": "SQL"}

def general_node(state: GraphState):
    """Fallback query handling with live SQL execution."""
    from app.modules.text_to_sql.engine import run_text_to_sql
    query = state["query"]
    result = run_text_to_sql(query)
    if result.get("data") and len(result["data"]) > 0:
        context = (
            f"Data Source: {result.get('source', 'Live PostgreSQL Database')}\n"
            f"SQL Query executed: {result['sql']}\n"
            f"Execution Result:\n{result['answer']}\n"
            f"Raw data rows: {result['data']}"
        )
    else:
        context = (
            f"Data Source: {result.get('source', 'Live PostgreSQL Database')}\n"
            f"Store data lookup: {result.get('answer', 'Koi records nahi mile.')}\n"
            f"User question: {query}"
        )
    return {"context": context, "module_used": "general"}

def forecasting_node(state: GraphState):
    """Runs the forecasting engine on live sales_data and returns structured context."""
    query = state["query"]
    db = SessionLocal()
    try:
        from sqlalchemy import text
        date_stats = db.execute(text("SELECT MIN(date) as min_date, MAX(date) as max_date, COUNT(DISTINCT date) as days_count FROM sales_data")).fetchone()
        min_date = date_stats[0] if date_stats else "N/A"
        max_date = date_stats[1] if date_stats else "N/A"
        days_count = date_stats[2] if date_stats else 0

        # Parse horizon from query
        horizon = "month"
        query_lower = query.lower()
        if any(w in query_lower for w in ["week", "hafte", "hafta"]):
            horizon = "week"
        elif any(w in query_lower for w in ["quarter", "teen mahine", "3 month"]):
            horizon = "quarter"

        from app.modules.forecasting.engine import run_forecast

        result = run_forecast(
            db=db,
            horizon=horizon,
        )

        avg_pred = sum(p["predicted"] for p in result["forecast"]) / len(result["forecast"])
        total_pred = int(round(sum(p["predicted"] for p in result["forecast"])))
        mape_val = result['accuracy']['mape']
        mape_info = f"{mape_val}% (14-day holdout backtested)" if mape_val is not None else "Backtesting not applicable (<30 days history)"

        context = (
            f"Data Source: Live PostgreSQL Store Database (sales_data table)\n"
            f"Historical Data Window: {min_date} to {max_date} ({days_count} active days of recorded sales)\n"
            f"Forecast Horizon: {horizon} ({len(result['forecast'])} days)\n"
            f"Average Predicted Daily Sales: {avg_pred:,.1f} units per day\n"
            f"Total Predicted Units: {total_pred:,} units\n"
            f"Forecast Model Used: {result['model_used']}\n"
            f"Demonstrated Accuracy (MAPE): {mape_info}\n"
            f"Insights: {result['insights']}\n"
            f"Festival Impact: {result['festival_impact']}\n"
            f"Inventory Order Suggestion: {result['inventory_suggestion']}"
        )
    except ValueError as e:
        context = f"Data Source: Live PostgreSQL Store Database\nForecasting requirement: {str(e)}"
    except Exception as e:
        context = f"Data Source: Live PostgreSQL Store Database\nForecasting execution error: {str(e)[:150]}"
    finally:
        db.close()

    return {"context": context, "module_used": "forecasting"}

def inventory_node(state: GraphState):
    """Runs inventory analysis on live PostgreSQL products & sales_data (Authoritative Source of Truth)."""
    query = state["query"]
    db = SessionLocal()
    try:
        from sqlalchemy import text
        reorder_query = text("""
            SELECT 
                p.id, p.name, p.sku, p.category, p.current_stock, p.reorder_point, p.unit, p.unit_price,
                COALESCE(SUM(s.quantity_sold), 0) AS units_sold_30d,
                ROUND(COALESCE(SUM(s.quantity_sold)::numeric / 30.0, 0), 2) AS avg_daily_demand,
                CASE WHEN COALESCE(SUM(s.quantity_sold), 0) > 0 
                     THEN ROUND(p.current_stock::numeric / (SUM(s.quantity_sold)::numeric / 30.0), 1)
                     ELSE 999.0 END AS days_left,
                GREATEST(0, p.reorder_point - p.current_stock) AS stock_shortage
            FROM products p
            LEFT JOIN sales_data s ON p.id = s.product_id AND s.date >= (SELECT MAX(date) FROM sales_data) - INTERVAL '30 days'
            GROUP BY p.id, p.name, p.sku, p.category, p.current_stock, p.reorder_point, p.unit, p.unit_price
            ORDER BY CASE WHEN p.current_stock <= p.reorder_point THEN 0 ELSE 1 END, days_left ASC, stock_shortage DESC
            LIMIT 50;
        """)
        result = db.execute(reorder_query)
        columns = list(result.keys())
        rows = [dict(zip(columns, row)) for row in result.fetchall()]

        if not rows:
            context = "Data Source: Live PostgreSQL Store Database (products)\nInventory mein koi products registered nahi hain."
            return {"context": context, "module_used": "inventory"}

        critical_items = [r for r in rows if r["days_left"] <= 3 or r["current_stock"] <= max(1, r["reorder_point"] // 3)]
        low_stock_items = [r for r in rows if (r["current_stock"] <= r["reorder_point"] or r["days_left"] <= 7) and r not in critical_items]
        optimal_items = [r for r in rows if r not in critical_items and r not in low_stock_items]

        lines = [
            "Data Source: Live PostgreSQL Store Database (products & sales_data)",
            f"Total Catalog Products: {len(rows)} across verified categories.",
            f"Critical Stock Items: {len(critical_items)}",
            f"Low Stock Items: {len(low_stock_items)}",
            f"Optimal Stock Items: {len(optimal_items)}",
            "\nRanked Reorder Recommendations (by shortage and demand):"
        ]

        urgent = critical_items + low_stock_items
        if urgent:
            for idx, item in enumerate(urgent, 1):
                urgency = "URGENT / CRITICAL" if item in critical_items else "LOW STOCK"
                lines.append(
                    f"{idx}. [{urgency}] {item['name']} ({item['category']}): "
                    f"Current Stock: {item['current_stock']} {item['unit']} (Reorder Point: {item['reorder_point']} {item['unit']}). "
                    f"Avg Daily Demand: {item['avg_daily_demand']} {item['unit']}/day. "
                    f"Estimated Days Left: {item['days_left']} din. "
                    f"Stock Shortage: {item['stock_shortage']} {item['unit']}."
                )
        else:
            lines.append("Sabhi products ka stock safe reorder thresholds se upar hai! Koi urgent stockout risk nahi hai.")
            lines.append("Top 3 items closest to reorder threshold:")
            for idx, item in enumerate(rows[:3], 1):
                lines.append(
                    f"{idx}. {item['name']}: Current Stock: {item['current_stock']} {item['unit']}, Days left: {item['days_left']} din."
                )

        context = "\n".join(lines)
    except Exception as e:
        context = f"Data Source: Live PostgreSQL Store Database\nInventory analysis error: {str(e)[:150]}"
    finally:
        db.close()

    return {"context": context, "module_used": "inventory"}

def health_node(state: GraphState):
    """Returns Business Health Score."""
    db = SessionLocal()
    try:
        from app.modules.health.scorer import compute_health_score
        health = compute_health_score(db)
        context = (
            f"Data Source: Live PostgreSQL Store Database\n"
            f"Business Health Score: {health['total_score']}/100 — Grade {health['grade']}\n"
            f"{health.get('message', '')}\n"
            f"Components: {health.get('components', {})}\n"
            f"Top Issue: {health.get('top_issue', '')}"
        )
    except Exception as e:
        context = f"Data Source: Live PostgreSQL Store Database\nHealth score error: {str(e)[:80]}"
    finally:
        db.close()
    return {"context": context, "module_used": "health"}

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
                context = f"Data Source: Live PostgreSQL Store Database\n{len(live_alerts)} alerts:\n" + "\n".join(a["message"] for a in live_alerts[:5])
            else:
                context = "Data Source: Live PostgreSQL Store Database\nAbhi koi alert nahi hai. Sab theek hai! ✅"
        else:
            context = f"Data Source: Live PostgreSQL Store Database\n{len(alerts)} unread alerts:\n" + "\n".join(f"• {a.message}" for a in alerts[:5])
    except Exception as e:
        context = f"Data Source: Live PostgreSQL Store Database\nAlerts error: {str(e)[:80]}"
    finally:
        db.close()
    return {"context": context, "module_used": "alerts"}

def synthesize_node(state: GraphState):
    """Uses Groq to generate the final natural language answer grounded in exact facts & Hinglish."""
    query = state["query"]
    context = state.get("context", "")

    prompt = f"""
    You are BusinessGPT, a grounded, accurate, and practical AI business advisor for Indian SME store owners.
    
    CRITICAL FACTUALITY & ACCURACY RULES (MANDATORY & ABSOLUTE):
    1. NEVER INVENT NUMBERS OR FACTS: Never hallucinate, guess, or invent numbers, sales amounts, stock quantities, percentages, product names, or date ranges.
    2. USE EXACT DATA FROM CONTEXT: All numbers, revenue figures, product names, categories, stock levels, and calculations in your response MUST come directly and verbatim from the Context below.
    3. PRODUCT NOT FOUND: If the context states that a product was not found or 0 records matched, state clearly that the product was "Not found" in the store database. DO NOT invent alternative fake products or assume default stock.
    4. SOURCE IDENTIFICATION: Always preserve and state the exact data source mentioned in the context (e.g., "[Source: Live PostgreSQL Store Database (products/sales_data)]" or "[Source: Uploaded Dataset (<table_name>)]").
    5. DATE RANGE TRANSPARENCY: If the available data covers a specific period (e.g. ~79-90 days), report that exact available window. NEVER claim or pretend the data covers 12 months or any unverified time range.
    6. REORDER ADVICE: Only recommend products that are explicitly present in the Context. Never invent sample products or generic placeholders.
    7. FORECAST ACCURACY: Report the genuine model predictions and holdout backtested MAPE from the Context. Never claim fabricated accuracy or constant baseline numbers.
    8. LANGUAGE & SCRIPT:
       - Respond in natural, conversational Hinglish (Latin/Roman alphabet).
       - ABSOLUTELY NO DEVANAGARI SCRIPT (never use Devanagari letters like 'नमस्ते'). Always write phonetically in English letters.
    9. CLEAN TABLE & OUTPUT FORMATTING:
       - When presenting structured lists or comparisons, use clean GitHub-flavored Markdown tables.
       - ALWAYS place an empty blank line before and after any Markdown table.
       - Each table row MUST be on its own separate line (never merge or collapse table rows into a single continuous line).
         Example:
         | Product Name | Current Stock | Reorder Point | Shortage | Days Left |
         |---|---|---|---|---|
         | Fortune Sunflower Oil 1L | 7 | 20 | 13 | 0.9 |
    
    Context:
    {context}
    
    User Query: {query}
    """

    try:
        response = invoke_llm([SystemMessage(content=prompt)], temperature=0.1)
        response_text = response.content

        # Failsafe: Ensure zero Devanagari script appears in output
        if re.search(r'[\u0900-\u097F]', response_text):
            fix_prompt = (
                "Rewrite the following text into conversational HINGLISH written STRICTLY using the ENGLISH / LATIN ALPHABET. "
                "DO NOT USE ANY DEVANAGARI HINDI SCRIPT:\n\n"
                f"{response_text}"
            )
            converted = invoke_llm([SystemMessage(content=fix_prompt)], temperature=0.1)
            if not re.search(r'[\u0900-\u097F]', converted.content):
                response_text = converted.content

        return {"final_response": response_text}
    except RuntimeError as e:
        error_hint = str(e)
        if context and context.strip():
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
    elif intent == "health":
        return "health"
    elif intent == "alerts":
        return "alerts"
    else:
        return "general"

# Build the Graph
workflow = StateGraph(GraphState)

workflow.add_node("classify", classify_node)
workflow.add_node("sql", sql_node)
workflow.add_node("general", general_node)
workflow.add_node("forecasting", forecasting_node)
workflow.add_node("inventory", inventory_node)
workflow.add_node("health", health_node)
workflow.add_node("alerts", alerts_node)
workflow.add_node("synthesize", synthesize_node)

workflow.set_entry_point("classify")

workflow.add_conditional_edges(
    "classify",
    route_intent,
    {
        "sql": "sql",
        "general": "general",
        "forecasting": "forecasting",
        "inventory": "inventory",
        "health": "health",
        "alerts": "alerts",
    }
)

workflow.add_edge("sql", "synthesize")
workflow.add_edge("general", "synthesize")
workflow.add_edge("forecasting", "synthesize")
workflow.add_edge("inventory", "synthesize")
workflow.add_edge("health", "synthesize")
workflow.add_edge("alerts", "synthesize")
workflow.add_edge("synthesize", END)

# Compile graph
app_graph = workflow.compile()
