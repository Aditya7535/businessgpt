import json
import logging
from sqlalchemy import text, inspect
from app.core.database import engine, Base
import app.models

logger = logging.getLogger("businessgpt.migrations")

# Default aliases mapping for common Indian grocery & retail catalog items
PRODUCT_ALIASES_MAP = {
    "GROC-001": {
        "barcode": "8901030382012",
        "aliases": ["chawal", "rice", "basmati", "basmati chawal", "tandool", "tandul", "rice packet"]
    },
    "GROC-002": {
        "barcode": "8901030382029",
        "aliases": ["salt", "namak", "tata salt", "tata namak", "meeth"]
    },
    "GROC-003": {
        "barcode": "8901030382036",
        "aliases": ["oil", "tel", "sunflower oil", "fortune oil", "fortune tel", "cooking oil"]
    },
    "GROC-004": {
        "barcode": "8901030382043",
        "aliases": ["atta", "aata", "chakki atta", "aashirvaad atta", "wheat flour", "peeth"]
    },
    "SNACK-001": {
        "barcode": "8901030382050",
        "aliases": ["maggi", "noodles", "maggie", "maggi packet", "maggi noodles", "2 minute noodles"]
    },
    "SNACK-002": {
        "barcode": "8901030382067",
        "aliases": ["parle-g", "parle", "parle g", "biscuit", "biscuits", "parle biscuit", "glucose biscuit"]
    },
    "SNACK-003": {
        "barcode": "8901030382074",
        "aliases": ["bhujia", "aloo bhujia", "haldiram bhujia", "haldirams", "sev"]
    },
    "CARE-001": {
        "barcode": "8901030382081",
        "aliases": ["dettol", "dettol soap", "soap", "sabun", "bath soap"]
    },
    "CARE-002": {
        "barcode": "8901030382098",
        "aliases": ["colgate", "paste", "toothpaste", "colgate paste", "colgate maxfresh"]
    },
    "DAIRY-001": {
        "barcode": "8901030382104",
        "aliases": ["butter", "amul butter", "maska", "loni", "makhan"]
    },
    "DAIRY-002": {
        "barcode": "8901030382111",
        "aliases": ["milk", "doodh", "amul milk", "amul taaza", "dudh", "packet milk"]
    },
    "HOME-001": {
        "barcode": "8901030382128",
        "aliases": ["surf excel", "surf", "detergent", "washing powder", "nirma"]
    }
}


def run_migrations():
    """
    Ensures newly added columns and tables are created seamlessly
    without destroying existing database state.
    """
    logger.info("Checking database schema migrations...")
    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        inspector = inspect(engine)

        # 1. Migrate `products` table
        product_cols = [c["name"] for c in inspector.get_columns("products")]
        if "barcode" not in product_cols:
            logger.info("Adding barcode column to products table...")
            conn.execute(text("ALTER TABLE products ADD COLUMN barcode VARCHAR(100)"))
        if "aliases" not in product_cols:
            logger.info("Adding aliases column to products table...")
            conn.execute(text("ALTER TABLE products ADD COLUMN aliases TEXT"))
        if "store_id" not in product_cols:
            logger.info("Adding store_id column to products table...")
            conn.execute(text("ALTER TABLE products ADD COLUMN store_id INTEGER DEFAULT 1"))

        # 2. Migrate `stock_transactions` table
        st_cols = [c["name"] for c in inspector.get_columns("stock_transactions")]
        if "movement_type" not in st_cols:
            logger.info("Adding movement_type column to stock_transactions table...")
            conn.execute(text("ALTER TABLE stock_transactions ADD COLUMN movement_type VARCHAR(50)"))
        if "store_id" not in st_cols:
            logger.info("Adding store_id column to stock_transactions table...")
            conn.execute(text("ALTER TABLE stock_transactions ADD COLUMN store_id INTEGER DEFAULT 1"))
        if "source" not in st_cols:
            logger.info("Adding source column to stock_transactions table...")
            conn.execute(text("ALTER TABLE stock_transactions ADD COLUMN source VARCHAR(50) DEFAULT 'manual'"))
        if "unit" not in st_cols:
            logger.info("Adding unit column to stock_transactions table...")
            conn.execute(text("ALTER TABLE stock_transactions ADD COLUMN unit VARCHAR(20)"))
        if "reference" not in st_cols:
            logger.info("Adding reference column to stock_transactions table...")
            conn.execute(text("ALTER TABLE stock_transactions ADD COLUMN reference VARCHAR(100)"))

        # 3. Populate product aliases and barcodes if empty
        try:
            for sku, info in PRODUCT_ALIASES_MAP.items():
                aliases_str = json.dumps(info["aliases"])
                barcode_str = info["barcode"]
                conn.execute(
                    text("UPDATE products SET aliases = :aliases, barcode = :barcode WHERE sku = :sku AND (aliases IS NULL OR aliases = '')"),
                    {"aliases": aliases_str, "barcode": barcode_str, "sku": sku}
                )
        except Exception as e:
            logger.warning(f"Could not update product aliases: {e}")

        conn.commit()
    logger.info("Database schema migrations verified and up to date.")
