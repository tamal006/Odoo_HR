# Odoo HR — AI Copilot

An AI-native HR platform on top of **Odoo**. It doesn't just show your HR data —
it **forecasts** it, **scores risk**, and **simulates approval decisions before
you make them**, behind a human-in-the-loop safety layer.

Three tiers, one Odoo source of truth:

```
frontend/  React + Vite + Clerk         :5173  ──/api──▶  backend  (CRUD)
backend/   Express + Odoo XML-RPC       :5000  ──────────▶  Odoo
server/    Python agent + MCP + Claude   :8000  ──/agent, /insights──▶  Odoo (via MCP)
```

The `frontend` calls the `backend` for CRUD and the `server` (AI agent) for chat
+ predictive insights. Backend and agent read the **same Odoo** — the backend
over XML-RPC, the agent over MCP.

---

## The problem we solve

Odoo shows a calendar of *who's* on leave. It does **not** tell a manager the
one thing they need at the moment of approval: **"if I approve this, is my team
understaffed that week?"** Odoo's own docs note leave visibility is role-gated
and that *"poorly managed leave policies lead to … understaffing."* Approvals
happen blind.

**Our answer — Impact Preview.** Before you approve, the agent recomputes the
8-week capacity timeline *as if it were already approved*, diffs it against now,
and states the consequence: *"Approving this drops the week of Jul 13 to 50% —
below the coverage floor."* You can't do that in Odoo today. Same data,
foresight added.

---

## Does it use real AI?

Yes — and deliberately in two layers:

- **A real LLM agent.** Chat is **Claude** (`claude-sonnet-5`) doing live
  tool-calling over MCP against Odoo — read a record, decide, act, confirm.
  Needs a real `ANTHROPIC_API_KEY`.
- **A deterministic predictive core.** Forecasts, burnout scores, capacity and
  Impact Preview are transparent statistical models (`server/intelligence.py`),
  **not** the LLM — because LLMs are bad at arithmetic. The agent reasons *over*
  these numbers and explains them.

That split is the point: the LLM orchestrates trustworthy predictors instead of
hallucinating math. Nothing in the UI is hardcoded — every number is computed
live.

---

## Quick start

### The AI slice — self-contained, no Odoo credentials

The agent runs against a local Odoo stand-in, so the whole AI experience boots
with zero external setup:

```powershell
powershell -ExecutionPolicy Bypass -File run.ps1     # Windows
```
```bash
./run.sh                                              # macOS / Linux
```

- **http://localhost:8000** — landing page + the agent console (Cockpit · Insights · Assistant · Audit)
- **http://localhost:5173** — the full app; sign in, then click **AI Copilot**

Put an `ANTHROPIC_API_KEY` in `server/.env` to enable chat. Forecasts and Impact
Preview work **without** a key.

### The live-Odoo CRUD tier (optional)

The Express backend needs a real Odoo. Fill `backend/.env` (see
`backend/.env.example`), then `cd backend && npm install && npm run seed && npm
start`. To point the **agent** at that same Odoo, set `MCP_SERVER_TARGET=odoo`
plus `ODOO_URL/ODOO_DB/ODOO_API_KEY` in `server/.env` — one-line switch, same
agent, real records.

---

## What makes it different

| Innovation | What it does | Why it's not a template |
|---|---|---|
| **Impact Preview** | Counterfactual: recomputes capacity *as if a leave were approved* and shows before→after per week. | A what-if engine, not a dashboard. |
| **Predictive core** | Burn-rate → year-end balance + exhaustion date; 0–100 burnout signal; 8-week capacity forecast. | Transparent, tunable, unit-tested models. |
| **Hard-gated copilot** | Scored `APPROVE/REVIEW/CAUTION` recommendation; never writes without a human "confirm". | RBAC enforced **in code** — survives jailbreaks. |
| **Audit trail** | Every tool call: request → action → who confirmed. | Transparency Odoo's flow lacks. |

---

## Verify

```bash
cd server
python intelligence.py            # predictive models self-check — no key
python verify_phase2.py           # all modules incl. RBAC gate — no key
python smoke_test_mcp_plumbing.py # MCP transport round-trip — no key
cd ../frontend && npm run build   # compiles the full app incl. AI Copilot
```

---

## Layout

```
frontend/  React SPA — Dashboard, Employees, Attendance, Leaves, Payroll, Profile, AI Copilot
  src/pages/CopilotPage.jsx   streaming chat + insights + Impact Preview
  src/api/agent.js            client for the Python agent
backend/   Express + Odoo XML-RPC — CRUD routes, Clerk auth, seed
server/    Python agent
  intelligence.py             predictive core (pure, tunable, tested)
  approval_copilot.py         context → scored recommendation → confirm; hard RBAC gate
  mock_odoo_mcp_server.py     local Odoo stand-in + predictive MCP tools
  app.py                      FastAPI: /agent/chat, /insights/*, /agent/audit, /health, / (landing), /console
  static/                     landing.html + index.html (console)
```
