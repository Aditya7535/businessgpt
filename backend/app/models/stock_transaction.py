from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.core.database import Base

class StockTransaction(Base):
    __tablename__ = "stock_transactions"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    type = Column(String(20), nullable=False)  # SALE, PURCHASE, ADJUSTMENT, RETURN, RESTOCK, DAMAGED, CORRECTION
    movement_type = Column(String(50), nullable=True)  # RESTOCK, SALE, DAMAGED, EXPIRED, RETURN_TO_SUPPLIER, CUSTOMER_RETURN, CORRECTION
    quantity = Column(Integer, nullable=False)
    before_stock = Column(Integer, nullable=False)
    after_stock = Column(Integer, nullable=False)
    unit = Column(String(20), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    store_id = Column(Integer, nullable=True, default=1, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=True, index=True)
    source = Column(String(50), nullable=True, default="manual")  # ai_chat, voice, whatsapp, pos, manual
    reference = Column(String(100), nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    notes = Column(Text, nullable=True)
