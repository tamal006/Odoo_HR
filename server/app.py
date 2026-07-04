"""
app.py — Phase 2 FastAPI agent layer for HR-on-Odoo.

Wraps the proven Phase 0 Claude ↔ MCP tool-calling loop (`client.py`) in a
streaming FastAPI endpoint that speaks the Vercel AI SDK Data Stream Protocol,
so Person 1's `useChat` hook needs zero custom parsing.

Now uses Groq (free tier, Llama 3.3 70B) instead of Anthropic.

Endpoints:
    POST /agent/chat   — streaming chat (Data Stream Protocol)
    GET  /agent/audit  — audit trail JSON

Run:
    uvicorn app:app --reload --port 8000
"""

from __future__ import annotations

import asyncio
import json
import os
import shlex
import sys
import uuid
from contextlib import AsyncExitStack, asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from groq import Groq
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from pydantic import BaseModel

from approval_copilot import (
    format_copilot_context,
    gather_approval_context,
    is_approval_action,
    is_confirmation,
    rbac_denial,
)
from audit import AuditEntry, audit_trail
from system_prompt import build_system_prompt

load_dotenv()

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
MAX_TOOL_TURNS = 10


# ---------------------------------------------------------------------------
# Pydantic models for request validation
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    role: str = "employee"
    employee_id: int = 1
    employee_name: str = "Ananya Roy"


# ---------------------------------------------------------------------------
# MCP connection (shared across requests, set up at startup)
# ---------------------------------------------------------------------------

class MCPManager:
    """Manages the MCP session lifecycle, reusing the connection logic from
    Phase 0's ``client.py``."""

    def __init__(self) -> None:
        self.session: ClientSession | None = None
        self.exit_stack = AsyncExitStack()
        self._tools_cache: list[dict[str, Any]] | None = None
        self.target: str | None = None

    async def connect(self, target: str) -> None:
        self.target = target
        if target == "odoo":
            command, args, env = self._odoo_params()
        elif target.endswith(".py"):
            path = Path(target).resolve()
            if not path.exists():
                # Try relative to this file's directory
                path = (Path(__file__).parent / target).resolve()
            if not path.exists():
                raise FileNotFoundError(f"No such script: {path}")
            command, args, env = sys.executable, [str(path)], None
        else:
            parts = shlex.split(target)
            command, args, env = parts[0], parts[1:], None

        print(f"[MCP] connecting: command={command!r} args={args!r}")
        params = StdioServerParameters(command=command, args=args, env=env)
        transport = await self.exit_stack.enter_async_context(stdio_client(params))
        self.session = await self.exit_stack.enter_async_context(
            ClientSession(transport[0], transport[1])
        )
        await self.session.initialize()

        tools = await self.session.list_tools()
        self._tools_cache = [
            {"name": t.name, "description": t.description, "input_schema": t.inputSchema}
            for t in tools.tools
        ]
        print(f"[MCP] connected — tools: {[t['name'] for t in self._tools_cache]}")

    @staticmethod
    def _odoo_params() -> tuple[str, list[str], dict[str, str] | None]:
        required_any = ["ODOO_API_KEY"] if os.getenv("ODOO_API_KEY") else ["ODOO_USER", "ODOO_PASSWORD"]
        missing = [v for v in ["ODOO_URL", *required_any] if not os.getenv(v)]
        if missing:
            raise RuntimeError(f"Missing env vars for Odoo: {missing}")
        return "uvx", ["mcp-server-odoo"], None

    @property
    def tools(self) -> list[dict[str, Any]]:
        if self._tools_cache is None:
            raise RuntimeError("MCP not connected yet")
        return self._tools_cache

    def get_groq_tools(self) -> list[dict[str, Any]]:
        """Convert MCP tools to Groq/OpenAI function-calling format."""
        groq_tools = []
        for t in self.tools:
            groq_tools.append({
                "type": "function",
                "function": {
                    "name": t["name"],
                    "description": t.get("description", ""),
                    "parameters": t.get("input_schema", {"type": "object", "properties": {}}),
                },
            })
        return groq_tools

    async def close(self) -> None:
        await self.exit_stack.aclose()


mcp_mgr = MCPManager()


# ---------------------------------------------------------------------------
# App lifespan — connect MCP at startup, disconnect on shutdown
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    target = os.getenv("MCP_SERVER_TARGET", "mock_odoo_mcp_server.py")
    await mcp_mgr.connect(target)
    yield
    await mcp_mgr.close()


app = FastAPI(title="HR Agent Layer", version="0.2.0", lifespan=lifespan)

# CORS — allow the frontend (any origin for dev).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Groq client (lazy singleton)
# ---------------------------------------------------------------------------

_groq: Groq | None = None


def get_groq() -> Groq:
    global _groq
    if _groq is None:
        key = os.getenv("GROQ_API_KEY")
        if not key:
            raise RuntimeError("GROQ_API_KEY not set")
        _groq = Groq(api_key=key)
    return _groq


# ---------------------------------------------------------------------------
# Data Stream Protocol helpers
# ---------------------------------------------------------------------------

def _ds_text(text: str) -> str:
    """Vercel AI SDK SSE text chunk."""
    return f"data: {json.dumps({'type': 'text-delta', 'delta': text})}\n\n"


def _ds_finish(reason: str = "stop", prompt_tokens: int = 0, completion_tokens: int = 0) -> str:
    """Vercel AI SDK SSE finish signal."""
    finish_data = json.dumps({
        "type": "finish",
        "finishReason": reason,
        "usage": {"promptTokens": prompt_tokens, "completionTokens": completion_tokens}
    })
    return f"data: {finish_data}\n\n"

def _ds_error(error_msg: str) -> str:
    return f"data: {json.dumps({'type': 'error', 'error': error_msg})}\n\n"


# ---------------------------------------------------------------------------
# Core chat logic — Groq (Llama) ↔ MCP loop with streaming
# ---------------------------------------------------------------------------

async def _run_agent_loop(
    req: ChatRequest,
    session_id: str,
):
    """Generator that yields Data Stream Protocol chunks.

    Uses Groq's OpenAI-compatible API with function calling to drive the
    MCP tool loop, replacing the original Anthropic implementation.
    """
    groq = get_groq()
    assert mcp_mgr.session is not None

    system = build_system_prompt(req.role, req.employee_id, req.employee_name)

    # Build messages from request (OpenAI/Groq format)
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system},
    ]
    for m in req.messages:
        messages.append({"role": m.role, "content": m.content})

    # Track latest user message for audit
    latest_msg = req.messages[-1].content if req.messages else ""

    groq_tools = mcp_mgr.get_groq_tools()

    for turn in range(MAX_TOOL_TURNS):
        # --- Call Groq (non-streaming for tool loop correctness) ---
        response = groq.chat.completions.create(
            model=GROQ_MODEL,
            max_tokens=2048,
            messages=messages,
            tools=groq_tools if groq_tools else None,
            tool_choice="auto" if groq_tools else None,
        )

        choice = response.choices[0]
        message = choice.message

        # Stream any text output
        if message.content:
            full_text = message.content
            chunk_size = 12
            for i in range(0, len(full_text), chunk_size):
                yield _ds_text(full_text[i : i + chunk_size])
                await asyncio.sleep(0.01)

        # If no tool calls, we're done
        if not message.tool_calls:
            messages.append({"role": "assistant", "content": message.content or ""})
            yield _ds_finish(
                "stop",
                getattr(response.usage, "prompt_tokens", 0),
                getattr(response.usage, "completion_tokens", 0),
            )
            return

        # --- Process tool calls ---
        # Add the assistant message with tool calls
        assistant_msg: dict[str, Any] = {
            "role": "assistant",
            "content": message.content or "",
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in message.tool_calls
            ],
        }
        messages.append(assistant_msg)

        for tc in message.tool_calls:
            tool_name = tc.function.name
            try:
                tool_args = json.loads(tc.function.arguments)
            except json.JSONDecodeError:
                tool_args = {}

            # --- Hard RBAC gate — code-enforced, survives prompt jailbreaks ---
            denial = rbac_denial(req.role, tool_name, tool_args)
            if denial:
                yield _ds_text(f"\n🚫 **Blocked:** {denial}\n")
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "name": tool_name,
                    "content": f"DENIED by server RBAC: {denial}",
                })
                audit_trail.log(AuditEntry(
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    session_id=session_id,
                    user_role=req.role,
                    user_id=req.employee_id,
                    user_name=req.employee_name,
                    request_summary=latest_msg[:200],
                    tool_name=tool_name,
                    tool_args=tool_args,
                    tool_result=f"DENIED by RBAC: {denial}",
                    is_error=True,
                    requires_confirmation=False,
                    confirmed_by=None,
                ))
                continue

            # --- Approval Copilot interception ---
            if is_approval_action(tool_name, tool_args):
                leave_id = tool_args.get("record_id", 0)
                action = tool_args.get("values", {}).get("state", "unknown")

                if is_confirmation(latest_msg, action):
                    yield _ds_text("\n\n✅ Confirmation received. Executing...\n\n")
                    await asyncio.sleep(0.05)
                else:
                    yield _ds_text("\n\n🔍 Gathering approval context...\n\n")
                    await asyncio.sleep(0.05)

                    context = await gather_approval_context(mcp_mgr.session, leave_id)
                    copilot_block = format_copilot_context(context, action)

                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "name": tool_name,
                        "content": (
                            f"[APPROVAL COPILOT — DO NOT EXECUTE YET]\n"
                            f"{copilot_block}\n\n"
                            f"IMPORTANT: Do NOT execute the {action} action yet. "
                            f"Present your recommendation and reasoning to the user, "
                            f"then ask them to reply with 'confirm' or 'yes' to proceed."
                        ),
                    })

                    audit_trail.log(AuditEntry(
                        timestamp=datetime.now(timezone.utc).isoformat(),
                        session_id=session_id,
                        user_role=req.role,
                        user_id=req.employee_id,
                        user_name=req.employee_name,
                        request_summary=latest_msg[:200],
                        tool_name="approval_copilot",
                        tool_args={"leave_id": leave_id, "action": action},
                        tool_result="Context gathered, awaiting confirmation",
                        is_error=False,
                        requires_confirmation=True,
                        confirmed_by=None,
                    ))
                    continue

            # --- Normal tool execution ---
            result = await mcp_mgr.session.call_tool(tool_name, tool_args)
            is_error = bool(getattr(result, "isError", False))

            result_text_parts: list[str] = []
            for item in result.content:
                if getattr(item, "type", None) == "text":
                    result_text_parts.append(item.text)
                else:
                    result_text_parts.append(str(item))

            result_text = " ".join(result_text_parts)

            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "name": tool_name,
                "content": result_text,
            })

            # --- Audit logging ---
            audit_trail.log(AuditEntry(
                timestamp=datetime.now(timezone.utc).isoformat(),
                session_id=session_id,
                user_role=req.role,
                user_id=req.employee_id,
                user_name=req.employee_name,
                request_summary=latest_msg[:200],
                tool_name=tool_name,
                tool_args=tool_args,
                tool_result=result_text[:500],
                is_error=is_error,
                requires_confirmation=is_approval_action(tool_name, tool_args),
                confirmed_by=req.employee_name if is_approval_action(tool_name, tool_args) and is_confirmation(latest_msg, tool_args.get("values", {}).get("state", "")) else None,
            ))

            # Stream a visual indicator of which tool ran
            yield _ds_text(f"\n> 🔧 `{tool_name}`\n")

    # If we hit the turn limit
    yield _ds_text(f"\n\n[Stopped after {MAX_TOOL_TURNS} tool-use turns]\n")
    yield _ds_finish("length")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/agent/chat")
async def agent_chat(request: Request):
    """Streaming chat endpoint — Vercel AI SDK Data Stream Protocol."""
    body = await request.json()
    req = ChatRequest(**body)
    session_id = str(uuid.uuid4())

    async def generate():
        try:
            async for chunk in _run_agent_loop(req, session_id):
                yield chunk
        except Exception as exc:  # noqa: BLE001
            import traceback; traceback.print_exc()
            yield _ds_error(str(exc))

    return StreamingResponse(
        generate(),
        media_type="text/plain; charset=utf-8",
        headers={
            "x-vercel-ai-ui-message-stream": "v1",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream; charset=utf-8",
        },
    )


@app.get("/agent/audit")
async def get_audit(session_id: str | None = None):
    """Return the audit trail as JSON."""
    if session_id:
        return JSONResponse(audit_trail.get_by_session(session_id))
    return JSONResponse(audit_trail.get_all())

@app.delete("/agent/audit")
async def clear_audit():
    """Clear the audit trail."""
    audit_trail.clear()
    return {"status": "ok"}


@app.get("/")
async def landing():
    """Serve the web3 landing page."""
    return FileResponse(Path(__file__).parent / "static" / "landing.html")


@app.get("/console")
async def console():
    """Serve the operator console (Cockpit · Insights · Assistant · Audit)."""
    return FileResponse(Path(__file__).parent / "static" / "index.html")


async def _mcp_json(tool: str, args: dict[str, Any]) -> Any:
    """Call an MCP tool that returns JSON and parse it (for the insights UI)."""
    assert mcp_mgr.session is not None
    result = await mcp_mgr.session.call_tool(tool, args)
    text = "".join(getattr(i, "text", str(i)) for i in result.content)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"raw": text}


@app.get("/insights/capacity")
async def insights_capacity(department_id: str | None = None, weeks: int = 8):
    """Team capacity timeline."""
    try:
        return JSONResponse(await _mcp_json(
            "team_capacity_forecast", {"department_id": department_id, "weeks": weeks}))
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"error": str(exc)}, status_code=502)


@app.get("/insights/overview")
async def insights_overview():
    """Org-wide cockpit snapshot."""
    try:
        return JSONResponse(await _mcp_json("hr_overview", {}))
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"error": str(exc)}, status_code=502)


@app.get("/insights/simulate/{leave_id}")
async def insights_simulate(leave_id: int):
    """Impact Preview."""
    try:
        return JSONResponse(await _mcp_json("simulate_approval", {"leave_id": leave_id}))
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"error": str(exc)}, status_code=502)


@app.get("/insights/employee/{employee_id}")
async def insights_employee(employee_id: int):
    """Per-employee AI snapshot."""
    try:
        bal = await _mcp_json("forecast_leave_balance", {"employee_id": employee_id})
        att = await _mcp_json("attendance_risk", {"employee_id": employee_id})
        return JSONResponse({"employee_id": employee_id, "balance_forecast": bal, "attendance_risk": att})
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"error": str(exc)}, status_code=502)


def _data_source_label(target: str | None) -> str:
    """Human label for the connected Odoo data source, shown in the UI."""
    if target == "odoo":
        return "Odoo (live)"
    if target and target.endswith("mock_odoo_mcp_server.py"):
        return "Odoo (demo data)"
    return target or "unknown"


@app.get("/health")
async def health():
    """Health check — confirms MCP is connected and names the live data source."""
    return {
        "status": "ok",
        "mcp_connected": mcp_mgr.session is not None,
        "mcp_target": _data_source_label(mcp_mgr.target),
        "tools": [t["name"] for t in mcp_mgr.tools] if mcp_mgr._tools_cache else [],
    }
