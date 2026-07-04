#!/usr/bin/env bash
# run.sh — one command to bring up the AI slice locally (agent + frontend).
# The AI tier runs against a local Odoo stand-in, so it needs NO Odoo creds.
# The Express backend (live Odoo CRUD) is optional — see README.md.
set -e
root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

command -v python3 >/dev/null || { echo "Missing python3 (3.10+)"; exit 1; }
command -v node    >/dev/null || { echo "Missing node (18+)"; exit 1; }

echo "→ Setting up AI agent (server/) ..."
[ -d "$root/server/.venv" ] || python3 -m venv "$root/server/.venv"
"$root/server/.venv/bin/python" -m pip install -q -e "$root/server"
[ -f "$root/server/.env" ] || cp "$root/server/.env.example" "$root/server/.env"
( cd "$root/server" && "./.venv/bin/python" -m uvicorn app:app --port 8000 ) &

echo "→ Setting up frontend/ ..."
[ -d "$root/frontend/node_modules" ] || ( cd "$root/frontend" && npm install )
( cd "$root/frontend" && npm run dev ) &

sleep 3
echo ""
echo "  AI agent + console  ->  http://localhost:8000"
echo "  Full app (Copilot)  ->  http://localhost:5173  (sign in, click 'AI Copilot')"
echo ""
echo "  Chat needs ANTHROPIC_API_KEY in server/.env (insights work without it)."
echo "  Live Odoo CRUD (backend/) is optional and needs Odoo creds — see README.md."
wait
