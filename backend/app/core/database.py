from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

raw_url = (settings.DATABASE_URL or "").strip()
if not raw_url:
    db_url = "sqlite:///./businessgpt.db"
elif raw_url.startswith("postgres://"):
    db_url = raw_url.replace("postgres://", "postgresql+pg8000://", 1)
elif raw_url.startswith("postgresql://") and not raw_url.startswith("postgresql+"):
    db_url = raw_url.replace("postgresql://", "postgresql+pg8000://", 1)
else:
    db_url = raw_url

is_sqlite = db_url.startswith("sqlite")
engine_kwargs = {
    "pool_pre_ping": True,
}
if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_recycle"] = 300

engine = create_engine(
    db_url,
    **engine_kwargs
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
