# BusinessGPT Mobile Application — Developer & Operational Guide

## 1. Overview & Architecture

**BusinessGPT Mobile** is a full-featured, independent mobile application built for small-to-medium retail businesses, local shopkeepers, and supermarket owners across India.

It connects directly to the shared **FastAPI backend** and shared database (PostgreSQL/Supabase or SQLite), operating alongside the React + Vite web dashboard without duplicating business logic or database state.

```
       ┌────────────────────────┐         ┌────────────────────────┐
       │   React Web Frontend   │         │ React Native Mobile App│
       │  (Vite + Tailwind CSS) │         │ (Expo SDK 52 + Router) │
       └───────────┬────────────┘         └───────────┬────────────┘
                   │                                  │
                   └───────────────┬──────────────────┘
                                   │ Shared REST & SSE
                                   ▼
                   ┌───────────────────────────────┐
                   │        FastAPI Backend        │
                   │ (Auth, POS, Inventory, AI/LLM)│
                   └───────────────┬───────────────┘
                                   ▼
                   ┌───────────────────────────────┐
                   │    Shared Database (SQLite)   │
                   │      `businessgpt.db`         │
                   └───────────────────────────────┘
```

---

## 2. Directory Structure

```
mobile-app/
├── app/
│   ├── _layout.tsx           # QueryClientProvider, AuthProvider, Root Stack
│   ├── index.tsx             # Smart splash redirector
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── onboarding.tsx    # Benefit cards & Get Started
│   │   ├── login.tsx         # User & Demo credentials sign-in
│   │   └── setup-store.tsx   # New store registration & profile setup
│   ├── (tabs)/
│   │   ├── _layout.tsx       # 5-tab bottom navigation with brutalist icons
│   │   ├── index.tsx         # Dashboard (live metrics, revenue, today's bills)
│   │   ├── inventory.tsx     # Stock management, search, low-stock filter
│   │   ├── pos.tsx           # POS billing register, cart drawer, checkout
│   │   ├── chat.tsx          # AI Assistant & conversational voice updates
│   │   └── more.tsx          # Menu to submodules & settings
│   ├── customers/
│   │   ├── index.tsx         # Customer ledger, search, total market udhar
│   │   └── [id].tsx          # Profile, due balance, WhatsApp reminder
│   ├── analytics/
│   │   └── index.tsx         # 7-day revenue trend, top products, categories
│   ├── forecasting/
│   │   └── index.tsx         # AI festival demand spikes & purchase recommendations
│   ├── reports/
│   │   └── index.tsx         # Daily closing figures & monthly dossiers
│   ├── alerts/
│   │   └── index.tsx         # Urgent stockout, credit due & system alerts
│   ├── whatsapp/
│   │   └── index.tsx         # Gateway status, test dispatch, auto receipts
│   └── settings/
│       └── index.tsx         # Mandatory customer toggle, currency, store name
├── assets/                   # BusinessGPT 3D logos and branding icons
├── components/
│   ├── ui/                   # Card, Button, Input, Badge, Header, MetricCard
│   ├── inventory/            # ProductCard, StockAdjustModal, AddProductModal
│   ├── pos/                  # CartItem, CustomerPickerModal, ReceiptModal
│   └── chat/                 # ChatMessage, StockProposalCard
├── constants/
│   ├── colors.ts             # Neo-brutalist palette (#101010, #F5F3EB, #D7FF38)
│   ├── theme.ts              # Drop shadows, borders, brutal typography
│   └── config.ts             # API URL detection (Android emulator / iOS / Web)
├── services/                 # Axios clients matching FastAPI endpoints
├── store/                    # Zustand stores (Auth, POS Cart, Offline State)
├── types/                    # Shared TypeScript interfaces
├── utils/                    # Currency formatters (₹), Secure storage
├── app.json
├── package.json
└── tsconfig.json
```

---

## 3. Design System & Accessibility

- **Theme Palette**:
  - Primary Black: `#101010`
  - Warm Paper Background: `#F5F3EB`
  - Electric Brand Lime: `#D7FF38`
  - Accessible Dark Green Text: `#166534`
  - Signal Red: `#FF6B6B`
  - Dark Red Text: `#DC2626`
  - Lavender Accent: `#B9A7FF`
  - Surface White: `#FFFFFF`
- **Brutalist Elements**:
  - Consistent `2px solid #101010` borders
  - High-contrast drop shadows (`shadowOffset: { width: 3, height: 3 }`, elevation 4)
  - Large touch targets (minimum 44px to 52px) optimized for single-handed shopkeeper usage.
- **Indian Market Currency & Number Formatting**:
  - Automatic `Intl.NumberFormat('en-IN')` formatting (`₹1,25,000.00`).

---

## 4. Key Workflows & Business Rules

### A. POS Counter Checkout
1. Shopkeeper browses catalog or searches product by name/barcode.
2. Tapping any item increments cart quantity.
3. If store setting `pos_require_customer` is enabled, the app enforces selecting or creating a customer before payment.
4. Supports Payment Methods: **CASH**, **UPI**, **CARD**, **CREDIT (Udhar)**.
5. On completion, creates atomic bill via `POST /api/pos/bills`, immediately invalidates React Query cache, and presents an interactive receipt with **1-Click WhatsApp Invoice Dispatch**.

### B. Voice-First & Conversational Inventory Updates
1. Shopkeeper speaks or types: *"50 packet Maggi stock aaya"*.
2. The AI assistant extracts the operation (`ADD`), product (`Maggi`), and quantity (`50`).
3. An interactive `StockProposalCard` appears showing:
   - Current Stock: `12 pcs`
   - Projected Stock: `62 pcs`
4. The shopkeeper confirms on screen, and `POST /api/inventory/conversational/confirm` updates the shared database atomically.

### C. Offline Resilience
- When the device loses internet connection, the `OfflineBanner` informs the shopkeeper that cached data is being displayed.
- The app explicitly blocks blind or duplicate offline checkouts to prevent race conditions or silent data corruption.

---

## 5. Running the Mobile Application

### Step 1: Ensure Backend is Running
Verify that the FastAPI backend is running on port 8000:
```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Step 2: Configure Environment
In `mobile-app/.env`:
- For Web / iOS Simulator: `EXPO_PUBLIC_API_URL=http://localhost:8000`
- For Android Emulator: `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000`
- For Physical Phone via Wi-Fi: `EXPO_PUBLIC_API_URL=http://<YOUR_LOCAL_IP>:8000`
- For Remote / Cloud: `EXPO_PUBLIC_API_URL=https://laborer-feline-absurd.ngrok-free.dev`

### Step 3: Start Expo Development Server
```bash
cd mobile-app
npm start
```
- Press `a` to open in Android Emulator / Device.
- Press `i` to open in iOS Simulator.
- Press `w` to open in Web Browser.
- Scan the QR code with the **Expo Go** app on Android or iOS.

---

## 6. Build & Production Deployment

### Android Build (APK / AAB)
```bash
# Using EAS Build (Expo Application Services)
npx eas-cli build -p android --profile preview
```

### iOS Build (IPA / TestFlight)
```bash
npx eas-cli build -p ios --profile preview
```
