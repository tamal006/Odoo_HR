# HR-on-Odoo Agent Layer

FastAPI service that lets HR staff and employees talk to Odoo through a
Claude-powered agent, connected via MCP (Model Context Protocol).

## Architecture

```
Next.js frontend  ──useChat()──▶  /agent/chat  ──Claude──▶  MCP  ──▶  Odoo
(Person 1)          streaming      (this repo)    tool loop       (Person 2)
```

**Phase 0** (complete): Terminal client proving the Claude ↔ MCP ↔ Odoo
tool-calling loop works — `client.py` + `mock_odoo_mcp_server.py`.

**Phase 2** (this): Production FastAPI wrapper with HR persona, streaming,
approval copilot, and audit trail.

## Setup

```bash
cd agent-layer-prep
pip install -e .          # or: pip install anthropic mcp python-dotenv fastapi "uvicorn[standard]"
cp .env.example .env
# fill in ANTHROPIC_API_KEY at minimum
```

## Run the FastAPI server

```bash
# Against the mock Odoo (works today, no real Odoo needed):
uvicorn app:app --reload --port 8000

# Or set MCP_SERVER_TARGET in .env to "odoo" once the real server is live.
```

The server starts, connects to the MCP server (mock or real) at startup, and
exposes two endpoints.

## Endpoints

### `POST /agent/chat`

Streams a chat response using the [Vercel AI SDK Server-Sent Events (SSE) Protocol](https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol#data-stream-protocol),
so Person 1's `useChat` hook needs **zero custom parsing**.

**Request body:**
```json
{
  "messages": [
    { "role": "user", "content": "What's my leave balance?" }
  ],
  "role": "employee",
  "employee_id": 1,
  "employee_name": "Ananya Roy"
}
```

> [!WARNING]
> **AUTHENTICATION GAP:** The `role`, `employee_id`, and `employee_name` fields are currently read straight from the request body. In production, this **MUST** be backed by a verified session token (like a JWT) decoded on the backend. If you rely on the client payload, anyone can spoof `"role": "admin"` and bypass all prompt safety layers.

- `messages`: Conversation history in OpenAI/Vercel format.
- `role`: `"employee"` or `"admin"` — trusted, from the authenticated session.
- `employee_id` / `employee_name`: Caller identity.

**Response:** `text/event-stream` with Data Stream Protocol lines:
```
data: {"type": "text-delta", "delta": "Here is your leave balance..."}

data: {"type": "text-delta", "delta": " You have 14 days remaining."}

data: {"type": "finish", "finishReason": "stop", "usage": {"promptTokens": 150, "completionTokens": 42}}
```

### `GET /agent/audit`

Returns the full audit trail as JSON:
```json
[
  {
    "timestamp": "2026-07-04T12:00:00Z",
    "session_id": "abc-123",
    "user_role": "admin",
    "user_id": 3,
    "user_name": "Priya Nair",
    "request_summary": "Approve leave request 101",
    "tool_name": "update_record",
    "tool_args": {"model": "hr.leave", "record_id": 101, "values": {"state": "validate"}},
    "tool_result": "Updated hr.leave#101 -> ...",
    "is_error": false,
    "requires_confirmation": true,
    "confirmed_by": "Priya Nair"
  }
]
```

Person 1 can render this as "requested → AI did X → confirmed by Y" next to
each record.

### Command Bar (kbar)

Whatever's typed into Person 1's kbar command bar should POST to the same
`/agent/chat` endpoint — no separate code path. The endpoint accepts any
freeform text as a user message.

## Role Permissions

| Capability | Employee | Admin |
|---|---|---|
| View own leave balance | ✅ | ✅ |
| Submit own leave request | ✅ | ✅ |
| View own attendance | ✅ | ✅ |
| Approve/reject leave | ❌ | ✅ (with Copilot) |
| View team-wide data | ❌ | ✅ |
| Create/update employees | ❌ | ✅ |
| Delete anything | ❌ | ❌ |

## Approval Copilot

When an admin asks to approve or reject a leave request, the agent:

1. **Gathers context** via MCP tools: leave balance, team leave overlap,
   attendance pattern.
2. **States its recommendation** and reasoning.
3. **Asks for explicit confirmation** before executing the `update_record`.
4. **Never auto-executes** — always requires a human "yes" / "confirm".

## Audit Trail

Every tool call is logged as (request → tool executed → result). The log
includes whether the action required confirmation and who confirmed it.

## Verification

```bash
# 1. MCP plumbing smoke test (no Claude key needed):
python smoke_test_mcp_plumbing.py

# 2. Start the server and test manually:
uvicorn app:app --reload --port 8000

# 3. Test as employee:
curl -X POST http://localhost:8000/agent/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What is my leave balance?"}],"role":"employee","employee_id":1,"employee_name":"Ananya Roy"}'

# 4. Test audit trail:
curl http://localhost:8000/agent/audit
```

## Phase 0 Files (still here for reference)

| File | Purpose |
|---|---|
| `client.py` | Terminal client — talks to mock or real Odoo MCP server |
| `mock_odoo_mcp_server.py` | Fake Odoo backend, same tool surface as real server |
| `smoke_test_mcp_plumbing.py` | No-Claude-required MCP transport check |

## Phase 2 Files

| File | Purpose |
|---|---|
| `app.py` | FastAPI app — `/agent/chat` (streaming) + `/agent/audit` |
| `system_prompt.py` | HR persona + role-restricted system prompt builder |
| `approval_copilot.py` | Approval Copilot (context → recommend → confirm) |
| `audit.py` | In-memory audit trail storage |
