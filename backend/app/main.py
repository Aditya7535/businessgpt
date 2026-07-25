from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.api import upload, chat
from app.modules.forecasting.router import router as forecast_router
from app.modules.inventory.router import router as inventory_router

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="BusinessGPT API",
    description="Backend API for the AI-powered Business Intelligence Platform",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(forecast_router, prefix="/api", tags=["forecasting"])
app.include_router(inventory_router, prefix="/api", tags=["inventory"])

@app.get("/")
def read_root():
    return {"message": "Welcome to BusinessGPT API"}
