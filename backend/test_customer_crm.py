"""
Comprehensive Test Suite for BusinessGPT Customer Information & CRM Settings.
Verifies all 12 Acceptance Criteria:
1. Customer collection can be enabled and disabled.
2. Settings persist after refreshing or logging in again.
3. Only configured fields appear / are processed in POS.
4. Required fields are validated correctly.
5. Walk-in billing works according to settings.
6. Existing customer search and selection work.
7. Multi-tenant store scoping (Store 1 cannot access Store 2 customers).
8. Sales can be completed with and without a customer.
9. Existing POS, billing, inventory, reporting, and receipt workflows remain intact.
10. Customer purchase history follows its setting.
11. Consent is correctly captured when required.
12. Existing database installations can be upgraded safely.
"""

import unittest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.core.database import SessionLocal, engine
from app.core.seed import seed_database, _ensure_schema_migrations
from app.core.auth import create_access_token, hash_pin
from app.models.user import User
from app.models.customer import Customer, CustomerSetting
from app.models.product import Product
from app.models.bill import Bill


class TestCustomerCRM(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        seed_database()
        cls.db = SessionLocal()
        cls.client = TestClient(app)

        # Setup Store 1 Owner
        cls.owner1 = cls.db.query(User).filter(User.phone == "+919876543210").first()
        if not cls.owner1:
            cls.owner1 = User(name="Store 1 Owner", role="OWNER", pin=hash_pin("1111"), phone="+919876543210", store_id=1)
            cls.db.add(cls.owner1)
            cls.db.commit()
            cls.db.refresh(cls.owner1)
        else:
            cls.owner1.store_id = 1
            cls.db.commit()

        cls.token_store1 = create_access_token(data={"sub": str(cls.owner1.id), "user_id": cls.owner1.id, "name": cls.owner1.name, "role": cls.owner1.role, "store_id": 1})
        cls.headers_store1 = {"Authorization": f"Bearer {cls.token_store1}"}

        # Setup Store 2 Owner for Multi-tenant isolation testing
        cls.owner2 = cls.db.query(User).filter(User.phone == "+919999900002").first()
        if not cls.owner2:
            cls.owner2 = User(name="Store 2 Owner", role="OWNER", pin=hash_pin("9999"), phone="+919999900002", store_id=2)
            cls.db.add(cls.owner2)
            cls.db.commit()
            cls.db.refresh(cls.owner2)

        cls.token_store2 = create_access_token(data={"sub": str(cls.owner2.id), "user_id": cls.owner2.id, "name": cls.owner2.name, "role": cls.owner2.role, "store_id": 2})
        cls.headers_store2 = {"Authorization": f"Bearer {cls.token_store2}"}

        # Find or create a test product
        cls.product = cls.db.query(Product).first()
        if not cls.product:
            cls.product = Product(name="Test Item", sku="TEST-001", category="Grocery", unit_price=100.0, current_stock=50, reorder_point=10)
            cls.db.add(cls.product)
            cls.db.commit()
            cls.db.refresh(cls.product)

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def setUp(self):
        # Clean up test customers and linked customer bills before each test for clean isolation
        self.db.query(Bill).filter(Bill.customer_id.isnot(None)).update({Bill.customer_id: None})
        self.db.query(Customer).delete()

        # Ensure product has ample stock for POS test transactions
        if self.product:
            self.product.current_stock = 500

        # Reset customer settings to standard defaults for Store 1
        setting = self.db.query(CustomerSetting).filter(CustomerSetting.store_id == 1).first()
        if setting:
            setting.enabled = False
            setting.allow_walk_in = True
            setting.customer_selection_optional = True
            setting.save_purchase_history = False
            setting.require_consent = False
            setting.enabled_fields = '["full_name", "phone", "email", "billing_address", "date_of_birth", "notes"]'
            setting.required_fields = '[]'

        self.db.commit()

    def test_01_customer_collection_can_be_enabled_and_disabled(self):
        """Criterion 1: Customer collection can be enabled and disabled."""
        # Enable collection
        res = self.client.put("/api/customers/settings", json={"enabled": True}, headers=self.headers_store1)
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["enabled"])

        # Disable collection
        res = self.client.put("/api/customers/settings", json={"enabled": False}, headers=self.headers_store1)
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.json()["enabled"])

    def test_02_settings_persist_after_refreshing_or_reloading_db(self):
        """Criterion 2: Settings persist after refreshing or logging in again."""
        update_data = {
            "enabled": True,
            "allow_walk_in": True,
            "customer_selection_optional": True,
            "save_purchase_history": True,
            "require_consent": True,
            "enabled_fields": ["full_name", "phone", "email"],
            "required_fields": ["full_name"]
        }
        res = self.client.put("/api/customers/settings", json=update_data, headers=self.headers_store1)
        self.assertEqual(res.status_code, 200)

        # Separate read request mimicking page refresh
        fetch_res = self.client.get("/api/customers/settings", headers=self.headers_store1)
        self.assertEqual(fetch_res.status_code, 200)
        data = fetch_res.json()
        self.assertTrue(data["enabled"])
        self.assertTrue(data["save_purchase_history"])
        self.assertTrue(data["require_consent"])
        self.assertIn("email", data["enabled_fields"])
        self.assertIn("full_name", data["required_fields"])

    def test_03_only_configured_fields_appear_and_are_saved(self):
        """Criterion 3: Only configured fields are persisted; non-enabled fields (e.g. DOB/address) are ignored."""
        # Configure store with only name and phone enabled
        self.client.put("/api/customers/settings", json={
            "enabled": True,
            "require_consent": False,
            "enabled_fields": ["full_name", "phone"],
            "required_fields": []
        }, headers=self.headers_store1)

        # Attempt to supply date_of_birth and billing_address
        res = self.client.post("/api/customers", json={
            "full_name": "Deepak Shah",
            "phone": "9812345670",
            "date_of_birth": "1990-01-01",
            "billing_address": "Secret Street 10"
        }, headers=self.headers_store1)
        self.assertEqual(res.status_code, 200)
        created = res.json()
        self.assertEqual(created["full_name"], "Deepak Shah")
        self.assertEqual(created["phone"], "+919812345670")
        # Ensure non-enabled fields were not persisted
        self.assertIsNone(created["date_of_birth"])
        self.assertIsNone(created["billing_address"])

    def test_04_required_fields_are_validated_correctly(self):
        """Criterion 4: Required fields are validated correctly and return 400 if missing."""
        # Make phone mandatory
        self.client.put("/api/customers/settings", json={
            "enabled": True,
            "require_consent": False,
            "enabled_fields": ["full_name", "phone"],
            "required_fields": ["phone"]
        }, headers=self.headers_store1)

        # Attempt to create customer without phone
        res = self.client.post("/api/customers", json={
            "full_name": "No Phone User"
        }, headers=self.headers_store1)
        self.assertEqual(res.status_code, 400)
        self.assertIn("Phone Number", res.json()["detail"])

    def test_05_walk_in_billing_works_according_to_settings(self):
        """Criterion 5: Walk-in billing allowed when enabled, blocked when strictly disabled."""
        # Case A: Walk-in allowed (with no required fields)
        self.client.put("/api/customers/settings", json={
            "enabled": True,
            "allow_walk_in": True,
            "customer_selection_optional": True,
            "required_fields": []
        }, headers=self.headers_store1)

        bill_payload = {
            "items": [{"product_id": self.product.id, "quantity": 1, "unit_price": self.product.unit_price}],
            "payment_method": "Cash",
            "customer_id": None
        }
        res_walkin = self.client.post("/api/pos/bill", json=bill_payload, headers=self.headers_store1)
        self.assertEqual(res_walkin.status_code, 200)
        self.assertIsNone(res_walkin.json()["customer_id"])

        # Case B: Walk-in strictly disabled and customer selection mandatory
        self.client.put("/api/customers/settings", json={
            "enabled": True,
            "allow_walk_in": False,
            "customer_selection_optional": False,
            "required_fields": []
        }, headers=self.headers_store1)

        res_blocked = self.client.post("/api/pos/bill", json=bill_payload, headers=self.headers_store1)
        self.assertEqual(res_blocked.status_code, 400)
        self.assertIn("Walk-in billing is disabled", res_blocked.json()["detail"])

        # Restore default walk-in
        self.client.put("/api/customers/settings", json={
            "enabled": True,
            "allow_walk_in": True,
            "customer_selection_optional": True,
            "required_fields": []
        }, headers=self.headers_store1)

    def test_06_existing_customer_search_and_selection_work(self):
        """Criterion 6: Existing customer search by name or phone number works."""
        # Create test customer
        cust_res = self.client.post("/api/customers", json={
            "full_name": "Sunita Verma",
            "phone": "9876500001",
            "consent_given": True
        }, headers=self.headers_store1)
        self.assertEqual(cust_res.status_code, 200)

        # Search by name
        s_name = self.client.get("/api/customers/search?q=Sunita", headers=self.headers_store1)
        self.assertEqual(s_name.status_code, 200)
        matches = s_name.json()
        self.assertTrue(any(c["full_name"] == "Sunita Verma" for c in matches))

        # Search by phone
        s_phone = self.client.get("/api/customers/search?q=9876500001", headers=self.headers_store1)
        self.assertEqual(s_phone.status_code, 200)
        matches_phone = s_phone.json()
        self.assertTrue(any(c["phone"] == "+919876500001" for c in matches_phone))

    def test_07_customer_from_one_store_cannot_be_accessed_by_another_store(self):
        """Criterion 7: Multi-tenant store scoping prevents cross-store customer data access."""
        # Create customer in Store 1
        c1 = self.client.post("/api/customers", json={
            "full_name": "Store 1 VIP Client",
            "phone": "9811111111",
            "consent_given": True
        }, headers=self.headers_store1).json()

        # Attempt to access customer from Store 2
        res_get = self.client.get(f"/api/customers/{c1['id']}", headers=self.headers_store2)
        self.assertEqual(res_get.status_code, 404)

        # Attempt to update customer from Store 2
        res_put = self.client.put(f"/api/customers/{c1['id']}", json={"full_name": "Hacked Name"}, headers=self.headers_store2)
        self.assertEqual(res_put.status_code, 404)

        # Attempt to delete customer from Store 2
        res_del = self.client.delete(f"/api/customers/{c1['id']}", headers=self.headers_store2)
        self.assertEqual(res_del.status_code, 404)

        # Ensure Store 2 search does not expose Store 1 customer
        s2 = self.client.get("/api/customers/search?q=VIP", headers=self.headers_store2).json()
        self.assertEqual(len(s2), 0)

    def test_08_sales_can_be_completed_with_and_without_customer(self):
        """Criterion 8: Sales can be completed with and without a customer."""
        # Reset settings
        self.client.put("/api/customers/settings", json={
            "enabled": True,
            "allow_walk_in": True,
            "customer_selection_optional": True,
            "save_purchase_history": True,
            "require_consent": False,
            "enabled_fields": ["full_name", "phone"],
            "required_fields": []
        }, headers=self.headers_store1)

        # Sale without customer
        bill_without = self.client.post("/api/pos/bill", json={
            "items": [{"product_id": self.product.id, "quantity": 1, "unit_price": self.product.unit_price}],
            "payment_method": "Cash"
        }, headers=self.headers_store1)
        self.assertEqual(bill_without.status_code, 200)
        self.assertIsNone(bill_without.json()["customer_id"])

        # Create customer and complete sale with customer
        cust = self.client.post("/api/customers", json={
            "full_name": "Vikram Rathore",
            "phone": "9822233344"
        }, headers=self.headers_store1).json()

        bill_with = self.client.post("/api/pos/bill", json={
            "items": [{"product_id": self.product.id, "quantity": 2, "unit_price": self.product.unit_price}],
            "payment_method": "UPI",
            "customer_id": cust["id"]
        }, headers=self.headers_store1)
        self.assertEqual(bill_with.status_code, 200)
        b_data = bill_with.json()
        self.assertEqual(b_data["customer_id"], cust["id"])
        self.assertEqual(b_data["customer_name"], "Vikram Rathore")
        self.assertEqual(b_data["customer_phone"], "+919822233344")

    def test_09_existing_endpoints_continue_working(self):
        """Criterion 9: Existing POS, products, bills history, and settings continue to pass."""
        p_res = self.client.get("/api/pos/products", headers=self.headers_store1)
        self.assertEqual(p_res.status_code, 200)
        self.assertTrue(len(p_res.json()) > 0)

        bills_res = self.client.get("/api/pos/bills", headers=self.headers_store1)
        self.assertEqual(bills_res.status_code, 200)
        self.assertTrue(len(bills_res.json()) > 0)

    def test_10_customer_purchase_history_follows_setting(self):
        """Criterion 10: Customer purchase history follows its setting."""
        # Step A: Create customer
        cust = self.client.post("/api/customers", json={
            "full_name": "Meera Patel",
            "phone": "9844455566"
        }, headers=self.headers_store1).json()

        # Step B: When save_purchase_history is TRUE
        self.client.put("/api/customers/settings", json={
            "enabled": True,
            "save_purchase_history": True
        }, headers=self.headers_store1)

        self.client.post("/api/pos/bill", json={
            "items": [{"product_id": self.product.id, "quantity": 1, "unit_price": 250.0}],
            "payment_method": "Card",
            "customer_id": cust["id"]
        }, headers=self.headers_store1)

        # Inspect customer details
        cust_details = self.client.get(f"/api/customers/{cust['id']}", headers=self.headers_store1).json()
        self.assertEqual(cust_details["purchase_count"], 1)
        self.assertGreaterEqual(cust_details["total_spent"], 250.0)
        self.assertEqual(len(cust_details["purchase_history"]), 1)

        # Step C: When save_purchase_history is FALSE
        self.client.put("/api/customers/settings", json={
            "enabled": True,
            "save_purchase_history": False
        }, headers=self.headers_store1)

        # New sale should NOT be linked to customer purchase history
        self.client.post("/api/pos/bill", json={
            "items": [{"product_id": self.product.id, "quantity": 1, "unit_price": 500.0}],
            "payment_method": "UPI",
            "customer_id": cust["id"]
        }, headers=self.headers_store1)

        # Purchase count does not increment because history tracking is off
        cust_details2 = self.client.get(f"/api/customers/{cust['id']}", headers=self.headers_store1).json()
        self.assertEqual(cust_details2["purchase_count"], 0)
        self.assertEqual(len(cust_details2["purchase_history"]), 0)

    def test_11_consent_is_correctly_captured_when_required(self):
        """Criterion 11: Consent is correctly captured and timestamped when require_consent is enabled."""
        self.client.put("/api/customers/settings", json={
            "enabled": True,
            "require_consent": True,
            "enabled_fields": ["full_name", "phone"],
            "required_fields": []
        }, headers=self.headers_store1)

        # Attempt create without consent
        res_no_consent = self.client.post("/api/customers", json={
            "full_name": "Consent Test",
            "phone": "9833344455",
            "consent_given": False
        }, headers=self.headers_store1)
        self.assertEqual(res_no_consent.status_code, 400)
        self.assertIn("consent is required", res_no_consent.json()["detail"].lower())

        # Attempt create WITH consent
        res_with_consent = self.client.post("/api/customers", json={
            "full_name": "Consent Test",
            "phone": "9833344455",
            "consent_given": True
        }, headers=self.headers_store1)
        self.assertEqual(res_with_consent.status_code, 200)
        cust_created = res_with_consent.json()
        self.assertTrue(cust_created["consent_given"])
        self.assertIsNotNone(cust_created["consent_timestamp"])

    def test_12_database_migrations_upgrade_safely(self):
        """Criterion 12: Existing database installations can be upgraded safely."""
        # Verify schema migration executes idempotently without raising an exception
        _ensure_schema_migrations(engine)
        with engine.connect() as conn:
            is_sqlite = engine.dialect.name == "sqlite"
            if is_sqlite:
                cols_users = [r[1] for r in conn.execute(text("PRAGMA table_info(users)")).fetchall()]
                cols_bills = [r[1] for r in conn.execute(text("PRAGMA table_info(bills)")).fetchall()]
                self.assertIn("store_id", cols_users)
                self.assertIn("customer_id", cols_bills)

    def test_13_missing_required_name_blocks_bill_generation(self):
        """CRITICAL: Missing required name blocks bill generation with HTTP 400."""
        self.client.put("/api/customers/settings", json={
            "enabled": True,
            "allow_walk_in": True,
            "require_consent": False,
            "enabled_fields": ["full_name", "phone"],
            "required_fields": ["full_name"]
        }, headers=self.headers_store1)

        payload = {
            "items": [{"product_id": self.product.id, "quantity": 1, "unit_price": self.product.unit_price}],
            "payment_method": "Cash",
            "customer_data": {
                "phone": "9811223344"
            }
        }
        res = self.client.post("/api/pos/bill", json=payload, headers=self.headers_store1)
        self.assertEqual(res.status_code, 400)
        self.assertIn("Full Name", res.json()["detail"])

    def test_14_missing_required_phone_blocks_bill_generation(self):
        """CRITICAL: Missing required phone number blocks bill generation with HTTP 400."""
        self.client.put("/api/customers/settings", json={
            "enabled": True,
            "allow_walk_in": True,
            "require_consent": False,
            "enabled_fields": ["full_name", "phone"],
            "required_fields": ["phone"]
        }, headers=self.headers_store1)

        payload = {
            "items": [{"product_id": self.product.id, "quantity": 1, "unit_price": self.product.unit_price}],
            "payment_method": "Cash",
            "customer_data": {
                "full_name": "Rohan Sharma"
            }
        }
        res = self.client.post("/api/pos/bill", json=payload, headers=self.headers_store1)
        self.assertEqual(res.status_code, 400)
        self.assertIn("Phone Number", res.json()["detail"])

    def test_15_invalid_phone_number_blocks_bill_generation(self):
        """CRITICAL: Invalid phone numbers (too short, characters) block bill generation with HTTP 400."""
        self.client.put("/api/customers/settings", json={
            "enabled": True,
            "allow_walk_in": True,
            "require_consent": False,
            "enabled_fields": ["full_name", "phone"],
            "required_fields": ["phone"]
        }, headers=self.headers_store1)

        # 1. Too short (e.g. 5 digits)
        payload_short = {
            "items": [{"product_id": self.product.id, "quantity": 1, "unit_price": self.product.unit_price}],
            "payment_method": "Cash",
            "customer_data": {
                "full_name": "Anil",
                "phone": "12345"
            }
        }
        res_short = self.client.post("/api/pos/bill", json=payload_short, headers=self.headers_store1)
        self.assertEqual(res_short.status_code, 400)
        self.assertIn("Invalid phone number", res_short.json()["detail"])

        # 2. Characters in phone
        payload_alpha = {
            "items": [{"product_id": self.product.id, "quantity": 1, "unit_price": self.product.unit_price}],
            "payment_method": "Cash",
            "customer_data": {
                "full_name": "Anil",
                "phone": "98123abc45"
            }
        }
        res_alpha = self.client.post("/api/pos/bill", json=payload_alpha, headers=self.headers_store1)
        self.assertEqual(res_alpha.status_code, 400)
        self.assertIn("Invalid phone number", res_alpha.json()["detail"])

    def test_16_valid_required_info_allows_bill_generation_and_optional_omitted(self):
        """CRITICAL: Valid required information allows bill generation; omitting optional fields succeeds."""
        self.client.put("/api/customers/settings", json={
            "enabled": True,
            "allow_walk_in": True,
            "require_consent": False,
            "enabled_fields": ["full_name", "phone", "email", "billing_address"],
            "required_fields": ["full_name", "phone"]
        }, headers=self.headers_store1)

        # Full name and phone provided; email and address omitted
        payload = {
            "items": [{"product_id": self.product.id, "quantity": 1, "unit_price": self.product.unit_price}],
            "payment_method": "UPI",
            "customer_data": {
                "full_name": "Aarav Gupta",
                "phone": "9898989898"
            }
        }
        res = self.client.post("/api/pos/bill", json=payload, headers=self.headers_store1)
        self.assertEqual(res.status_code, 200)
        bill_data = res.json()
        self.assertIsNotNone(bill_data["customer_id"])
        self.assertEqual(bill_data["customer_name"], "Aarav Gupta")
        self.assertEqual(bill_data["customer_phone"], "+919898989898")

    def test_17_walk_in_blocked_when_required_fields_configured(self):
        """CRITICAL: Walk-in billing cannot bypass configured required fields."""
        self.client.put("/api/customers/settings", json={
            "enabled": True,
            "allow_walk_in": True,
            "require_consent": False,
            "enabled_fields": ["full_name", "phone"],
            "required_fields": ["full_name"]
        }, headers=self.headers_store1)

        # Attempt checkout without customer
        payload = {
            "items": [{"product_id": self.product.id, "quantity": 1, "unit_price": self.product.unit_price}],
            "payment_method": "Cash"
        }
        res = self.client.post("/api/pos/bill", json=payload, headers=self.headers_store1)
        self.assertEqual(res.status_code, 400)
        self.assertIn("Customer details are mandatory", res.json()["detail"])
        self.assertIn("Walk-in checkout is not permitted", res.json()["detail"])

    def test_18_failed_validation_does_not_create_transaction_or_change_inventory(self):
        """CRITICAL: Failed customer validation does NOT create a transaction or reduce product inventory."""
        self.client.put("/api/customers/settings", json={
            "enabled": True,
            "allow_walk_in": True,
            "require_consent": False,
            "enabled_fields": ["full_name", "phone"],
            "required_fields": ["full_name", "phone"]
        }, headers=self.headers_store1)

        # Record initial stock and bill count
        self.db.refresh(self.product)
        stock_before = self.product.current_stock
        bill_count_before = self.db.query(Bill).count()

        # Attempt invalid billing (missing phone)
        payload = {
            "items": [{"product_id": self.product.id, "quantity": 5, "unit_price": self.product.unit_price}],
            "payment_method": "Cash",
            "customer_data": {
                "full_name": "Test User Without Phone"
            }
        }
        res = self.client.post("/api/pos/bill", json=payload, headers=self.headers_store1)
        self.assertEqual(res.status_code, 400)

        # Verify stock and bill count are 100% unaltered
        self.db.refresh(self.product)
        stock_after = self.product.current_stock
        bill_count_after = self.db.query(Bill).count()

        self.assertEqual(stock_after, stock_before, "Inventory stock must not change upon failed validation!")
        self.assertEqual(bill_count_after, bill_count_before, "No bill transaction should be created!")


if __name__ == "__main__":
    unittest.main()
