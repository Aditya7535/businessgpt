from sqlalchemy import Column, Integer, String, JSON, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.sql import func
from app.core.database import Base


class WhatsAppSession(Base):
    __tablename__ = "whatsapp_sessions"

    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String(30), unique=True, nullable=False, index=True)
    messages = Column(JSON, default=list)       # last 10 messages
    last_active = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    is_registered = Column(Boolean, default=True)


class WhatsAppRegistration(Base):
    __tablename__ = "whatsapp_registrations"

    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String(30), unique=True, nullable=False, index=True)  # E.164 format (+91...)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    registered_at = Column(DateTime(timezone=True), server_default=func.now())
    opt_in_digest = Column(Boolean, default=True)
    opt_in_alerts = Column(Boolean, default=True)
    last_digest_date = Column(String(20), nullable=True)  # YYYY-MM-DD string to prevent duplicate daily summaries


class WhatsAppMessageLog(Base):
    """
    Message log table used for Twilio webhook idempotency (MessageSid deduplication)
    and tracking inbound/outbound event delivery status.
    """
    __tablename__ = "whatsapp_message_logs"

    id = Column(Integer, primary_key=True, index=True)
    message_sid = Column(String(100), unique=True, nullable=False, index=True)
    phone_number = Column(String(30), index=True)
    direction = Column(String(10), default="inbound")  # "inbound" | "outbound"
    body = Column(Text, nullable=True)
    processed_at = Column(DateTime(timezone=True), server_default=func.now())
