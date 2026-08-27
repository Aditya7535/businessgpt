from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from app.models.whatsapp import WhatsAppSession

MAX_HISTORY = 10   # messages per session


def get_or_create_session(db: Session, phone_number: str) -> WhatsAppSession:
    """Get existing session or create a new one for this phone number."""
    session = db.query(WhatsAppSession).filter(
        WhatsAppSession.phone_number == phone_number
    ).first()

    if not session:
        session = WhatsAppSession(phone_number=phone_number, messages=[])
        db.add(session)
        db.commit()
        db.refresh(session)

    return session


def add_message(db: Session, phone_number: str, role: str, content: str):
    """Append a message to the session history (keep last MAX_HISTORY)."""
    session = get_or_create_session(db, phone_number)
    history = list(session.messages or [])
    history.append({"role": role, "content": content})

    # Keep only last MAX_HISTORY messages
    if len(history) > MAX_HISTORY:
        history = history[-MAX_HISTORY:]

    session.messages = history
    db.commit()


def get_session_id(phone_number: str) -> str:
    """Convert phone number to a consistent session ID for the orchestrator."""
    return f"wa_{phone_number.replace('+', '').replace(':', '_')}"


def get_all_registered_numbers(db: Session) -> List[str]:
    """Return all phone numbers that have active sessions / are registered."""
    from app.models.whatsapp import WhatsAppRegistration
    rows = db.query(WhatsAppRegistration.phone_number).all()
    return [r.phone_number for r in rows]


def register_number(db: Session, phone_number: str) -> bool:
    """Register a phone number for proactive alerts. Returns True if new."""
    from app.models.whatsapp import WhatsAppRegistration
    existing = db.query(WhatsAppRegistration).filter(
        WhatsAppRegistration.phone_number == phone_number
    ).first()
    if existing:
        return False

    reg = WhatsAppRegistration(phone_number=phone_number)
    db.add(reg)
    db.commit()
    return True
