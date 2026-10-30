from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class Bill(Base):
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, index=True)
    bill_number = Column(String(50), unique=True, nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    total_amount = Column(Float, nullable=False)
    tax_amount = Column(Float, default=0.0)
    payment_method = Column(String(20), nullable=False)  # Cash, UPI, Card
    status = Column(String(20), default="COMPLETED")     # COMPLETED, CANCELLED, REFUNDED
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    items = relationship("BillItem", back_populates="bill", cascade="all, delete-orphan")
    customer = relationship("Customer", backref="bills", foreign_keys=[customer_id])


class BillItem(Base):
    __tablename__ = "bill_items"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    subtotal = Column(Float, nullable=False)

    bill = relationship("Bill", back_populates="items")
    product = relationship("Product")
