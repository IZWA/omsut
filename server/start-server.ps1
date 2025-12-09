# OMSUT Server Startup Script
# This script sets up the environment and starts the OMSUT server

# Set JWT secret for this session
$env:OMSUT_JWT_SECRET = 'd7e3f1a9c2c84f0a8b9f4e7a2d1c6f98'

# Optional: Set admin users (uncomment to use)
# $env:OMSUT_ADMINS = 'alice,bob'

Write-Host "================================" -ForegroundColor Cyan
Write-Host "OMSUT Server Startup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

Write-Host "Node.js version: $(node --version)" -ForegroundColor Green
Write-Host "npm version: $(npm --version)" -ForegroundColor Green
Write-Host ""

# Check if node_modules exists, if not run npm install
if (-not (Test-Path ".\node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: npm install failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "Dependencies already installed" -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting OMSUT server..." -ForegroundColor Yellow
Write-Host "Server will listen on: http://localhost:3000" -ForegroundColor Cyan
Write-Host "API root: http://localhost:3000/api/" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Start the server
npm start
