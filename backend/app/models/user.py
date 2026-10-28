from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False, index=True)  # EMPLOYEE, MANAGER, OWNER
    pin = Column(String(255), nullable=False)
    phone = Column(String(30), nullable=True, unique=True, index=True)  # E.164 e.g. +919876543210
    created_at = Column(DateTime(timezone=True), server_default=func.now())
