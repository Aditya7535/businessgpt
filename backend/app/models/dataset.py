from sqlalchemy import Column, Integer, String, DateTime, JSON
from datetime import datetime, timezone
from app.core.database import Base

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    upload_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    row_count = Column(Integer)
    columns = Column(JSON)
    data = Column(JSON)
    # Auto-detected type: 'sales' | 'customers' | 'inventory' | 'financial' | 'unknown'
    dataset_type = Column(String, default="unknown", nullable=False, server_default="unknown")