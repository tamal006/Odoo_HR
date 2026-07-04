# run.ps1 — one command to bring up the AI slice locally (agent + frontend).
# The AI tier is self-contained: it runs against a local Odoo stand-in, so it
# needs NO Odoo credentials. The Express backend (live Odoo CRUD) is optional
# and needs real Odoo creds — see README.md.
#
#   powershell -ExecutionPolicy Bypass -File run.ps1
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

function need($cmd, $hint) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { Write-Host "Missing '$cmd' — $hint" -ForegroundColor Red; exit 1 }
}
need python "install Python 3.10+ from python.org"
need node   "install Node 18+ from nodejs.org"

# 1) Python AI agent -----------------------------------------------------------
Write-Host "→ Setting up AI agent (server/) ..." -ForegroundColor Cyan
if (-not (Test-Path "$root\server\.venv")) { python -m venv "$root\server\.venv" }
& "$root\server\.venv\Scripts\python.exe" -m pip install -q -e "$root\server" 2>&1 | Out-Null
if (-not (Test-Path "$root\server\.env")) { Copy-Item "$root\server\.env.example" "$root\server\.env" }
Start-Process -FilePath "$root\server\.venv\Scripts\python.exe" `
  -ArgumentList "-m","uvicorn","app:app","--port","8000" -WorkingDirectory "$root\server"

# 2) React frontend ------------------------------------------------------------
Write-Host "→ Setting up frontend/ ..." -ForegroundColor Cyan
if (-not (Test-Path "$root\frontend\node_modules")) { Push-Location "$root\frontend"; npm install; Pop-Location }
Start-Process -FilePath "npm.cmd" -ArgumentList "run","dev" -WorkingDirectory "$root\frontend"

Start-Sleep 3
Write-Host ""
Write-Host "  AI agent + console  ->  http://localhost:8000" -ForegroundColor Green
Write-Host "  Full app (Copilot)  ->  http://localhost:5173  (sign in, click 'AI Copilot')" -ForegroundColor Green
Write-Host ""
Write-Host "  Chat needs a key: put ANTHROPIC_API_KEY in server\.env (insights work without it)." -ForegroundColor Yellow
Write-Host "  Live Odoo CRUD (backend/) is optional and needs Odoo creds — see README.md." -ForegroundColor DarkGray
