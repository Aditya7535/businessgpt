@echo off
title BusinessGPT Launcher
echo ========================================================
echo   Launching BusinessGPT (Backend + Frontend)
echo ========================================================
echo.

REM Start FastAPI Backend
echo [*] Starting FastAPI Backend on http://localhost:8000 ...
start "BusinessGPT Backend" cmd /k "cd backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

REM Start Vite Frontend
echo [*] Starting Vite Frontend on http://localhost:5173 ...
start "BusinessGPT Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================================
echo   Both services are launching in separate windows!
echo   - Backend API:  http://localhost:8000
echo   - API Docs:     http://localhost:8000/docs
echo   - Web UI:       http://localhost:5173
echo ========================================================
echo.
pause
