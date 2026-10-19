from typing import Optional
from sqlalchemy.orm import Session
from app.services.dataset_table import get_all_uploaded_tables_metadata

BASE_DB_SCHEMA = """
You are an expert PostgreSQL DBA and data analyst for BusinessGPT (Indian SME POS & BI system).
Generate ONLY a valid SQL SELECT query to answer the user's question.
Do NOT output markdown backticks, explanations, or any other text. Output ONLY the raw SQL query.

DOCUMENTED SOURCE OF TRUTH:
1. LIVE STORE INVENTORY & CATALOG (Primary authoritative source for current stock, prices, and categories):
   Table: products (
       id SERIAL PRIMARY KEY,
       name VARCHAR(150),         -- Exact product name (e.g. 'Basmati Rice 5kg')
       sku VARCHAR(50),           -- Stock keeping unit (e.g. 'GROC-001')
       category VARCHAR(50),      -- Category (e.g. 'Grocery', 'Snacks', 'Dairy', 'Personal Care', 'Household')
       unit_price FLOAT,          -- Selling price in INR (e.g. 450.0). NOTE: Column is `unit_price`, NOT `price`.
       current_stock INT,         -- Current in-store physical inventory. NOTE: Column is `current_stock`, NOT `stock`.
       reorder_point INT,         -- Minimum threshold before restock. NOTE: Column is `reorder_point`, NOT `reorder_level`.
       unit VARCHAR(20)           -- Packaging unit (e.g. 'pack', 'ltr', 'pcs')
   )

2. LIVE STORE SALES TRANSACTIONS (Pre-aggregated daily sales):
   Table: sales_data (
       id SERIAL PRIMARY KEY,
       product_id INT REFERENCES products(id),
       date DATE,                 -- Transaction date
       quantity_sold INT,         -- Units sold on this date
       revenue FLOAT,             -- Gross revenue in INR (quantity_sold * unit_price)
       cost FLOAT                 -- Wholesale cost in INR (quantity_sold * cost_price)
   )
   METRICS RULES:
   * Total Revenue: SUM(revenue)
   * Total Units Sold: SUM(quantity_sold)
   * Total Gross Profit: SUM(revenue - cost)
   * Net Margin %: (SUM(revenue - cost) / NULLIF(SUM(revenue), 0)) * 100

3. POINT OF SALE (POS) BILLS:
   Table: bills (
       id SERIAL PRIMARY KEY,
       bill_number VARCHAR(50),
       employee_id INT,
       total_amount FLOAT,
       tax_amount FLOAT,
       payment_method VARCHAR(20),  -- 'Cash', 'UPI', 'Card'
       status VARCHAR(20),          -- 'COMPLETED'
       created_at TIMESTAMP
   )

4. BILL ITEMS:
   Table: bill_items (
       id SERIAL PRIMARY KEY,
       bill_id INT REFERENCES bills(id),
       product_id INT REFERENCES products(id),
       quantity INT,
       unit_price FLOAT,
       subtotal FLOAT
   )

5. STOCK AUDIT TRANSACTIONS:
   Table: stock_transactions (
       id SERIAL PRIMARY KEY,
       product_id INT REFERENCES products(id),
       type VARCHAR(20),  -- 'SALE', 'PURCHASE', 'ADJUSTMENT'
       quantity INT,
       before_stock INT,
       after_stock INT,
       timestamp TIMESTAMP
   )
"""

RULES_PROMPT = """
RULES & QUERY GUIDELINES:
1. SAFE READ-ONLY SELECT:
   - Return ONLY read-only SELECT queries. NEVER generate INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE.

2. SOURCE ATTRIBUTION:
   - For live store questions (stock, price, current catalog, reorder): ALWAYS query `products` and `sales_data`.
   - For uploaded files or datasets: Query the specific `uploaded_*` table matching the user's file.

3. PRODUCT & CATEGORY SEARCH (CASE-INSENSITIVE):
   - For product names or categories, ALWAYS use case-insensitive ILIKE with wildcards:
     Example: WHERE name ILIKE '%Colgate%'
     NEVER use '=' like `WHERE name = 'Colgate'`.

4. CATEGORY & PRODUCT COUNTS:
   - To count products per category from live inventory:
     SELECT category, COUNT(*) AS product_count FROM products GROUP BY category ORDER BY category;
   - Do NOT join with sales_data when counting catalog products, as products without sales would be dropped!

5. REORDER RECOMMENDATIONS (DEMAND + SHORTAGE RANKING):
   - When asked what to reorder, restock, or which items are low in stock:
     Join `products` and `sales_data` to compute demand and shortage:
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

6. EXPLICIT DATE FILTERING:
   - When asked for a specific month or date window, use explicit bounds:
     * August 2026: WHERE date >= DATE '2026-08-01' AND date <= DATE '2026-08-31'
     * Last 30 days: WHERE date >= (SELECT MAX(date) FROM sales_data) - INTERVAL '30 days'
     * Last 7 days: WHERE date >= (SELECT MAX(date) FROM sales_data) - INTERVAL '7 days'
   - Include MIN(date) and MAX(date) when doing open-ended aggregations so the actual date coverage is explicit.

7. LIMIT RESULTS:
   - Always add `LIMIT 50` on list queries to prevent oversized responses.
"""


def build_schema_prompt(db: Optional[Session] = None) -> str:
    """Build dynamic schema prompt incorporating standard tables and uploaded CSV/Excel tables."""
    prompt_parts = [BASE_DB_SCHEMA.strip()]

    try:
        uploaded_meta = get_all_uploaded_tables_metadata(db)
        if uploaded_meta:
            prompt_parts.append("\nUPLOADED DATASET TABLES (Historical snapshots & user-uploaded spreadsheets):")
            for idx, item in enumerate(uploaded_meta, start=6):
                tname = item["table_name"]
                fname = item["filename"]
                rc = item.get("row_count")
                rc_str = f" ({rc} records)" if rc else ""
                col_defs = ",\n    ".join([f"{c['column']} {c['type']}" for c in item["columns"]])
                prompt_parts.append(f"\n{idx}. {tname} (\n    -- Source File: {fname}{rc_str}\n    -- Note: Historical snapshot, not live POS\n    {col_defs}\n)")
    except Exception:
        pass

    prompt_parts.append(RULES_PROMPT.strip())
    return "\n\n".join(prompt_parts)


# Default static prompt fallback
DB_SCHEMA_PROMPT = build_schema_prompt()
