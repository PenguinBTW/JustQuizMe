@echo off
title JustQuizMe Unified Master Suite
cd /d "%~dp0"

echo =======================================================
echo   Starting JustQuizMe Unified Master Suite on port 3000
echo =======================================================

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Please install Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules\express\package.json" (
  echo Installing dependencies - first run only...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

start "" /min cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"
node server/index.js
pause
