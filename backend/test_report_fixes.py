import os
import unittest
from datetime import date
from pypdf import PdfReader
from sqlalchemy import func

from app.core.database import SessionLocal
from app.models.product import Product
from app.models.sales_data import SalesData
from app.models.bill import Bill
from app.modules.health.scorer import compute_health_score
from app.modules.reports.generator import generate_pdf_report, compute_stock_status


class TestReportGeneratorFixes(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_health_score_matches_api(self):
        """Verify the PDF health score exactly matches /api/health/score calculation."""
        health = compute_health_score(self.db)
        expected_score = health["total_score"]
        expected_grade = health["grade"]

        pdf_path = generate_pdf_report(self.db, period="daily")
        self.assertTrue(os.path.exists(pdf_path), "PDF file was not created")

        reader = PdfReader(pdf_path)
        all_text = " ".join([page.extract_text() for page in reader.pages])

        self.assertIn(f"Overall Score: {expected_score}/100", all_text)
        self.assertIn(f"Grade: {expected_grade}", all_text)
        print(f"PASS: Health Score verified in PDF ({expected_score}/100, Grade {expected_grade})")

    def test_sales_values_populated_and_match_database(self):
        """Verify Section 2 (Sales Performance) is populated with actual revenue, units, profit, and trends."""
        today = date(2026, 10, 15)
        sales_today = self.db.query(SalesData).filter(SalesData.date == today).all()
        self.assertTrue(len(sales_today) > 0, "Expected sales records for 2026-10-15")

        expected_rev = sum(float(s.revenue) for s in sales_today)
        expected_units = sum(int(s.quantity_sold) for s in sales_today)

        pdf_path = generate_pdf_report(self.db, period="daily", target_date="2026-10-15")
        reader = PdfReader(pdf_path)
        page1_text = reader.pages[0].extract_text()

        # Check section title
        self.assertIn("2. Sales Performance", page1_text)
        # Check actual revenue populated
        self.assertIn(f"INR {expected_rev:,.2f}", page1_text)
        # Check actual units sold populated
        self.assertIn(f"{expected_units:,} items", page1_text)
        # Check top products table
        self.assertIn("Top Products by Revenue", page1_text)
        # Check trend table
        self.assertIn("Recent 7-Day Performance Trend", page1_text)
        self.assertIn("15 Oct 2026 (Report Day)", page1_text)
        print(f"PASS: Sales values populated and matched live database (Rev: INR {expected_rev:,.2f}, Units: {expected_units})")

    def test_inventory_values_match_live_database(self):
        """Verify inventory values in PDF match authoritative live products table (not stale snapshots)."""
        products = self.db.query(Product).all()
        self.assertTrue(len(products) > 0, "Products catalog must not be empty")

        total_skus = len(products)
        expected_valuation = sum(float(p.current_stock) * float(p.unit_price) for p in products)
        reorder_items = [p for p in products if p.current_stock <= p.reorder_point]

        pdf_path = generate_pdf_report(self.db, period="daily", target_date="2026-10-15")
        reader = PdfReader(pdf_path)
        page2_text = reader.pages[1].extract_text()

        # Check Section 3 presence
        self.assertIn("3. Inventory Status & Health", page2_text)
        # Check total SKUs and live valuation
        self.assertIn(f"{total_skus} items", page2_text)
        self.assertIn(f"INR {expected_valuation:,.2f}", page2_text)

        normalized_page2 = " ".join(page2_text.split())

        # Check that each low stock product displays its exact live stock
        for p in reorder_items:
            self.assertIn(p.name, normalized_page2)
            self.assertIn(f"{p.current_stock} {p.unit or 'pcs'}", normalized_page2)

        print(f"PASS: Inventory values match live database (SKUs: {total_skus}, Valuation: INR {expected_valuation:,.2f})")

    def test_explicit_date_ranges_on_pdf(self):
        """Verify the report explicitly displays calculation date and not just vague 'October 2026'."""
        pdf_path = generate_pdf_report(self.db, period="daily", target_date="2026-10-15")
        reader = PdfReader(pdf_path)
        header_text = reader.pages[0].extract_text()

        self.assertIn("Daily Register - 15 October 2026", header_text)
        self.assertIn("Calculation Period: 15 Oct 2026 (Calculation Date: 2026-10-15)", header_text)
        print("PASS: Explicit calculation date present on PDF header")

    def test_empty_dataset_handling(self):
        """Verify empty datasets display a clear 'No Sales Data Available' message instead of blank space."""
        empty_date = "2020-01-01"
        pdf_path = generate_pdf_report(self.db, period="daily", start_date=empty_date, end_date=empty_date)
        reader = PdfReader(pdf_path)
        all_text = " ".join([page.extract_text() for page in reader.pages])

        self.assertIn("No Sales Data Available for this Period", all_text)
        self.assertIn("01 Jan 2020 to 01 Jan 2020", all_text)
        self.assertIn("No transactions, register receipts, or sales rows were recorded", all_text)
        print("PASS: Empty period handled with clear informational banner")


if __name__ == "__main__":
    unittest.main()
