# BusinessGPT 🤖

> **One BusinessGPT Platform · Two Independent Interfaces · One Shared Backend · One Shared Database**

An AI-powered conversational Business Intelligence, POS Billing, Inventory, and Khata Ledger platform designed specifically for small and medium-sized business owners, retailers, shopkeepers, and supermarket owners in India.

A shopkeeper who does not own a laptop or desktop computer can operate their entire store using only the **BusinessGPT Mobile Application**, while staff or owners with a computer can use the **BusinessGPT Web Application** simultaneously against the same live database.

---

## 🏗️ Architecture

```
       ┌────────────────────────┐         ┌────────────────────────┐
       │   React Web Frontend   │         │ React Native Mobile App│
       │  (Vite + Tailwind CSS) │         │ (Expo SDK 52 + Router) │
       │    http://localhost:3000│         │    Android / iOS / Web │
       └───────────┬────────────┘         └───────────┬────────────┘
                   │                                  │
                   └───────────────┬──────────────────┘
                                   │ Shared REST & SSE
                                   ▼
                   ┌───────────────────────────────┐
                   │        FastAPI Backend        │
                   │ (Auth, POS, Inventory, AI/LLM)│
                   │    http://127.0.0.1:8000      │
                   └───────────────┬───────────────┘
                                   ▼
                   ┌───────────────────────────────┐
                   │        Shared Database        │
                   │  PostgreSQL / SQLite (.db)    │
                   └───────────────────────────────┘
```

---

## 📁 Repository Structure

```
BGPT/
│
├── backend/                 # FastAPI backend (Python 3.10+, SQLAlchemy, LangGraph)
│   ├── app/
│   │   ├── api/             # REST endpoints (auth, pos, inventory, chat, customers, etc.)
│   │   ├── modules/         # Business services (inventory, forecasting, reports, alerts, etc.)
│   │   └── main.py          # FastAPI application entrypoint
│   └── requirements.txt
│
├── frontend/                # React + Vite web dashboard (Tailwind CSS, Lucide, Recharts)
│   ├── src/
│   │   ├── pages/           # POS, Inventory, Story Dashboard, Customers, Settings
│   │   └── components/
│   └── package.json
│
├── mobile-app/              # React Native + Expo mobile application (Expo Router, TypeScript)
│   ├── app/                 # Expo Router tabs, auth, and feature submodules
│   ├── components/          # Neo-brutalist UI cards, modals, and metric components
│   ├── constants/           # Palette (#101010, #F5F3EB, #D7FF38), theme, config
│   ├── services/            # Axios API clients connecting to shared FastAPI backend
│   ├── store/               # Zustand state stores (auth, cart, offline)
│   ├── types/               # Shared TypeScript schemas
│   └── package.json
│
├── docs/                    # Architecture & Mobile App guides
│   └── MOBILE_APP_GUIDE.md
│
└── README.md
```

---

## ✨ Features

- ⚡ **High-Speed Mobile POS**: Fast counter checkout, barcode search, multi-tender payments (Cash, UPI, Card, Credit/Udhar), and instant receipts.
- 📦 **Live Inventory & Stock Health**: Real-time stock counts, category filters, low-stock alerts, and manual stock adjustment audit logs.
- 🎙️ **Conversational Voice Stock In/Out**: Say *"50 packet Maggi stock aaya"*, review on-screen current vs. projected stock, and confirm directly into the database.
- 🤖 **AI Store Copilot**: Conversational business insights powered by LangGraph in Hindi, Hinglish, Marathi, and English.
- 📒 **Customer Ledger & Udhar**: Track customer credit balances, payment histories, and 1-click WhatsApp payment reminders.
- 📈 **Demand Forecasting & Seasonal Spikes**: Festival-aware demand forecasting (Diwali, Holi, Eid) with recommended purchase reorders.
- 💬 **WhatsApp Integration**: Cloud webhook and automated invoice sharing directly to customer phones.
- 📑 **Dossier Business Reports**: Daily store closing summaries and monthly PDF/CSV exports.
- 🎨 **Neo-Brutalist Design System**: Structured cards, high-contrast borders, Apple SF typography, and minimum 44px touch targets.

---

## 🚀 Getting Started

### 1. Start the FastAPI Backend
```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Swagger API Documentation is available at **http://127.0.0.1:8000/docs**.

### 2. Start the React Web Frontend
```bash
cd frontend
npm run dev
```
Open **http://localhost:3000** in your browser.

### 3. Start the React Native Mobile Application
```bash
cd mobile-app
npm start
```
- Press `a` for Android Emulator.
- Press `i` for iOS Simulator.
- Press `w` for Web preview.
- Or scan the terminal QR code with the **Expo Go** app on your physical smartphone.

---

## 📱 Mobile App Documentation

For in-depth details on mobile build configuration, environment settings, and offline caching, see [docs/MOBILE_APP_GUIDE.md](docs/MOBILE_APP_GUIDE.md).
