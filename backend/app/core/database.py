import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings, _normalize_database_url

logger = logging.getLogger("businessgpt.database")

Base = declarative_base()

def _create_resilient_engine():
    target_url = _normalize_database_url(settings.DATABASE_URL)
    is_sqlite = target_url.startswith("sqlite")
    
    kwargs = {"pool_pre_ping": True}
    if is_sqlite:
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        kwargs["pool_recycle"] = 300

    try:
        candidate_engine = create_engine(target_url, **kwargs)
        with candidate_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info(f"Database connected successfully with driver: {candidate_engine.dialect.driver}")
        return candidate_engine
    except Exception as exc:
        if is_sqlite:
            # If SQLite failed, re-raise
            raise exc
        
        logger.warning(
            f"Configured database connection failed ({exc}). "
            "Falling back to built-in SQLite database (businessgpt.db) so the app stays functional."
        )
        fallback_engine = create_engine("sqlite:///./businessgpt.db", pool_pre_ping=True, connect_args={"check_same_thread": False})
        return fallback_engine

engine = _create_resilient_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
