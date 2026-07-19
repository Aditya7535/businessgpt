# BusinessGPT 🤖
An AI-powered conversational Business Intelligence platform for Indian SME owners.

## Features (Phases 1-3 complete)
- 📁 **File Upload**: CSV/Excel auto-ingested into PostgreSQL + ChromaDB
- 🧠 **LangGraph Orchestrator**: Intelligent intent routing (SQL / RAG / Forecast)
- 🔍 **Hybrid RAG Pipeline**: ChromaDB + Ollama nomic-embed-text
- 📈 **Sales Forecasting**: Prophet + XGBoost + Random Forest ensemble
- 🎉 **Indian Festival Calendar**: Diwali, Holi, IPL & more as seasonal signals
- 💬 **Hindi / Hinglish Support**: Chat in any language
- ⚡ **Groq LLM**: llama-3.1-8b-instant for fast responses

## Tech Stack
- **Backend**: FastAPI + SQLAlchemy + PostgreSQL
- **AI/ML**: LangGraph, LangChain, ChromaDB, Ollama, Groq
- **Forecasting**: Prophet, XGBoost, Scikit-learn Random Forest
- **Embeddings**: nomic-embed-text via Ollama (local)

## Setup

### 1. Clone and install dependencies
```bash
git clone https://github.com/YOUR_USERNAME/businessgpt.git
cd businessgpt/backend
pip install -r requirements.txt
```

### 2. Configure environment
Create a `.env` file in `backend/`:
```
DATABASE_URL=postgresql+pg8000://postgres:YOUR_PASSWORD@localhost:5432/businessgpt
GROQ_API_KEY=your_groq_api_key_here
```

### 3. Start services
- Ensure PostgreSQL is running with a `businessgpt` database
- Start Ollama: `ollama serve`
- Pull embedding model: `ollama pull nomic-embed-text`

### 4. Run the server
```bash
cd backend
uvicorn app.main:app --reload
```

Open **http://127.0.0.1:8000/docs** to access the Swagger UI.

## API Endpoints
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/upload` | Upload CSV/Excel file |
| POST | `/api/chat` | Chat with LangGraph Orchestrator |
| POST | `/api/forecast/sales` | Generate sales forecast |

## Roadmap
- [ ] Phase 4: React Frontend
- [ ] Phase 5: WhatsApp Integration (Twilio)
- [ ] Phase 6: Voice Input (Whisper)
- [ ] Phase 7: Inventory Module
- [ ] Phase 8: Market Intelligence
