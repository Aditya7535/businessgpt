import re
import logging
from typing import Dict, Any, List
from sqlalchemy import text
from langchain_core.messages import SystemMessage, HumanMessage

from app.core.database import SessionLocal
from app.modules.orchestrator.llm import invoke_llm
from app.modules.text_to_sql.schema import DB_SCHEMA_PROMPT, build_schema_prompt
from app.services.dataset_table import get_all_uploaded_tables_metadata

logger = logging.getLogger("businessgpt.text_to_sql")

FORBIDDEN_KEYWORDS = ["DROP", "DELETE", "TRUNCATE", "UPDATE", "INSERT", "ALTER", "CREATE", "REPLACE", "EXEC", "EXECUTE"]

def clean_sql(raw_sql: str) -> str:
    """Clean markdown code fences and extraneous text from LLM SQL output."""
    clean = re.sub(r'```sql|```', '', raw_sql).strip()
    # Strip any text before SELECT
    select_match = re.search(r'\bSELECT\b', clean, re.IGNORECASE)
    if select_match:
        clean = clean[select_match.start():]
    # Strip trailing semicolons or explanations
    clean = clean.split(';')[0].strip()
    return clean

def is_safe_select(sql: str) -> bool:
    """Ensure SQL query is strictly a read-only SELECT statement."""
    upper = sql.upper().strip()
    if not upper.startswith("SELECT"):
        return False
    for kw in FORBIDDEN_KEYWORDS:
        if re.search(r'\b' + kw + r'\b', upper):
            return False
    return True

def fix_ilike_product_search(sql: str) -> str:
    """
    Ensures product name, category, and sku searches use ILIKE '%...%'
    instead of exact '=' or case-sensitive 'LIKE'.
    Also normalizes common column alias mistakes on products table (e.g. price -> unit_price, reorder_level -> reorder_point).
    """
    if not sql:
        return sql

    # Replace exact '=' with ILIKE '%...%' for product fields
    pattern = r"\b((?:[a-zA-Z_]+\.)?(?:name|product_name|category|sku))\s*=\s*'([^']+)'"
    sql = re.sub(pattern, r"\1 ILIKE '%\2%'", sql, flags=re.IGNORECASE)

    # Convert standard LIKE to ILIKE for PostgreSQL case insensitivity
    sql = re.sub(r"\bLIKE\b", "ILIKE", sql)

    # Correct common column typos on products table
    # products.price -> products.unit_price (when referencing products table)
    sql = re.sub(r"\bproducts\.price\b", "products.unit_price", sql, flags=re.IGNORECASE)
    sql = re.sub(r"\bp\.price\b", "p.unit_price", sql, flags=re.IGNORECASE)
    sql = re.sub(r"\bproducts\.reorder_level\b", "products.reorder_point", sql, flags=re.IGNORECASE)
    sql = re.sub(r"\bp\.reorder_level\b", "p.reorder_point", sql, flags=re.IGNORECASE)
    sql = re.sub(r"\bproducts\.stock\b", "products.current_stock", sql, flags=re.IGNORECASE)
    sql = re.sub(r"\bp\.stock\b", "p.current_stock", sql, flags=re.IGNORECASE)

    return sql


def detect_sql_source(sql: str, db=None) -> str:
    """Identify whether the query targets live store tables or uploaded datasets."""
    upper = sql.upper()
    # Check for uploaded dataset tables
    uploaded_match = re.search(r'\b(uploaded_\d+_[a-zA-Z0-9_]+)\b', sql, re.IGNORECASE)
    if uploaded_match:
        tbl_name = uploaded_match.group(1).lower()
        fname = ""
        if db:
            try:
                from app.models.dataset import Dataset
                ds = db.query(Dataset).filter(Dataset.table_name == tbl_name).first()
                if ds:
                    fname = f" from {ds.filename}"
            except Exception:
                pass
        return f"Uploaded Dataset ({tbl_name}{fname})"

    if "PRODUCTS" in upper or "SALES_DATA" in upper or "BILLS" in upper or "STOCK_TRANSACTIONS" in upper:
        return "Live PostgreSQL Store Database (products / sales_data)"

    return "PostgreSQL Database"


def generate_fallback_sql(query: str, db=None) -> str:
    """Template fallback when LLM is unavailable."""
    q = query.lower()

    # 1. Category counts
    if "category" in q and ("count" in q or "kitne" in q or "how many" in q or "breakdown" in q or "wise" in q):
        tbl_match = re.search(r'\b(uploaded_\d+_[a-zA-Z0-9_]+)\b', q)
        if tbl_match:
            return f"SELECT category, COUNT(*) AS product_count FROM {tbl_match.group(1)} GROUP BY category ORDER BY product_count DESC;"
        return "SELECT category, COUNT(*) AS product_count FROM products GROUP BY category ORDER BY product_count DESC;"

    # 2. Date / Month specific revenue and sales aggregations (e.g., August 2026, 2026-08)
    month_days = {
        "january": ("01", "31"), "february": ("02", "28"), "march": ("03", "31"),
        "april": ("04", "30"), "may": ("05", "31"), "june": ("06", "30"),
        "july": ("07", "31"), "august": ("08", "31"), "september": ("09", "30"),
        "october": ("10", "31"), "november": ("11", "30"), "december": ("12", "31")
    }
    year_match = re.search(r'\b(202\d)\b', q)
    year = year_match.group(1) if year_match else "2026"
    for mname, (m_num, last_day) in month_days.items():
        if mname in q:
            start_date = f"{year}-{m_num}-01"
            end_date = f"{year}-{m_num}-{last_day}"
            return f"SELECT COALESCE(SUM(revenue), 0) as total_revenue, COALESCE(SUM(quantity_sold), 0) as total_units, COALESCE(SUM(revenue - cost), 0) as gross_profit FROM sales_data WHERE date >= '{start_date}' AND date <= '{end_date}';"

    # 3. Check if query references uploaded dataset
    if "uploaded" in q or "csv" in q or "dataset" in q or "file" in q:
        tbl_match = re.search(r'\b(uploaded_\d+_[a-zA-Z0-9_]+)\b', q)
        if tbl_match:
            tname = tbl_match.group(1)
            if "category" in q:
                return f"SELECT category, COUNT(*) as product_count FROM {tname} GROUP BY category ORDER BY product_count DESC;"
            if "how many" in q or "count" in q or "rows" in q:
                return f"SELECT COUNT(*) AS total_rows FROM {tname};"
            return f"SELECT * FROM {tname} LIMIT 10;"
        try:
            tables = get_all_uploaded_tables_metadata(db)
            if tables:
                latest_tbl = tables[-1]
                tname = latest_tbl["table_name"]
                cols = [c["column"] for c in latest_tbl["columns"]]
                if "category" in q and "category" in cols:
                    return f"SELECT category, COUNT(*) as product_count FROM {tname} GROUP BY category ORDER BY product_count DESC;"
                if "how many" in q or "count" in q or "rows" in q or "kitne" in q:
                    return f"SELECT COUNT(*) AS total_rows FROM {tname};"
                rev_col = next((c for c in cols if "rev" in c or "sales" in c or "amount" in c), None)
                if rev_col:
                    return f"SELECT COALESCE(SUM({rev_col}), 0) AS total_{rev_col}, COUNT(*) AS total_records FROM {tname};"
                return f"SELECT * FROM {tname} LIMIT 10;"
        except Exception:
            pass

    # 4. Check for specific product lookup in products table
    # Pattern 1: "<product_name> ka stock / price / kitna"
    # Pattern 2: "stock / price of <product_name>"
    prod_pat = re.search(r'(?:what is the\s+)?(?:stock|price|rate|mrp|cost|keemat|kimat)\s+(?:of|for)\s+([a-zA-Z0-9_\-\s]+?)(?:\?|$|\s+in\b|\s+at\b)', q)
    if not prod_pat:
        prod_pat = re.search(r'([a-zA-Z0-9_\-]+)\s+(?:ka|ki|ke)?\s*(?:stock|price|rate|mrp|cost|keemat|kimat|bhav)(?:\s+kitna|\s+kitne|\s+kya|\s+hai|\?|$)', q)

    if prod_pat:
        target = prod_pat.group(1).strip()
        stop_words = {"total", "kul", "sab", "all", "low", "critical", "kam", "out of", "store", "aaj", "today", "month", "mahina", "category", "product", "products", "item", "items"}
        if target and target.lower() not in stop_words and len(target) > 2:
            if any(p in q for p in ["price", "rate", "cost", "keemat", "kimat", "mrp", "bhav"]):
                return f"SELECT name, unit_price FROM products WHERE name ILIKE '%{target}%' LIMIT 50;"
            else:
                return f"SELECT name, current_stock, unit, reorder_point FROM products WHERE name ILIKE '%{target}%' LIMIT 50;"

    for term in ["colgate", "basmati", "tata salt", "sunflower oil", "fortune", "atta", "maggi", "parle", "bhujia", "dettol", "amul", "surf excel"]:
        if term in q:
            if any(p in q for p in ["price", "rate", "cost", "keemat", "kimat", "mrp"]):
                return f"SELECT name, unit_price FROM products WHERE name ILIKE '%{term}%' LIMIT 50;"
            elif any(s in q for s in ["stock", "quantity", "bacha", "available"]):
                return f"SELECT name, current_stock, unit, reorder_point FROM products WHERE name ILIKE '%{term}%' LIMIT 50;"
            else:
                return f"SELECT id, name, sku, category, unit_price, current_stock, reorder_point, unit FROM products WHERE name ILIKE '%{term}%' LIMIT 50;"

    # 5. Critical / low stock queries (when no specific product was asked)
    if "critical" in q or "low stock" in q or "kam stock" in q:
        return """
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
        """.strip()

    # 6. Total revenue / sales aggregations
    if "total revenue" in q or "kul kamai" in q or "bikri" in q or "sales" in q or "revenue" in q:
        if "today" in q or "aaj" in q:
            return "SELECT COALESCE(SUM(revenue), 0) as total_revenue, COALESCE(SUM(quantity_sold), 0) as total_units FROM sales_data WHERE date = (SELECT MAX(date) FROM sales_data);"
        if "month" in q or "mahine" in q:
            return "SELECT COALESCE(SUM(revenue), 0) as total_revenue, COALESCE(SUM(quantity_sold), 0) as total_units FROM sales_data WHERE date >= (SELECT MAX(date) FROM sales_data) - INTERVAL '30 days';"
        return "SELECT MIN(date) as from_date, MAX(date) as to_date, COALESCE(SUM(revenue), 0) as total_revenue, COALESCE(SUM(quantity_sold), 0) as total_units, COALESCE(SUM(revenue - cost), 0) as gross_profit FROM sales_data;"
    elif "slow" in q or "kam bik raha" in q:
        return "SELECT p.name, p.category, COALESCE(SUM(s.quantity_sold), 0) as units_sold FROM products p LEFT JOIN sales_data s ON p.id = s.product_id WHERE s.date >= (SELECT MAX(date) FROM sales_data) - INTERVAL '30 days' GROUP BY p.id, p.name, p.category ORDER BY units_sold ASC LIMIT 5;"
    elif "top" in q or "zyada" in q or "best" in q:
        return "SELECT p.name, p.category, COALESCE(SUM(s.revenue), 0) as total_revenue, COALESCE(SUM(s.quantity_sold), 0) as units_sold FROM products p JOIN sales_data s ON p.id = s.product_id WHERE s.date >= (SELECT MAX(date) FROM sales_data) - INTERVAL '30 days' GROUP BY p.id, p.name, p.category ORDER BY total_revenue DESC LIMIT 5;"
    elif "stock" in q:
        return "SELECT name, current_stock, reorder_point, unit_price FROM products WHERE current_stock <= reorder_point ORDER BY current_stock ASC;"

    return "SELECT MIN(date) as from_date, MAX(date) as to_date, COALESCE(SUM(revenue), 0) as total_revenue, COALESCE(SUM(quantity_sold), 0) as total_units, COALESCE(SUM(revenue - cost), 0) as gross_profit FROM sales_data;"


def adapt_sql_for_dialect(sql: str, db) -> str:
    """Adapts PostgreSQL-specific syntax to SQLite if running on SQLite."""
    if not sql:
        return sql
    try:
        bind = getattr(db, "bind", None)
        dialect = bind.dialect.name if bind and hasattr(bind, "dialect") else "postgresql"
    except Exception:
        dialect = "postgresql"

    if dialect == "sqlite":
        # 1. ILIKE -> LIKE
        sql = re.sub(r"\bILIKE\b", "LIKE", sql, flags=re.IGNORECASE)
        # 2. Type casting ::type
        sql = re.sub(r"::\s*[a-zA-Z_]+", "", sql)
        # 3. GREATEST -> MAX
        sql = re.sub(r"\bGREATEST\b", "MAX", sql, flags=re.IGNORECASE)
        # 4. (SELECT MAX(...) FROM ...) - INTERVAL 'X days' -> date((SELECT MAX(...) FROM ...), '-X days')
        sql = re.sub(
            r'([><=]+)\s*\(\s*SELECT\s+MAX\(([a-zA-Z0-9_\.]+)\)\s+FROM\s+([a-zA-Z0-9_\.]+)\s*\)\s*-\s*INTERVAL\s*\'(\d+)\s*days?\'',
            r"\1 date((SELECT MAX(\2) FROM \3), '-\4 days')",
            sql,
            flags=re.IGNORECASE
        )
        # 5. CURRENT_DATE / NOW() - INTERVAL 'X days' -> date('now', '-X days')
        sql = re.sub(
            r'([><=]+)\s*(?:CURRENT_DATE|NOW\(\)|CURRENT_TIMESTAMP)\s*-\s*INTERVAL\s*\'(\d+)\s*days?\'',
            r"\1 date('now', '-\2 days')",
            sql,
            flags=re.IGNORECASE
        )
        # 6. column - INTERVAL 'X days' -> date(column, '-X days')
        sql = re.sub(
            r'([><=]+)\s*([a-zA-Z0-9_\.]+)\s*-\s*INTERVAL\s*\'(\d+)\s*days?\'',
            r"\1 date(\2, '-\3 days')",
            sql,
            flags=re.IGNORECASE
        )
        # 7. Generic fallback for any remaining INTERVAL
        sql = re.sub(r"\s*-\s*INTERVAL\s*'(\d+)\s*days?'", r" - \1", sql, flags=re.IGNORECASE)
    return sql


def run_text_to_sql(user_query: str) -> Dict[str, Any]:
    """
    Complete pipeline:
    1. NL query -> LLM SQL generation (with dynamic uploaded dataset schemas)
    2. Verification & Safety Checks
    3. PostgreSQL execution in milliseconds
    4. Hinglish answer synthesis with verified tabular representation & data source attribution
    """
    db = SessionLocal()
    sql_generated = ""
    source_name = "Live PostgreSQL Store Database (products / sales_data)"

    try:
        schema_prompt = build_schema_prompt(db)
        prompt = (
            f"{schema_prompt}\n\n"
            f"Generate PostgreSQL query for this user question:\n"
            f"'{user_query}'\n\nSQL:"
        )

        try:
            llm_response = invoke_llm([HumanMessage(content=prompt)], temperature=0.0)
            sql_generated = clean_sql(llm_response.content)
            sql_generated = fix_ilike_product_search(sql_generated)
        except Exception as e:
            logger.warning(f"LLM SQL generation fallback used: {e}")
            sql_generated = generate_fallback_sql(user_query, db=db)

        if not is_safe_select(sql_generated):
            sql_generated = generate_fallback_sql(user_query, db=db)

        # Enforce ILIKE and schema corrections on final query
        sql_generated = fix_ilike_product_search(sql_generated)
        source_name = detect_sql_source(sql_generated, db=db)

        # Print the generated SQL query to terminal logs so we can see what query is being generated
        print(f"\n[Text-to-SQL] Source: {source_name} | SQL: {sql_generated}\n", flush=True)
        logger.info(f"[Text-to-SQL] User Query: {user_query} | Source: {source_name} | Generated SQL: {sql_generated}")

        # Adapt SQL for SQLite if applicable and execute query safely
        sql_to_run = adapt_sql_for_dialect(sql_generated, db)
        result = db.execute(text(sql_to_run))
        columns = list(result.keys()) if result.returns_rows else []
        rows = [dict(zip(columns, row)) for row in result.fetchall()] if result.returns_rows else []

        # Format answer strictly with source attribution
        formatted_answer = synthesize_sql_answer(user_query, sql_generated, rows, source=source_name)

        return {
            "query": user_query,
            "sql": sql_generated,
            "columns": columns,
            "data": rows,
            "source": source_name,
            "answer": formatted_answer,
            "module": "SQL"
        }

    except Exception as e:
        logger.error(f"Text-to-SQL error: {e}", exc_info=True)
        # Report the actual database error rather than fabricating an answer
        error_msg = str(e).split("\n")[0]
        return {
            "query": user_query,
            "sql": sql_generated or "N/A",
            "columns": [],
            "data": [],
            "source": source_name,
            "error": error_msg,
            "answer": f"**Source:** {source_name}\n\n⚠️ Database query run karne mein error aaya:\n`{error_msg}`\nPlease query dubara check karein.",
            "module": "SQL"
        }
    finally:
        db.close()


def synthesize_sql_answer(query: str, sql: str, rows: List[Dict[str, Any]], source: str = "Live PostgreSQL Store Database (products / sales_data)") -> str:
    """Convert SQL result rows into crisp Hinglish answer with currency formatting and source attribution."""
    source_header = f"**Source:** {source}"

    if not rows:
        # Check if the query looked for a specific product name
        prod_match = re.search(r"(?:ILIKE|LIKE)\s+'%([^%']+)%'", sql, re.IGNORECASE)
        if prod_match:
            searched_item = prod_match.group(1)
            return (
                f"{source_header}\n\n"
                f"🔍 Product \"{searched_item}\" database mein nahi mila (0 matching records).\n"
                f"Please verify karein ki product catalog ya inventory mein add hai ya nahi."
            )
        return f"{source_header}\n\nIs query ke liye database mein koi records nahi mile (0 matching rows)."

    # Single numerical aggregate result
    if len(rows) == 1 and len(rows[0]) <= 5:
        row = rows[0]
        parts = []
        for k, v in row.items():
            k_clean = k.replace("_", " ").title()
            if isinstance(v, (int, float)):
                if any(curr in k.lower() for curr in ["revenue", "sales", "price", "cost", "profit", "margin", "amount"]):
                    parts.append(f"{k_clean}: ₹{v:,.2f}")
                else:
                    parts.append(f"{k_clean}: {v:,}")
            elif v is not None:
                parts.append(f"{k_clean}: {v}")
            else:
                parts.append(f"{k_clean}: N/A")
        return f"{source_header}\n\nDatabase query result:\n\n**{' | '.join(parts)}**"

    # Multi-row tabular response
    lines = [f"{source_header}\n\nAapke sawaal ka exact PostgreSQL data ({len(rows)} records):"]
    for idx, r in enumerate(rows[:15], 1):
        row_parts = []
        for k, v in r.items():
            label = k.replace('_', ' ')
            if isinstance(v, (int, float)):
                if any(curr in k.lower() for curr in ["revenue", "sales", "price", "cost", "profit", "amount"]) and "count" not in k.lower() and "quantity" not in k.lower() and "stock" not in k.lower():
                    row_parts.append(f"{label}: ₹{v:,.2f}")
                else:
                    row_parts.append(f"{label}: {v}")
            elif v is not None:
                row_parts.append(f"{label}: {v}")
        lines.append(f"{idx}. {', '.join(row_parts)}")

    if len(rows) > 15:
        lines.append(f"\n*(Showing top 15 of {len(rows)} total records)*")

    return "\n".join(lines)
