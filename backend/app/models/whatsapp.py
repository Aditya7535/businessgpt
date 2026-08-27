from sqlalchemy import Column, Integer, String, JSON, DateTime, Boolean
from sqlalchemy.sql import func
from app.core.database import Base


class WhatsAppSession(Base):
    __tablename__ = "whatsapp_sessions"

    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String(20), unique=True, nullable=False, index=True)
    messages = Column(JSON, default=list)       # last 10 messages
    last_active = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    is_registered = Column(Boolean, default=True)


class WhatsAppRegistration(Base):
    __tablename__ = "whatsapp_registrations"

    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String(20), unique=True, nullable=False, index=True)
    registered_at = Column(DateTime(timezone=True), server_default=func.now())
