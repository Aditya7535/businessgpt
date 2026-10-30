from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from sqlalchemy.sql import func
from app.core.database import Base

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False, index=True)
    sku = Column(String(50), unique=True, nullable=False, index=True)
    barcode = Column(String(100), unique=False, nullable=True, index=True)
    category = Column(String(50), nullable=False, index=True)
    unit_price = Column(Float, nullable=False)
    current_stock = Column(Integer, default=0, nullable=False)
    reorder_point = Column(Integer, default=10, nullable=False)
    unit = Column(String(20), default="pcs", nullable=False)
    aliases = Column(Text, nullable=True)  # JSON-encoded array of recognized natural language aliases
    store_id = Column(Integer, default=1, index=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
