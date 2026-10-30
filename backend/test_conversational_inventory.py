import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))

import unittest
import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.product import Product
from app.models.user import User
from app.models.store_setting import StoreSetting
from app.models.stock_transaction import StockTransaction
from app.models.inventory_adjustment import PendingInventoryAdjustment
from app.modules.inventory.conversational import (
    handle_conversational_inventory,
    execute_confirmed_adjustment,
    match_product,
    parse_inventory_utterance,
    is_confirmation_intent
)


class TestConversationalInventory(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # In-memory SQLite for high-speed, isolated unit and integration testing
        cls.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(cls.engine)
        cls.Session = sessionmaker(bind=cls.engine)

    def setUp(self):
        self.db = self.Session()
        # Seed test store settings
        setting = StoreSetting(key="allow_negative_stock", value="false")
        self.db.add(setting)

        # Seed test user
        self.user = User(
            id=1,
            name="Aditya (Owner)",
            role="OWNER",
            phone="+917798405033",
            pin="$2b$12$K1r6fUuY9gQ4u3Q2rN7o.eK3p0qQJ2lZ3.u8hK5v8k4y7Z8a9b0c."
        )
        self.db.add(self.user)

        # Seed test products
        self.maggi = Product(
            id=1,
            store_id=1,
            name="Maggi 2-Minute Masala Noodles 70g",
            sku="SNACK-001",
            category="Snacks",
            unit_price=14.0,
            current_stock=80,
            reorder_point=25,
            unit="packets",
            barcode="8901058852341",
            aliases=json.dumps(["maggi", "magi", "maggie", "noodles", "maggi noodles"])
        )
        self.parle_g = Product(
            id=2,
            store_id=1,
            name="Parle-G Gold Biscuits 1kg",
            sku="SNACK-002",
            category="Snacks",
            unit_price=120.0,
            current_stock=40,
            reorder_point=10,
            unit="packets",
            barcode="8901719114002",
            aliases=json.dumps(["parle-g", "parle g", "parle", "glucose biscuit", "biscuit"])
        )
        self.good_day = Product(
            id=3,
            store_id=1,
            name="Britannia Good Day Butter Cookies 600g",
            sku="SNACK-003",
            category="Snacks",
            unit_price=150.0,
            current_stock=25,
            reorder_point=10,
            unit="packets",
            barcode="8901063141126",
            aliases=json.dumps(["good day", "goodday", "butter cookies", "biscuit"])
        )
        self.rice = Product(
            id=4,
            store_id=1,
            name="Fortune Everyday Basmati Rice 5kg",
            sku="GROC-001",
            category="Grains",
            unit_price=450.0,
            current_stock=30,
            reorder_point=10,
            unit="kg",
            barcode="8906007281021",
            aliases=json.dumps(["basmati rice", "basmati", "chawal", "rice", "tandul"])
        )

        self.db.add_all([self.maggi, self.parle_g, self.good_day, self.rice])
        self.db.commit()

    def tearDown(self):
        self.db.rollback()
        # Clean tables for next test
        for table in reversed(Base.metadata.sorted_tables):
            self.db.execute(table.delete())
        self.db.commit()
        self.db.close()

    def test_01_restock_product(self):
        """Test restocking a product: 50 packet Maggi ka stock aaya hai."""
        session_id = "test_restock_1"
        res = handle_conversational_inventory(
            query="50 packet Maggi ka stock aaya hai",
            session_id=session_id,
            user=self.user,
            store_id=1,
            db=self.db
        )

        self.assertEqual(res["status"], "PENDING_CONFIRMATION")
        self.assertTrue(res["is_inventory_adjustment"])
        self.assertEqual(len(res["proposals"]), 1)
        prop = res["proposals"][0]
        self.assertEqual(prop["sku"], "SNACK-001")
        self.assertEqual(prop["previous_stock"], 80)
        self.assertEqual(prop["net_change"], 50)
        self.assertEqual(prop["new_stock"], 130)

        # Verify stock NOT changed yet (mandatory confirmation rule)
        prod = self.db.query(Product).filter(Product.id == 1).first()
        self.assertEqual(prod.current_stock, 80)

        # Confirm adjustment
        confirm_res = handle_conversational_inventory(
            query="Haan update kar do",
            session_id=session_id,
            user=self.user,
            store_id=1,
            db=self.db
        )
        self.assertEqual(confirm_res["status"], "CONFIRMED")
        self.db.refresh(prod)
        self.assertEqual(prod.current_stock, 130)

        # Verify StockTransaction audit ledger
        txn = self.db.query(StockTransaction).filter(StockTransaction.product_id == 1).first()
        self.assertIsNotNone(txn)
        self.assertEqual(txn.before_stock, 80)
        self.assertEqual(txn.after_stock, 130)
        self.assertEqual(txn.quantity, 50)

    def test_02_sale_deduction(self):
        """Test sales deduction: 20 Maggi bik gaye."""
        session_id = "test_sale_1"
        res = handle_conversational_inventory(
            query="20 Maggi bik gaye",
            session_id=session_id,
            user=self.user,
            store_id=1,
            db=self.db
        )
        self.assertEqual(res["status"], "PENDING_CONFIRMATION")
        prop = res["proposals"][0]
        self.assertEqual(prop["previous_stock"], 80)
        self.assertEqual(prop["net_change"], -20)
        self.assertEqual(prop["new_stock"], 60)

        # Confirm
        confirm_res = handle_conversational_inventory(
            query="Yes",
            session_id=session_id,
            user=self.user,
            store_id=1,
            db=self.db
        )
        self.assertEqual(confirm_res["status"], "CONFIRMED")
        prod = self.db.query(Product).filter(Product.id == 1).first()
        self.assertEqual(prod.current_stock, 60)

    def test_03_multiple_movements_in_one_sentence(self):
        """Test multiple movements: Maggi: 50 received (+50) and 20 sold (-20). Net change +30."""
        session_id = "test_multi_1"
        res = handle_conversational_inventory(
            query="50 packet Maggi aayi aur 20 bik gaye",
            session_id=session_id,
            user=self.user,
            store_id=1,
            db=self.db
        )
        self.assertEqual(res["status"], "PENDING_CONFIRMATION")
        prop = res["proposals"][0]
        self.assertEqual(prop["previous_stock"], 80)
        self.assertEqual(prop["net_change"], 30)
        self.assertEqual(prop["new_stock"], 110)

        # Confirm with Hindi
        confirm_res = handle_conversational_inventory(
            query="theek hai",
            session_id=session_id,
            user=self.user,
            store_id=1,
            db=self.db
        )
        self.assertEqual(confirm_res["status"], "CONFIRMED")
        prod = self.db.query(Product).filter(Product.id == 1).first()
        self.assertEqual(prod.current_stock, 110)

    def test_04_hindi_chawal_godown(self):
        """Test Hindi: 10 kilo chawal godown se aaya."""
        session_id = "test_hindi_1"
        res = handle_conversational_inventory(
            query="10 kilo chawal godown se aaya",
            session_id=session_id,
            user=self.user,
            store_id=1,
            db=self.db
        )
        self.assertEqual(res["status"], "PENDING_CONFIRMATION")
        prop = res["proposals"][0]
        self.assertEqual(prop["sku"], "GROC-001")
        self.assertEqual(prop["previous_stock"], 30)
        self.assertEqual(prop["new_stock"], 40)

    def test_05_marathi_command(self):
        """Test Marathi: 20 packet Maggi aala."""
        session_id = "test_mr_1"
        res = handle_conversational_inventory(
            query="20 packet Maggi aala",
            session_id=session_id,
            user=self.user,
            store_id=1,
            db=self.db
        )
        self.assertEqual(res["status"], "PENDING_CONFIRMATION")
        prop = res["proposals"][0]
        self.assertEqual(prop["net_change"], 20)
        self.assertEqual(prop["new_stock"], 100)

        # Confirm with Marathi "Ho"
        confirm_res = handle_conversational_inventory(
            query="Ho kara",
            session_id=session_id,
            user=self.user,
            store_id=1,
            db=self.db
        )
        self.assertEqual(confirm_res["status"], "CONFIRMED")
        prod = self.db.query(Product).filter(Product.id == 1).first()
        self.assertEqual(prod.current_stock, 100)

    def test_06_ambiguous_product_disambiguation(self):
        """Test ambiguous product: 20 biscuit sell hue (Parle-G vs Good Day)."""
        session_id = "test_ambig_1"
        res = handle_conversational_inventory(
            query="20 biscuit sell hue",
            session_id=session_id,
            user=self.user,
            store_id=1,
            db=self.db
        )
        self.assertIn(res["status"], ["AMBIGUOUS", "AMBIGUOUS_PRODUCT"])
        self.assertIn("biscuit", res["response"].lower())
        self.assertTrue(len(res.get("candidates", [])) >= 2)

    def test_07_unknown_product_safety(self):
        """Test unknown product: never invent products silently."""
        session_id = "test_unknown_1"
        res = handle_conversational_inventory(
            query="50 packet NonExistentSnack ka stock aaya",
            session_id=session_id,
            user=self.user,
            store_id=1,
            db=self.db
        )
        self.assertIn(res["status"], ["UNKNOWN_PRODUCT", "PRODUCT_NOT_FOUND"])
        self.assertIn("database mein", res["response"])

    def test_08_insufficient_stock_rejection(self):
        """Test negative stock prevention: selling 100 Maggi when only 80 available."""
        session_id = "test_neg_1"
        res = handle_conversational_inventory(
            query="100 Maggi bik gaye",
            session_id=session_id,
            user=self.user,
            store_id=1,
            db=self.db
        )
        self.assertIn(res["status"], ["INSUFFICIENT_STOCK", "ERROR_NEGATIVE_STOCK"])
        self.assertIn("80", res["response"])

        # Verify stock remained untouched
        prod = self.db.query(Product).filter(Product.id == 1).first()
        self.assertEqual(prod.current_stock, 80)

    def test_09_cancellation_flow(self):
        """Test cancellation: user says 'Nahi' / 'Cancel'."""
        session_id = "test_cancel_1"
        res = handle_conversational_inventory(
            query="50 packet Maggi aayi",
            session_id=session_id,
            user=self.user,
            store_id=1,
            db=self.db
        )
        self.assertEqual(res["status"], "PENDING_CONFIRMATION")

        # Cancel
        cancel_res = handle_conversational_inventory(
            query="Nahi cancel kar do",
            session_id=session_id,
            user=self.user,
            store_id=1,
            db=self.db
        )
        self.assertEqual(cancel_res["status"], "CANCELLED")

        # Verify stock remained untouched
        prod = self.db.query(Product).filter(Product.id == 1).first()
        self.assertEqual(prod.current_stock, 80)

    def test_10_idempotency_duplicate_confirmation(self):
        """Test idempotency: confirming twice must not execute twice."""
        session_id = "test_idem_1"
        res = handle_conversational_inventory(
            query="50 packet Maggi aayi",
            session_id=session_id,
            user=self.user,
            store_id=1,
            db=self.db
        )
        self.assertEqual(res["status"], "PENDING_CONFIRMATION")

        # First confirmation
        c1 = handle_conversational_inventory(
            query="Haan",
            session_id=session_id,
            user=self.user,
            store_id=1,
            db=self.db
        )
        self.assertEqual(c1["status"], "CONFIRMED")
        prod = self.db.query(Product).filter(Product.id == 1).first()
        self.assertEqual(prod.current_stock, 130)

        # Second confirmation immediately after
        c2 = handle_conversational_inventory(
            query="Haan",
            session_id=session_id,
            user=self.user,
            store_id=1,
            db=self.db
        )
        # Should not increase stock again
        self.db.refresh(prod)
        self.assertEqual(prod.current_stock, 130)

    def test_11_create_product_via_ai(self):
        """Test creating a new product through natural language."""
        session_id = "test_create_1"
        res = handle_conversational_inventory(
            query="Naya product add karo: Parle Rusk, price 40, stock 30, reorder point 15",
            session_id=session_id,
            user=self.user,
            store_id=1,
            db=self.db
        )
        self.assertEqual(res["status"], "PENDING_CONFIRMATION")
        self.assertEqual(res["action"], "CREATE_PRODUCT")
        self.assertIn("Parle Rusk", res["response"])

        # Confirm
        c_res = handle_conversational_inventory(
            query="Haan",
            session_id=session_id,
            user=self.user,
            store_id=1,
            db=self.db
        )
        self.assertEqual(c_res["status"], "CONFIRMED")
        new_prod = self.db.query(Product).filter(Product.name.like("%Parle Rusk%")).first()
        self.assertIsNotNone(new_prod)
        self.assertEqual(new_prod.unit_price, 40.0)
        self.assertEqual(new_prod.current_stock, 30)
        self.assertEqual(new_prod.reorder_point, 15)

    def test_12_update_price_via_ai(self):
        """Test updating product price through natural language."""
        session_id = "test_price_1"
        res = handle_conversational_inventory(
            query="Maggi ka price 16 kar do",
            session_id=session_id,
            user=self.user,
            store_id=1,
            db=self.db
        )
        self.assertEqual(res["status"], "PENDING_CONFIRMATION")
        self.assertEqual(res["action"], "UPDATE_PRODUCT")
        self.assertIn("16.00", res["response"])

        # Confirm
        c_res = handle_conversational_inventory(
            query="Confirm karo",
            session_id=session_id,
            user=self.user,
            store_id=1,
            db=self.db
        )
        self.assertEqual(c_res["status"], "CONFIRMED")
        prod = self.db.query(Product).filter(Product.id == 1).first()
        self.db.refresh(prod)
        self.assertEqual(prod.unit_price, 16.0)

    def test_13_check_stock_via_ai(self):
        """Test checking stock through natural language."""
        session_id = "test_check_1"
        res = handle_conversational_inventory(
            query="Maggi ka kitna stock hai?",
            session_id=session_id,
            user=self.user,
            store_id=1,
            db=self.db
        )
        self.assertEqual(res["status"], "STOCK_CHECK")
        self.assertIn("80 packets", res["response"])

    def test_14_delete_product_via_ai(self):
        """Test deleting product through natural language with explicit confirmation."""
        session_id = "test_delete_1"
        # First ensure product exists
        prod = self.db.query(Product).filter(Product.id == 2).first()
        self.assertIsNotNone(prod)

        res = handle_conversational_inventory(
            query="Parle-G delete kar do",
            session_id=session_id,
            user=self.user,
            store_id=1,
            db=self.db
        )
        self.assertEqual(res["status"], "PENDING_CONFIRMATION")
        self.assertEqual(res["action"], "DELETE_PRODUCT")
        self.assertIn("Parle-G", res["response"])

        # Confirm deletion
        c_res = handle_conversational_inventory(
            query="Haan delete karo",
            session_id=session_id,
            user=self.user,
            store_id=1,
            db=self.db
        )
        self.assertEqual(c_res["status"], "CONFIRMED")
        deleted_prod = self.db.query(Product).filter(Product.id == 2).first()
        self.assertIsNone(deleted_prod)



if __name__ == "__main__":
    unittest.main()
