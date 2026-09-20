FROM python:3.11-slim

# Avoid buffering and bytecode write
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system build dependencies required for Prophet, Scikit-learn, and ChromaDB
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Create directory for persistent ChromaDB vector store and uploads
RUN mkdir -p /app/data/chromadb

# Copy application source code
COPY . .

# Expose default backend port
EXPOSE 8000

# Run FastAPI app with Uvicorn (uses PORT env var if provided by cloud platforms like Render / Cloud Run)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
