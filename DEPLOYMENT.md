# 🚀 BusinessGPT Production Deployment Guide

This guide covers everything you need to deploy **BusinessGPT** to production across multiple platforms.

---

## 📋 Architecture Overview

BusinessGPT consists of:
1. **Frontend**: React + Vite SPA with TailwindCSS and Lucide Icons.
2. **Backend**: FastAPI (Python 3.11) with LangGraph, Groq LLM, Prophet forecasting, Scikit-learn, and APScheduler.
3. **Database**: PostgreSQL (relational store for datasets, chats, alerts, and sessions).
4. **Vector Store**: ChromaDB (stores vector embeddings of tabular datasets).
5. **AI Services**:
   - **LLM**: Groq Cloud API (`llama-3.1-8b-instant` / `openai/gpt-oss-20b`).
   - **Embeddings**: Ollama (`nomic-embed-text`) or external embedding service.

---

## 🔑 Environment Variables Checklist

Before deploying, ensure you have your API keys ready:

| Variable | Required | Description | Example |
|---|:---:|---|---|
| `DATABASE_URL` | **Yes** | PostgreSQL connection URL | `postgresql+pg8000://user:pass@host:5432/dbname` |
| `GROQ_API_KEY` | **Yes** | Groq Cloud API Key | `gsk_...` (Get at [console.groq.com](https://console.groq.com)) |
| `NEWSAPI_KEY` | Optional | For Market Intelligence news | Get at [newsapi.org](https://newsapi.org) |
| `TWILIO_ACCOUNT_SID` | Optional | WhatsApp messaging | `AC...` from Twilio Console |
| `TWILIO_AUTH_TOKEN` | Optional | WhatsApp auth token | `...` from Twilio Console |
| `TWILIO_WHATSAPP_NUMBER` | Optional | Sender WhatsApp number | `whatsapp:+14155238886` |
| `FRONTEND_URL` | Recommended | URL where frontend is hosted | `https://businessgpt.vercel.app` |
| `VITE_API_URL` | Frontend | Deployed backend URL | `https://businessgpt-api.onrender.com` |
| `CORS_ORIGINS` | Optional | Allowed CORS domains | `*` or comma-separated list |
| `OLLAMA_BASE_URL` | Optional | Ollama embedding host | `http://ollama:11434` or local host |

---

## 🌟 Option 1: Cloud PaaS (Vercel + Render / Railway + Neon / Supabase)
> **Best for:** Fastest setup, zero server maintenance, free/low-cost tiers.

### Step 1: Set Up Free PostgreSQL Database
You can use **Neon.tech** or **Supabase**:
1. Sign up at [neon.tech](https://neon.tech) (Free serverless Postgres) or [supabase.com](https://supabase.com).
2. Create a new project named `businessgpt`.
3. Copy the **Connection String** (URI).
   > **Note:** BusinessGPT automatically normalizes `postgres://` or `postgresql://` to `postgresql+pg8000://` so you can paste the URI directly.

---

### Step 2: Deploy Backend to Render
1. Push your repository to GitHub / GitLab.
2. Sign in to [render.com](https://render.com) and click **New +** $\rightarrow$ **Web Service**.
3. Connect your repository.
4. Set the following details:
   - **Name**: `businessgpt-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**:
     ```bash
     pip install --upgrade pip && pip install -r requirements.txt
     ```
   - **Start Command**:
     ```bash
     uvicorn app.main:app --host 0.0.0.0 --port $PORT
     ```
   - **Health Check Path**: `/health`
5. In **Environment Variables**, add:
   - `DATABASE_URL`: *(Your Postgres connection string from Step 1)*
   - `GROQ_API_KEY`: `gsk_...`
   - `NEWSAPI_KEY`: *(Optional)*
   - `CORS_ORIGINS`: `*`
   - `FRONTEND_URL`: `https://your-frontend-url.vercel.app` (update after Step 3)
6. Click **Deploy Web Service**. Once deployed, copy your backend URL (e.g. `https://businessgpt-backend.onrender.com`).

---

### Step 3: Deploy Frontend to Vercel
1. Sign in to [vercel.com](https://vercel.com) and click **Add New...** $\rightarrow$ **Project**.
2. Select your repository.
3. Configure the project settings:
   - **Root Directory**: Click edit and select `frontend`.
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Under **Environment Variables**, add:
   - `VITE_API_URL`: `https://businessgpt-backend.onrender.com` *(Your Render backend URL from Step 2)*
5. Click **Deploy**.
6. That's it! Your frontend is live with SSL and automatic edge CDN caching.

---

## 🐳 Option 2: Self-Hosted / VPS with Docker Compose
> **Best for:** Complete control, privacy, hosting on AWS EC2, DigitalOcean, Hetzner, or an on-premise Linux server.

The included `docker-compose.yml` orchestrates:
- **PostgreSQL 15** container with persistent volume
- **FastAPI backend** container
- **React frontend** served via **Nginx** with reverse proxy
- *(Optional)* **Ollama** embedding container

### Step 1: Connect to your Server
SSH into your Ubuntu/Debian server:
```bash
ssh user@your-server-ip
```

### Step 2: Install Docker & Docker Compose
```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Log out and log back in for group changes to take effect
exit
```

### Step 3: Clone Repository & Configure Environment
```bash
git clone https://github.com/YOUR_USERNAME/businessgpt.git
cd businessgpt

# Copy example environment file
cp .env.example .env
nano .env
```
Fill in your `GROQ_API_KEY`, database credentials, and optional keys.

### Step 4: Launch the Application
```bash
# Build and start all services in background
docker compose up -d --build
```

To verify running containers:
```bash
docker compose ps
```

To check backend logs:
```bash
docker compose logs -f backend
```

Your app is now accessible:
- **Frontend**: `http://your-server-ip:3000` (or port 80)
- **Backend API**: `http://your-server-ip:8000/docs`
- **Health Check**: `http://your-server-ip:8000/health`

### Step 5: (Optional) Run Ollama for Local Embeddings
If you wish to run the embedding model inside Docker:
```bash
docker compose --profile with-ollama up -d
docker exec -it businessgpt-ollama ollama pull nomic-embed-text
```

### Step 6: Set Up HTTPS / SSL with Nginx & Certbot (Production Domain)
To map a custom domain (e.g. `businessgpt.yourdomain.com`) with free SSL:
```bash
sudo apt install -y nginx certbot python3-certbot-nginx

# Configure /etc/nginx/sites-available/businessgpt
sudo nano /etc/nginx/sites-available/businessgpt
```
Paste this configuration:
```nginx
server {
    server_name businessgpt.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Enable the site and obtain SSL:
```bash
sudo ln -s /etc/nginx/sites-available/businessgpt /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d businessgpt.yourdomain.com
```

---

## ☁️ Option 3: Google Cloud Run / AWS Container Deployment

### Google Cloud Run
1. Build and push backend image to Google Artifact Registry:
   ```bash
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/businessgpt-backend ./backend
   ```
2. Deploy to Cloud Run:
   ```bash
   gcloud run deploy businessgpt-backend \
     --image gcr.io/YOUR_PROJECT_ID/businessgpt-backend \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars "DATABASE_URL=...,GROQ_API_KEY=...,CORS_ORIGINS=*"
   ```
3. Deploy frontend image similarly or host static frontend bundle on Cloud Storage / Firebase Hosting.

---

## 🩺 Production Health Checks & Monitoring

- **Backend Health Check**: `GET /health` returns:
  ```json
  {"status": "ok", "service": "BusinessGPT API"}
  ```
- **Interactive Swagger Docs**: `GET /docs`
- **Scheduled Tasks**: APScheduler automatically starts with FastAPI to generate daily inventory & sales alerts.

---

## 🔄 Updating Your Deployment

### With Docker Compose:
```bash
git pull origin main
docker compose down
docker compose up -d --build
```

### On Render / Vercel:
Any push to your `main` branch automatically triggers a rebuild and zero-downtime deployment!
