import json
import logging
from datetime import date, timedelta
import random
from sqlalchemy.orm import Session
from app.core.database import engine, SessionLocal, Base
from app.core.auth import hash_pin
import app.models  # Ensure all models are registered

from app.models.user import User
from app.models.product import Product
from app.models.stock_transaction import StockTransaction
from app.models.sales_data import SalesData
from app.models.alert import Alert
from app.models.store_setting import StoreSetting
from app.models.customer import Customer, CustomerSetting

logger = logging.getLogger("businessgpt.seed")


DEFAULT_USERS = [
    {"name": "Aditya (Owner)", "role": "OWNER", "pin": "1111", "phone": "+919876543210", "store_id": 1},
    {"name": "Rajesh (Manager)", "role": "MANAGER", "pin": "2222", "phone": "+919876543211", "store_id": 1},
    {"name": "Pooja (Counter)", "role": "EMPLOYEE", "pin": "3333", "phone": "+919876543212", "store_id": 1},
]

DEFAULT_PRODUCTS = [
    {
        "name": "Basmati Rice 5kg",
        "sku": "GROC-001",
        "category": "Grocery",
        "unit_price": 450.0,
        "current_stock": 42,
        "reorder_point": 15,
        "unit": "pack",
    },
    {
        "name": "Tata Salt 1kg",
        "sku": "GROC-002",
        "category": "Grocery",
        "unit_price": 28.0,
        "current_stock": 140,
        "reorder_point": 30,
        "unit": "pack",
    },
    {
        "name": "Fortune Sunflower Oil 1L",
        "sku": "GROC-003",
        "category": "Grocery",
        "unit_price": 145.0,
        "current_stock": 8,   # Low stock
        "reorder_point": 20,
        "unit": "ltr",
    },
    {
        "name": "Aashirvaad Shudh Chakki Atta 5kg",
        "sku": "GROC-004",
        "category": "Grocery",
        "unit_price": 260.0,
        "current_stock": 25,
        "reorder_point": 12,
        "unit": "pack",
    },
    {
        "name": "Maggi 2-Minute Noodles 70g",
        "sku": "SNACK-001",
        "category": "Snacks",
        "unit_price": 14.0,
        "current_stock": 310,
        "reorder_point": 60,
        "unit": "pack",
    },
    {
        "name": "Parle-G Gold Biscuits 250g",
        "sku": "SNACK-002",
        "category": "Snacks",
        "unit_price": 30.0,
        "current_stock": 185,
        "reorder_point": 40,
        "unit": "pack",
    },
    {
        "name": "Haldiram's Nagpur Aloo Bhujia 400g",
        "sku": "SNACK-003",
        "category": "Snacks",
        "unit_price": 115.0,
        "current_stock": 65,
        "reorder_point": 25,
        "unit": "pack",
    },
    {
        "name": "Dettol Original Soap 125g",
        "sku": "CARE-001",
        "category": "Personal Care",
        "unit_price": 55.0,
        "current_stock": 85,
        "reorder_point": 25,
        "unit": "pcs",
    },
    {
        "name": "Colgate MaxFresh Gel Paste 150g",
        "sku": "CARE-002",
        "category": "Personal Care",
        "unit_price": 98.0,
        "current_stock": 3,   # Critical stock
        "reorder_point": 15,
        "unit": "pcs",
    },
    {
        "name": "Amul Butter 500g",
        "sku": "DAIRY-001",
        "category": "Dairy",
        "unit_price": 275.0,
        "current_stock": 38,
        "reorder_point": 10,
        "unit": "pack",
    },
    {
        "name": "Amul Taaza Toned Milk 1L",
        "sku": "DAIRY-002",
        "category": "Dairy",
        "unit_price": 54.0,
        "current_stock": 50,
        "reorder_point": 20,
        "unit": "pack",
    },
    {
        "name": "Surf Excel Easy Wash 1kg",
        "sku": "HOME-001",
        "category": "Household",
        "unit_price": 140.0,
        "current_stock": 48,
        "reorder_point": 15,
        "unit": "pack",
    },
]

def _ensure_schema_migrations(eng):
    try:
        from sqlalchemy import text
        with eng.connect() as conn:
            is_sqlite = eng.dialect.name == "sqlite"
            if is_sqlite:
                cols = [r[1] for r in conn.execute(text("PRAGMA table_info(users)")).fetchall()]
                if "phone" not in cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN phone VARCHAR(30)"))
                if "store_id" not in cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN store_id INTEGER DEFAULT 1"))

                wa_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(whatsapp_registrations)")).fetchall()]
                if "user_id" not in wa_cols:
                    conn.execute(text("ALTER TABLE whatsapp_registrations ADD COLUMN user_id INTEGER"))
                if "opt_in_digest" not in wa_cols:
                    conn.execute(text("ALTER TABLE whatsapp_registrations ADD COLUMN opt_in_digest BOOLEAN DEFAULT 1"))
                if "opt_in_alerts" not in wa_cols:
                    conn.execute(text("ALTER TABLE whatsapp_registrations ADD COLUMN opt_in_alerts BOOLEAN DEFAULT 1"))
                if "last_digest_date" not in wa_cols:
                    conn.execute(text("ALTER TABLE whatsapp_registrations ADD COLUMN last_digest_date VARCHAR(20)"))

                bill_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(bills)")).fetchall()]
                if "customer_id" not in bill_cols:
                    conn.execute(text("ALTER TABLE bills ADD COLUMN customer_id INTEGER"))

                conn.commit()
            else:
                conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30)"))
                conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS store_id INTEGER DEFAULT 1"))
                conn.execute(text("ALTER TABLE whatsapp_registrations ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL"))
                conn.execute(text("ALTER TABLE whatsapp_registrations ADD COLUMN IF NOT EXISTS opt_in_digest BOOLEAN DEFAULT TRUE"))
                conn.execute(text("ALTER TABLE whatsapp_registrations ADD COLUMN IF NOT EXISTS opt_in_alerts BOOLEAN DEFAULT TRUE"))
                conn.execute(text("ALTER TABLE whatsapp_registrations ADD COLUMN IF NOT EXISTS last_digest_date VARCHAR(20)"))
                conn.execute(text("ALTER TABLE bills ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL"))
                conn.commit()
    except Exception as e:
        logger.warning(f"Schema migration warning: {e}")

def seed_database():
    """
    Idempotent database seeder.
    Creates schema tables and seeds initial users, products, sales_data, alerts, and settings if empty.
    """
    Base.metadata.create_all(bind=engine)
    _ensure_schema_migrations(engine)
    db: Session = SessionLocal()

    try:
        # 1. Seed Users
        user_count = db.query(User).count()
        if user_count == 0:
            logger.info("Seeding initial users...")
            for u in DEFAULT_USERS:
                db.add(User(
                    name=u["name"],
                    role=u["role"],
                    pin=hash_pin(u["pin"]),
                    phone=u.get("phone"),
                    store_id=u.get("store_id", 1)
                ))
            db.commit()
            logger.info("Users seeded successfully.")

        # 2. Seed Products
        product_count = db.query(Product).count()
        if product_count == 0:
            logger.info("Seeding initial products...")
            for p in DEFAULT_PRODUCTS:
                db.add(Product(
                    name=p["name"],
                    sku=p["sku"],
                    category=p["category"],
                    unit_price=p["unit_price"],
                    current_stock=p["current_stock"],
                    reorder_point=p["reorder_point"],
                    unit=p["unit"]
                ))
            db.commit()
            logger.info("Products seeded successfully.")

        # 3. Seed Stock Transactions & Pre-aggregated Sales Data
        sales_count = db.query(SalesData).count()
        if sales_count == 0:
            logger.info("Seeding historical pre-aggregated sales data (last 60 days)...")
            products = db.query(Product).all()
            today = date.today()
            random.seed(42)

            for prod in products:
                # Add initial stock transaction
                db.add(StockTransaction(
                    product_id=prod.id,
                    type="PURCHASE",
                    quantity=prod.current_stock + 50,
                    before_stock=0,
                    after_stock=prod.current_stock + 50,
                    notes="Initial opening stock received"
                ))

                # Generate 60 days of daily pre-aggregated sales
                base_qty = 4 if prod.unit_price > 200 else (12 if prod.unit_price < 50 else 7)
                for day_offset in range(60, 0, -1):
                    sale_date = today - timedelta(days=day_offset)
                    # Add weekend spike and random variance
                    day_factor = 1.3 if sale_date.weekday() in (5, 6) else 1.0
                    daily_qty = max(1, int(random.gauss(base_qty * day_factor, 2.5)))
                    daily_rev = round(daily_qty * prod.unit_price, 2)
                    daily_cost = round(daily_rev * 0.78, 2)  # ~22% gross margin

                    db.add(SalesData(
                        product_id=prod.id,
                        date=sale_date,
                        quantity_sold=daily_qty,
                        revenue=daily_rev,
                        cost=daily_cost
                    ))
            db.commit()
            logger.info("Pre-aggregated sales data seeded successfully.")

        # 4. Seed Initial Alerts
        alert_count = db.query(Alert).count()
        if alert_count == 0:
            logger.info("Seeding initial alerts...")
            db.add(Alert(
                alert_type="INVENTORY",
                severity="HIGH",
                message="Critical Stock Alert: Colgate MaxFresh Gel Paste 150g is at 3 pcs (Reorder point: 15 pcs). Immediate restock advised.",
                is_read=False
            ))
            db.add(Alert(
                alert_type="INVENTORY",
                severity="MEDIUM",
                message="Low Stock Warning: Fortune Sunflower Oil 1L is at 8 ltr (Reorder point: 20 ltr).",
                is_read=False
            ))
            db.add(Alert(
                alert_type="FESTIVAL",
                severity="MEDIUM",
                message="Upcoming Festival Season: Expect 45% demand spike for Snacks, Basmati Rice, and Ghee over next 2 weeks.",
                is_read=False
            ))
            db.add(Alert(
                alert_type="REVENUE",
                severity="LOW",
                message="Weekly Milestone: Weekend sales surged 28% compared to previous weekend.",
                is_read=False
            ))
            db.commit()
            logger.info("Alerts seeded successfully.")

        # 5. Seed WhatsApp Registration
        from app.models.whatsapp import WhatsAppRegistration
        wa_count = db.query(WhatsAppRegistration).count()
        if wa_count == 0:
            owner = db.query(User).filter(User.role == "OWNER").first()
            if owner and owner.phone:
                db.add(WhatsAppRegistration(
                    phone_number=owner.phone,
                    user_id=owner.id,
                    opt_in_digest=True,
                    opt_in_alerts=True
                ))
                db.commit()

        # 6. Seed Store Settings
        settings_count = db.query(StoreSetting).count()
        if settings_count == 0:
            logger.info("Seeding initial store settings...")
            default_settings = {
                "business_name": "Bharat General Store & Supermart",
                "owner_name": "Aditya",
                "address": "Shop No. 12, Main Market, MG Road, Mumbai, Maharashtra 400001",
                "gstin": "27AABCB1234F1Z5",
                "phone": "+91 98765 43210",
                "currency": "₹",
                "tax_rates": [5, 12, 18, 28],
                "default_tax_rate": 5,
                "theme": "dark",
                "low_stock_notification": True,
                "daily_summary_notification": True,
                "auto_backup": True,
            }
            for k, v in default_settings.items():
                val_str = json.dumps(v) if isinstance(v, (dict, list, bool, int, float)) else str(v)
                db.add(StoreSetting(key=k, value=val_str))
            db.commit()
            logger.info("Store settings seeded successfully.")

        # 7. Seed Customer Settings (Store 1)
        cust_settings = db.query(CustomerSetting).filter(CustomerSetting.store_id == 1).first()
        if not cust_settings:
            logger.info("Seeding initial customer settings...")
            db.add(CustomerSetting(
                store_id=1,
                enabled=False,
                allow_walk_in=True,
                customer_selection_optional=True,
                save_purchase_history=False,
                require_consent=False,
                enabled_fields='["full_name", "phone"]',
                required_fields='[]'
            ))
            db.commit()
            logger.info("Customer settings seeded successfully.")

    except Exception as e:
        db.rollback()
        logger.error(f"Error during database seeding: {e}", exc_info=True)
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    seed_database()
