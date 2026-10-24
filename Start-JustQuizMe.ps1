# JustQuizMe Unified Master Suite PowerShell Launcher
$Host.UI.RawUI.WindowTitle = "JustQuizMe Unified Master Suite"
Set-Location $PSScriptRoot

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "   Starting JustQuizMe Unified Master Suite on port 3000" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js was not found. Please install Node.js LTS." -ForegroundColor Red
    pause
    exit 1
}

Start-Process "http://localhost:3000"
node server/index.js
