from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.api import upload, chat, auth, pos
from app.api import inventory as inventory_api
from app.api import analytics as analytics_api
from app.api import settings as settings_api
from app.modules.forecasting.router import router as forecast_router
from app.modules.inventory.router import router as legacy_inventory_router
from app.modules.alerts.router import router as alerts_router
from app.modules.health.router import router as health_router
from app.modules.reports.router import router as reports_router
from app.modules.market_intel.router import router as market_intel_router
from app.modules.whatsapp.router import router as whatsapp_router
from app.api.voice import router as voice_router
from app.modules.alerts.scheduler import start_scheduler, stop_scheduler
from app.core.seed import seed_database


# Import all models so they are registered with Base
import app.models  # noqa: F401

import time
import logging
from app.core.config import settings

logger = logging.getLogger("businessgpt")

app = FastAPI(
    title="BusinessGPT API",
    description="AI-powered Business Intelligence Platform for Indian SMEs",
    version="8.0.0"
)

# Configure CORS
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
is_wildcard = not origins or "*" in origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if is_wildcard else origins,
    allow_credentials=not is_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Startup / Shutdown ──
@app.on_event("startup")
async def startup_event():
    # Attempt DB table creation and initial seeding
    for attempt in range(1, 6):
        try:
            seed_database()
            logger.info("Database tables and seed data initialized successfully.")
            break
        except Exception as e:
            logger.warning(f"Database connection attempt {attempt}/5 failed: {e}")
            if attempt < 5:
                time.sleep(2)
            else:
                logger.error("Could not connect to database after 5 attempts. App will start, but DB features may fail.")

    try:
        start_scheduler()
    except Exception as e:
        logger.error(f"Scheduler startup error: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    stop_scheduler()

# ── Include Routers ──
app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(pos.router, prefix="/api", tags=["pos"])
app.include_router(inventory_api.router, prefix="/api", tags=["inventory"])
app.include_router(analytics_api.router, prefix="/api", tags=["analytics"])
app.include_router(settings_api.router, prefix="/api", tags=["settings"])
app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(forecast_router, prefix="/api", tags=["forecasting"])
app.include_router(alerts_router, prefix="/api", tags=["alerts"])
app.include_router(health_router, prefix="/api", tags=["health"])
app.include_router(reports_router, prefix="/api", tags=["reports"])
app.include_router(market_intel_router, prefix="/api", tags=["market_intel"])
app.include_router(voice_router, prefix="/api", tags=["voice"])
app.include_router(whatsapp_router, prefix="/api/whatsapp", tags=["whatsapp"])


@app.get("/")
def read_root():
    return {"message": "Welcome to BusinessGPT API v8.0 — Active!"}

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "BusinessGPT API"}

@app.get("/api/db-status")
def db_status():
    import traceback
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        
        from app.models.user import User
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            # If users don't exist, seed now
            count = db.query(User).count()
            if count == 0:
                seed_database()
                count = db.query(User).count()
            users = [{"id": u.id, "name": u.name, "role": u.role} for u in db.query(User).all()]
            return {"status": "ok", "user_count": count, "users": users, "driver": engine.dialect.driver}
        except Exception as q_err:
            try:
                seed_database()
                count = db.query(User).count()
                users = [{"id": u.id, "name": u.name, "role": u.role} for u in db.query(User).all()]
                return {"status": "re-seeded_ok", "user_count": count, "users": users}
            except Exception as s_err:
                return {
                    "status": "seed_failed",
                    "query_error": str(q_err),
                    "seed_error": str(s_err),
                    "traceback": traceback.format_exc()
                }
        finally:
            db.close()
    except Exception as e:
        return {
            "status": "database_connection_error",
            "error": str(e),
            "traceback": traceback.format_exc()
        }
