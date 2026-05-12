@echo off
title DIGIVET Online - Dev Server
cd /d "%~dp0"

echo.
echo  =============================================
echo   DIGIVET Online - Starting Dev Environment
echo  =============================================
echo.

:: Install dependencies if missing
if not exist "node_modules" (
    echo [1/3] Installing root dependencies...
    call npm install
)
if not exist "server\node_modules" (
    echo [2/3] Installing server dependencies...
    cd server && call npm install && cd ..
)
if not exist "client\node_modules" (
    echo [3/3] Installing client dependencies...
    cd client && call npm install && cd ..
)

:: Copy .env files from examples if they don't exist
if not exist "server\.env" (
    echo.
    echo [!] server\.env not found - copying from .env.example
    copy "server\.env.example" "server\.env" >nul
    echo [!] IMPORTANT: Open server\.env and fill in your Supabase keys!
    echo.
    pause
)

echo.
echo  Starting servers... Browser will open in 6 seconds.
echo.

:: Open browser after Vite is ready
start "" powershell -WindowStyle Hidden -Command "Start-Sleep 6; Start-Process 'http://localhost:5173'"

:: Start backend + frontend
npm run dev

pause
