from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.api import upload, chat
from app.modules.forecasting.router import router as forecast_router
from app.modules.inventory.router import router as inventory_router
from app.modules.market_intel.router import router as market_router
from app.modules.alerts.router import router as alerts_router
from app.modules.health.router import router as health_router
from app.modules.reports.router import router as reports_router
from app.modules.whatsapp.router import router as whatsapp_router
from app.modules.alerts.scheduler import start_scheduler, stop_scheduler

# Import models so they are registered with Base
import app.models.alert      # noqa: F401
import app.models.whatsapp   # noqa: F401

# Create database tables (including alerts)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="BusinessGPT API",
    description="AI-powered Business Intelligence Platform for Indian SMEs",
    version="5.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Startup / Shutdown ──
@app.on_event("startup")
async def startup_event():
    start_scheduler()

@app.on_event("shutdown")
async def shutdown_event():
    stop_scheduler()

# ── Include Routers ──
app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(forecast_router, prefix="/api", tags=["forecasting"])
app.include_router(inventory_router, prefix="/api", tags=["inventory"])
app.include_router(market_router, prefix="/api", tags=["market_intel"])
app.include_router(alerts_router, prefix="/api", tags=["alerts"])
app.include_router(health_router, prefix="/api", tags=["health"])
app.include_router(reports_router, prefix="/api", tags=["reports"])
app.include_router(whatsapp_router, prefix="/api", tags=["whatsapp"])

@app.get("/")
def read_root():
    return {"message": "Welcome to BusinessGPT API v7.0 — Phase 7 Active (WhatsApp)!"}
