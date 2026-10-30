import json
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, nullable=False, default=1, index=True)
    full_name = Column(String(150), nullable=True, index=True)
    phone = Column(String(30), nullable=True, index=True)
    email = Column(String(150), nullable=True, index=True)
    billing_address = Column(Text, nullable=True)
    date_of_birth = Column(String(30), nullable=True)
    notes = Column(Text, nullable=True)
    consent_given = Column(Boolean, default=False, nullable=False)
    consent_timestamp = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_customers_store_phone", "store_id", "phone"),
        Index("ix_customers_store_name", "store_id", "full_name"),
    )


class CustomerSetting(Base):
    __tablename__ = "customer_settings"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, unique=True, nullable=False, index=True, default=1)
    enabled = Column(Boolean, default=False, nullable=False)
    allow_walk_in = Column(Boolean, default=True, nullable=False)
    customer_selection_optional = Column(Boolean, default=True, nullable=False)
    save_purchase_history = Column(Boolean, default=False, nullable=False)
    require_consent = Column(Boolean, default=False, nullable=False)
    
    # JSON list of enabled field keys e.g. ["full_name", "phone"]
    enabled_fields = Column(Text, nullable=False, default='["full_name", "phone"]')
    # JSON list of required field keys e.g. []
    required_fields = Column(Text, nullable=False, default='[]')
    
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    @property
    def enabled_fields_list(self):
        try:
            return json.loads(self.enabled_fields) if self.enabled_fields else []
        except Exception:
            return ["full_name", "phone"]

    @property
    def required_fields_list(self):
        try:
            return json.loads(self.required_fields) if self.required_fields else []
        except Exception:
            return []
