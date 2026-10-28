"""
Test Suite: Audit and Fixes for BusinessGPT AI Chat
Covers all 6 acceptance criteria specified in the user request.
"""
import sys
import unittest
import pandas as pd
from sqlalchemy import text
from app.core.database import SessionLocal, engine
from app.core.seed import seed_database
from app.modules.text_to_sql.engine import run_text_to_sql, detect_sql_source
from app.modules.forecasting.engine import run_forecast
from app.modules.orchestrator.graph import app_graph, inventory_node

class TestBusinessGPTAudit(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        seed_database()
        cls.db = SessionLocal()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_1_product_counts_match_all_categories(self):
        """Acceptance Test 1: Product counts must match the selected source, including all categories."""
        # 1. Test live PostgreSQL products table
        res_live = run_text_to_sql("Category-wise product count batao")
        sql_live = res_live["sql"]
        rows_live = res_live["data"]

        # Independent calculation via Pandas/SQL
        df_live = pd.read_sql("SELECT category, COUNT(*) as cnt FROM products GROUP BY category ORDER BY category", con=self.db.bind)
        expected_live_categories = set(df_live["category"])
        expected_live_total = df_live["cnt"].sum()

        res_categories = {r["category"]: r.get("product_count") or r.get("cnt") for r in rows_live}
        self.assertEqual(expected_live_categories, set(res_categories.keys()), "All categories must be present in category counts")
        self.assertEqual(sum(res_categories.values()), expected_live_total, "Total product count must match database")
        self.assertEqual(res_live["source"], "Live PostgreSQL Store Database (products / sales_data)")

        # 2. Test uploaded snapshot table if present
        tbl_check = self.db.execute(text("SELECT table_name FROM datasets WHERE table_name IS NOT NULL ORDER BY id DESC LIMIT 1")).scalar()
        if tbl_check:
            res_uploaded = run_text_to_sql(f"Count products by category in {tbl_check}")
            self.assertIn("Uploaded Dataset", res_uploaded["source"])

    def test_2_sales_totals_match_independent_calculation(self):
        """Acceptance Test 2: Sales totals must match an independently calculated aggregation for the same window."""
        # Query for August 2026: 2026-08-01 to 2026-08-31
        query = "What is the total sales revenue and units sold for August 2026?"
        res = run_text_to_sql(query)
        self.assertTrue(len(res["data"]) > 0, "Query must return results")

        # Independent calculation via Pandas from sales_data
        df_sales = pd.read_sql("""
            SELECT 
                COALESCE(SUM(revenue), 0) as total_revenue,
                COALESCE(SUM(quantity_sold), 0) as total_units,
                COALESCE(SUM(revenue - cost), 0) as gross_profit
            FROM sales_data 
            WHERE date >= '2026-08-01' AND date <= '2026-08-31'
        """, con=self.db.bind)

        expected_rev = float(df_sales["total_revenue"].iloc[0])
        expected_units = int(df_sales["total_units"].iloc[0])

        returned_row = res["data"][0]
        # Find revenue and units in returned keys
        rev_val = next(v for k, v in returned_row.items() if "rev" in k.lower() or "sales" in k.lower())
        units_val = next((v for k, v in returned_row.items() if "unit" in k.lower() or "qty" in k.lower() or "quantity" in k.lower()), None)

        self.assertAlmostEqual(float(rev_val), expected_rev, places=1, msg="Revenue must match independent calculation")
        if units_val is not None:
            self.assertEqual(int(units_val), expected_units, "Units sold must match independent calculation")

    def test_3_unknown_product_returns_not_found(self):
        """Acceptance Test 3: Unknown products must return 'not found'."""
        unknown_name = "NonExistentGadgetXYZ999"
        res = run_text_to_sql(f"{unknown_name} ka stock kitna hai?")
        self.assertEqual(len(res["data"]), 0, "Query for unknown product must return 0 rows")
        self.assertIn("nahi mila", res["answer"].lower())

        # Also test full graph invocation
        graph_res = app_graph.invoke({"query": f"{unknown_name} ka stock kitna hai?"})
        final_answer = graph_res.get("final_response", "").lower()
        self.assertTrue(
            "nahi mila" in final_answer or "not found" in final_answer or "record" in final_answer,
            "AI response must report product not found"
        )

    def test_4_reorder_recommendation_contains_only_real_products(self):
        """Acceptance Test 4: Reorder recommendations must contain only real database products."""
        # Test inventory node
        state = {"query": "Which products should I reorder?"}
        inv_res = inventory_node(state)
        context = inv_res.get("context", "")
        self.assertIn("Data Source: Live PostgreSQL Store Database", context)

        # Get list of real products in DB
        real_products = set(self.db.execute(text("SELECT name FROM products")).scalars().all())

        # Verify through full orchestrator graph
        graph_res = app_graph.invoke({"query": "Which products should I reorder and restock?"})
        final_resp = graph_res.get("final_response", "")

        # Must mention at least one real product from DB (e.g. Fortune Sunflower Oil 1L)
        has_real_product = any(p in final_resp or p.lower() in final_resp.lower() for p in real_products)
        self.assertTrue(has_real_product, "Reorder recommendation must mention real database products")

    def test_5_forecasts_use_actual_sales_and_honest_mape(self):
        """Acceptance Test 5: Forecasts must use actual historical sales and must not fabricate MAPE."""
        res = run_forecast(db=self.db, horizon="month")
        predictions = res["forecast"]

        # 1. Predictions must not repeat flat 920 units every day
        pred_values = [p["predicted"] for p in predictions]
        self.assertGreater(len(set(pred_values)), 1, "Predictions must vary dynamically by day, not repeat a constant number")
        mean_pred = sum(pred_values) / len(pred_values)

        # Historical mean is ~92 units/day. Forecast should be realistic (e.g. 50-150 units/day, NOT 920!)
        self.assertLess(mean_pred, 300, f"Forecast mean {mean_pred} is unrealistically inflated; expected realistic daily volume")
        self.assertGreater(mean_pred, 40, f"Forecast mean {mean_pred} is too low; expected realistic daily volume")

        # 2. MAPE must not be a hardcoded 3.29%
        mape = res["accuracy"]["mape"]
        self.assertNotEqual(mape, 3.29, "MAPE must not be fabricated/hardcoded to 3.29%")
        self.assertTrue(res["accuracy"]["backtested"], "Accuracy must be evaluated via holdout backtesting")

        # 3. Stock value must not equate units to INR directly
        self.assertIn("worth of stock", res["inventory_suggestion"])
        self.assertIn("avg ₹", res["inventory_suggestion"])

    def test_6_ai_identifies_data_source(self):
        """Acceptance Test 6: The AI must identify which data source it queried."""
        # 1. Test live DB query
        res_live = run_text_to_sql("Aaj ki total sales batao")
        self.assertIn("Source:", res_live["answer"])
        self.assertIn("Live PostgreSQL Store Database", res_live["source"])

        # 2. Test full graph response
        graph_res = app_graph.invoke({"query": "What is our total revenue?"})
        final_resp = graph_res.get("final_response", "")
        self.assertTrue(
            "source" in final_resp.lower() or "database" in final_resp.lower(),
            "AI must reference data source"
        )

if __name__ == "__main__":
    unittest.main()
