@echo off
rem ============================================================
rem  start.bat - starts the backend and the frontend in two windows
rem  Open http://localhost:3000 when both are up.
rem  To stop: close the two windows.
rem ============================================================
cd /d "%~dp0"
start "shavtsak backend" cmd /k "cd shavtsak-backend && venv\Scripts\activate.bat && uvicorn app.main:app --reload"
start "shavtsak frontend" cmd /k "cd shavtsak-app && npm run start"
timeout /t 8 >nul
start http://localhost:3000
