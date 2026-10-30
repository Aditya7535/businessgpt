from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class PendingInventoryAdjustment(Base):
    """
    Temporary / staged conversational inventory adjustment awaiting owner confirmation.
    Guarantees that no inventory changes occur without explicit owner approval.
    """
    __tablename__ = "pending_inventory_adjustments"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), nullable=False, index=True)
    store_id = Column(Integer, nullable=False, default=1, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(20), nullable=False, default="PENDING", index=True)  # PENDING, CONFIRMED, CANCELLED, EXPIRED
    summary_text = Column(Text, nullable=True)
    movements_json = Column(Text, nullable=False)  # JSON-serialized list of parsed and verified movements
    source = Column(String(50), nullable=False, default="ai_chat")  # ai_chat, voice, whatsapp, pos, manual
    idempotency_key = Column(String(100), unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
