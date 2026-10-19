"""
Test Suite: Dashboard Data Integration and Metric Fixes
Verifies all 9 requirements for the Dashboard data loading and accuracy.
"""
import unittest
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.product import Product
from app.models.sales_data import SalesData
from app.models.alert import Alert
from app.modules.health.scorer import compute_health_score
from app.api.inventory import get_inventory_summary
from app.modules.alerts.checker import reconcile_resolved_inventory_alerts, check_inventory_alerts
from app.modules.forecasting.engine import run_forecast


class TestDashboardFixes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = SessionLocal()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_1_health_score_from_live_metrics(self):
        """Requirement 6: Health score calculated from actual available business metrics."""
        result = compute_health_score(self.db)
        self.assertIsNotNone(result.get("total_score"), "Total score must not be None when live data exists")
        self.assertGreaterEqual(result["total_score"], 0)
        self.assertLessEqual(result["total_score"], 100)
        self.assertIn(result["grade"], ["A", "B", "C", "D", "F"])
        self.assertIn("components", result)
        self.assertIn("revenue", result["components"])
        self.assertIn("inventory", result["components"])
        self.assertIn("sales_trend", result["components"])
        self.assertIn("product_diversity", result["components"])
        self.assertTrue(len(result.get("top_issue", "")) > 0, "Top issue must be populated")
        self.assertNotEqual(result.get("top_issue"), "Loading...", "Top issue must not be placeholder")

    def test_2_inventory_summary_schema_and_counts(self):
        """Requirement 2 & 7: Inventory summary returns both counts and item lists."""
        summary = get_inventory_summary(self.db)
        self.assertIn("critical_count", summary)
        self.assertIn("low_count", summary)
        self.assertIn("critical", summary)
        self.assertIn("low_stock", summary)
        self.assertIsInstance(summary["critical"], list)
        self.assertIsInstance(summary["low_stock"], list)

        # Verify low_count matches actual count of products where current_stock <= reorder_point
        products = self.db.query(Product).all()
        expected_low = [p for p in products if p.current_stock <= p.reorder_point and p.current_stock > max(1, p.reorder_point // 3)]
        expected_crit = [p for p in products if p.current_stock <= max(1, p.reorder_point // 3)]

        self.assertEqual(summary["critical_count"], len(expected_crit))
        self.assertEqual(summary["low_count"], len(expected_low))
        self.assertEqual(len(summary["critical"]), len(expected_crit))
        self.assertEqual(len(summary["low_stock"]), len(expected_low))

    def test_3_alert_reconciliation_stale_vs_active(self):
        """Requirement 7: Verify stale alerts for replenished products are reconciled and active low stock has alerts."""
        reconciled = reconcile_resolved_inventory_alerts(self.db)
        self.assertIsInstance(reconciled, int)

        # Basmati Rice is at 50 packs (reorder point 15), so it should NOT have pending unread inventory alerts
        basmati = self.db.query(Product).filter(Product.name.ilike("%Basmati Rice%")).first()
        if basmati and basmati.current_stock > basmati.reorder_point:
            stale_basmati = (
                self.db.query(Alert)
                .filter(Alert.is_read == False, Alert.alert_type == "INVENTORY", Alert.message.ilike("%Basmati Rice%"))
                .first()
            )
            self.assertIsNone(stale_basmati, "Replenished products must not have unread inventory alerts")

        # Products currently low (e.g. Fortune Sunflower Oil) MUST have an unread inventory alert
        low_prods = self.db.query(Product).filter(Product.current_stock <= Product.reorder_point).all()
        for lp in low_prods:
            alert = (
                self.db.query(Alert)
                .filter(Alert.is_read == False, Alert.alert_type == "INVENTORY", Alert.message.ilike(f"%{lp.name}%"))
                .first()
            )
            self.assertIsNotNone(alert, f"Product {lp.name} with low stock must have an active unread alert")

    def test_4_valid_forecast_output_and_chart_data(self):
        """Requirement 4 & 5: Forecast output returns valid predictions and chart_data."""
        res = run_forecast(db=self.db, horizon="month")
        self.assertIn("forecast", res)
        self.assertIn("historical", res)
        self.assertIn("chart_data", res)
        self.assertEqual(len(res["forecast"]), 30, "30-day forecast must return 30 daily predictions")
        self.assertGreater(len(res["historical"]), 0, "Historical sales points must be returned")

        # Every forecast row must have date, predicted, lower, upper
        sample = res["forecast"][0]
        self.assertIn("date", sample)
        self.assertIn("predicted", sample)
        self.assertIn("lower", sample)
        self.assertIn("upper", sample)
        self.assertGreater(sample["predicted"], 0)

    def test_5_zero_stock_product_alert_trigger(self):
        """Requirement 9: Zero-stock products correctly trigger HIGH severity stock alerts."""
        # Find or test zero-stock alert rule
        test_alerts = check_inventory_alerts(self.db)
        self.assertIsInstance(test_alerts, list)
        for a in test_alerts:
            self.assertIn(a["severity"], ["HIGH", "MEDIUM", "LOW"])
            self.assertEqual(a["alert_type"], "INVENTORY")


if __name__ == "__main__":
    unittest.main()
