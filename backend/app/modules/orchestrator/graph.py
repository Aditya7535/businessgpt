from typing import Dict, TypedDict, Any
from langgraph.graph import StateGraph, END
from langchain_core.messages import SystemMessage
from datetime import datetime
import json
import re
from sqlalchemy import text

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
    """General business consultant node for festivals, market trends, advice, and strategy (skips SQL)."""
    current_date = datetime.now().strftime("%B %d, %Y")
    query = state["query"]
    
    # Store summary context (safe and lightweight, no raw SQL query on user input)
    store_context = "Store Profile: Indian Retail / Grocery & FMCG SME Store"
    db = SessionLocal()
    try:
        from sqlalchemy import text
        cat_rows = db.execute(text("SELECT DISTINCT category FROM products LIMIT 10")).fetchall()
        if cat_rows:
            categories = [r[0] for r in cat_rows if r[0]]
            store_context += f"\nActive Store Categories: {', '.join(categories)}"
    except Exception:
        pass
    finally:
        db.close()

    context = (
        f"Mode: General Business Consultant & Market Intelligence (No SQL needed)\n"
        f"Current Date: {current_date}\n"
        f"{store_context}\n"
        f"Topic: General business advice, upcoming festivals, market trends, pricing, or growth strategy.\n"
        f"User Query: {query}"
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
        is_sqlite = db.bind.dialect.name == "sqlite"
        if is_sqlite:
            reorder_query = text("""
                SELECT 
                    p.id, p.name, p.sku, p.category, p.current_stock, p.reorder_point, p.unit, p.unit_price,
                    COALESCE(SUM(s.quantity_sold), 0) AS units_sold_30d,
                    ROUND(COALESCE(SUM(s.quantity_sold) * 1.0 / 30.0, 0), 2) AS avg_daily_demand,
                    CASE WHEN COALESCE(SUM(s.quantity_sold), 0) > 0 
                         THEN ROUND(p.current_stock * 1.0 / (SUM(s.quantity_sold) * 1.0 / 30.0), 1)
                         ELSE 999.0 END AS days_left,
                    MAX(0, p.reorder_point - p.current_stock) AS stock_shortage
                FROM products p
                LEFT JOIN sales_data s ON p.id = s.product_id AND s.date >= date((SELECT MAX(date) FROM sales_data), '-30 days')
                GROUP BY p.id, p.name, p.sku, p.category, p.current_stock, p.reorder_point, p.unit, p.unit_price
                ORDER BY CASE WHEN p.current_stock <= p.reorder_point THEN 0 ELSE 1 END, days_left ASC, stock_shortage DESC
                LIMIT 50;
            """)
        else:
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
    """Uses Groq to generate a smart, consultative business co-pilot response in friendly Hinglish."""
    current_date = datetime.now().strftime("%B %d, %Y")
    query = state["query"]
    context = state.get("context", "")

    prompt = f"""You are BusinessGPT — an intelligent AI business consultant for Indian SME owners. You have access to the owner's live store data (sales, inventory, bills) via SQL queries.

Current Date: {current_date}

For questions where store data is available:
→ Clearly cite the authoritative data source in your answer (e.g., 'Data Source: Live Store Database' or 'Store database records ke mutabik').
→ Use the data AND explain what it means in practical business terms.
→ Provide actionable insights, highlight key numbers clearly, and use clean markdown tables or bullet points when helpful.

For questions where a queried product was not found in the store database (0 matching items):
→ Explicitly state that the product was not found in the database records (e.g. 'Store database mein is product ka koi record nahi mila' or 'Product not found in database').

For general business questions (festivals, market trends, advice, pricing):
→ Use your own knowledge to give helpful answers
→ Connect it to their business context (Indian retail / FMCG / SME store)
→ Include current date context ({current_date}) so you know which festivals and seasons are coming up right now.

You speak in friendly Hinglish.
Always write phonetically in the English / Latin alphabet (never use Devanagari script).

Examples:
Q: "aane waala festival konsa h?"
A: "Diwali 20 October ko hai — abhi 5 din baad! Pichle festive seasons mein FMCG products ki demand 30-40% badhti hai. Aapka current stock check karke bata sakta hoon ki kya order karna chahiye — poochho?"

Q: "market mein kya trend chal raha h?"
A: "Abhi India mein healthy snacks, sugar-free products aur organic items ka trend strong hai. Aapke current product mix mein yeh categories hain kya?"

Q: "sales kaise badhaye?"
A: "Sales badhane ke liye 3 practical strategies hain:
1. Festive Bundling: High-margin items ko fast-moving items ke saath combo banayein.
2. Fast-Selling Stock: Top products hamesha in-stock rakhein taaki customer wapas na jaye.
3. WhatsApp Loyalty: Regular customers ko naye offers aur arrival alerts bhejein.
Aapke store ka top-selling item check karein?"

Context:
{context}

User Query: {query}
"""

    try:
        response = invoke_llm([SystemMessage(content=prompt)], temperature=0.3)
        response_text = response.content

        # Failsafe: Ensure zero Devanagari script appears in output
        if re.search(r'[\u0900-\u097F]', response_text):
            fix_prompt = (
                f"Today's Date: {current_date}\n\n"
                "Rewrite the following text into conversational HINGLISH written STRICTLY using the ENGLISH / LATIN ALPHABET. "
                "DO NOT USE ANY DEVANAGARI HINDI SCRIPT:\n\n"
                f"{response_text}"
            )
            converted = invoke_llm([SystemMessage(content=fix_prompt)], temperature=0.2)
            if not re.search(r'[\u0900-\u097F]', converted.content):
                response_text = converted.content

        return {"final_response": response_text}
    except RuntimeError as e:
        error_hint = str(e)
        if context and context.strip():
            fallback = (
                f"Data Source: Live Store Database\n\n"
                f"{context}\n\n"
                f"(Note: AI response generation temporarily rate-limited: {error_hint})"
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
