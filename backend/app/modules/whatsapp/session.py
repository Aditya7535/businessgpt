import re
import logging
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from app.models.whatsapp import WhatsAppSession, WhatsAppRegistration, WhatsAppMessageLog
from app.models.user import User

logger = logging.getLogger(__name__)

MAX_HISTORY = 10   # messages per session


def normalize_phone_number(phone: str) -> str:
    """
    Standardizes WhatsApp phone strings (e.g. 'whatsapp:+919876543210' -> '+919876543210').
    Ensures E.164-style '+' prefix if international country code is present.
    """
    cleaned = (phone or "").strip().replace("whatsapp:", "").replace(" ", "").replace("-", "")
    if cleaned and not cleaned.startswith("+"):
        # If standard 10 digit Indian number without country code, prefix +91
        if len(cleaned) == 10 and cleaned.isdigit():
            cleaned = f"+91{cleaned}"
        elif cleaned.isdigit():
            cleaned = f"+{cleaned}"
    return cleaned


def get_authorized_user_by_phone(db: Session, phone_number: str) -> Optional[User]:
    """
    Resolves a phone number to an authorized BusinessGPT store User.
    First checks direct User.phone, then checks linked WhatsAppRegistration.user_id.
    """
    clean_phone = normalize_phone_number(phone_number)
    if not clean_phone:
        return None

    # 1. Direct match on User.phone
    user = db.query(User).filter(User.phone == clean_phone).first()
    if user:
        return user

    # 2. Match via WhatsAppRegistration with linked user_id
    reg = db.query(WhatsAppRegistration).filter(
        WhatsAppRegistration.phone_number == clean_phone
    ).first()
    if reg and reg.user_id:
        linked_user = db.query(User).filter(User.id == reg.user_id).first()
        if linked_user:
            return linked_user

    # 3. Match without '+' prefix if stored in alternate format
    bare_digits = clean_phone.lstrip("+")
    user_bare = db.query(User).filter(
        (User.phone == bare_digits) | (User.phone.like(f"%{bare_digits}"))
    ).first()
    if user_bare:
        return user_bare

    return None


def is_phone_authorized(db: Session, phone_number: str) -> bool:
    """Returns True if the sender is mapped to an authorized store account."""
    user = get_authorized_user_by_phone(db, phone_number)
    return user is not None


def link_phone_to_user(
    db: Session,
    phone_number: str,
    user_id: int,
    opt_in_digest: bool = True,
    opt_in_alerts: bool = True
) -> WhatsAppRegistration:
    """Links a phone number to an authorized store User account and saves notification preferences."""
    clean_phone = normalize_phone_number(phone_number)
    
    # Update user's direct phone attribute
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.phone = clean_phone

    reg = db.query(WhatsAppRegistration).filter(
        WhatsAppRegistration.phone_number == clean_phone
    ).first()

    if not reg:
        reg = WhatsAppRegistration(
            phone_number=clean_phone,
            user_id=user_id,
            opt_in_digest=opt_in_digest,
            opt_in_alerts=opt_in_alerts
        )
        db.add(reg)
    else:
        reg.user_id = user_id
        reg.opt_in_digest = opt_in_digest
        reg.opt_in_alerts = opt_in_alerts

    db.commit()
    db.refresh(reg)
    return reg


def is_message_duplicate(db: Session, message_sid: str) -> bool:
    """Checks if a Twilio message SID has already been processed to guarantee webhook idempotency."""
    if not message_sid:
        return False
    return db.query(WhatsAppMessageLog).filter(
        WhatsAppMessageLog.message_sid == message_sid
    ).first() is not None


def log_message(
    db: Session,
    message_sid: str,
    phone_number: str,
    direction: str = "inbound",
    body: str = ""
) -> Optional[WhatsAppMessageLog]:
    """Records message delivery in idempotency and event log."""
    if not message_sid:
        return None
    try:
        log_entry = WhatsAppMessageLog(
            message_sid=message_sid,
            phone_number=normalize_phone_number(phone_number),
            direction=direction,
            body=(body or "")[:500]
        )
        db.add(log_entry)
        db.commit()
        return log_entry
    except Exception as e:
        db.rollback()
        logger.warning(f"Failed to log WhatsApp message {message_sid}: {e}")
        return None


def get_or_create_session(db: Session, phone_number: str) -> WhatsAppSession:
    """Get existing conversational session or create a new one for this phone number."""
    clean_phone = normalize_phone_number(phone_number)
    session = db.query(WhatsAppSession).filter(
        WhatsAppSession.phone_number == clean_phone
    ).first()

    if not session:
        session = WhatsAppSession(phone_number=clean_phone, messages=[])
        db.add(session)
        db.commit()
        db.refresh(session)

    return session


def add_message(db: Session, phone_number: str, role: str, content: str):
    """Append a message to the session history (keeps last MAX_HISTORY)."""
    clean_phone = normalize_phone_number(phone_number)
    session = get_or_create_session(db, clean_phone)
    history = list(session.messages or [])
    history.append({"role": role, "content": content})

    if len(history) > MAX_HISTORY:
        history = history[-MAX_HISTORY:]

    session.messages = history
    db.commit()


def get_session_id(phone_number: str) -> str:
    """Convert phone number to a consistent session ID for the orchestrator."""
    clean = normalize_phone_number(phone_number).replace("+", "").replace(":", "_")
    return f"wa_{clean}"


def get_all_registered_numbers(db: Session) -> List[str]:
    """Return all phone numbers that have active sessions / registrations."""
    rows = db.query(WhatsAppRegistration.phone_number).all()
    return [r.phone_number for r in rows]


def get_digest_subscribers(db: Session) -> List[WhatsAppRegistration]:
    """Returns active registrations that have opted in to daily digest notifications."""
    return db.query(WhatsAppRegistration).filter(
        WhatsAppRegistration.opt_in_digest == True
    ).all()


def update_subscriber_digest_date(db: Session, phone_number: str, date_str: str):
    """Updates last_digest_date for a subscriber to prevent duplicate digests on the same day."""
    clean_phone = normalize_phone_number(phone_number)
    reg = db.query(WhatsAppRegistration).filter(
        WhatsAppRegistration.phone_number == clean_phone
    ).first()
    if reg:
        reg.last_digest_date = date_str
        db.commit()


def register_number(db: Session, phone_number: str, user_id: Optional[int] = None) -> bool:
    """Register a phone number for proactive alerts. Returns True if newly added."""
    clean_phone = normalize_phone_number(phone_number)
    existing = db.query(WhatsAppRegistration).filter(
        WhatsAppRegistration.phone_number == clean_phone
    ).first()
    if existing:
        if user_id and existing.user_id != user_id:
            existing.user_id = user_id
            db.commit()
        return False

    reg = WhatsAppRegistration(
        phone_number=clean_phone,
        user_id=user_id,
        opt_in_digest=True,
        opt_in_alerts=True
    )
    db.add(reg)
    db.commit()
    return True
