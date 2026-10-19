from sqlalchemy import Column, Integer, Float, Date, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base

class SalesData(Base):
    __tablename__ = "sales_data"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    quantity_sold = Column(Integer, default=0, nullable=False)
    revenue = Column(Float, default=0.0, nullable=False)
    cost = Column(Float, default=0.0, nullable=False)

    product = relationship("Product")

    __table_args__ = (
        Index("idx_sales_data_date_product", "date", "product_id"),
    )
