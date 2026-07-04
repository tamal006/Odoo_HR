"""
app.py — Phase 2 FastAPI agent layer for HR-on-Odoo.

Wraps the proven Phase 0 Claude ↔ MCP tool-calling loop (`client.py`) in a
streaming FastAPI endpoint that speaks the Vercel AI SDK Data Stream Protocol,
so Person 1's `useChat` hook needs zero custom parsing.

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

from anthropic import Anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from pydantic import BaseModel

from approval_copilot import (
    format_copilot_context,
    gather_approval_context,
    is_approval_action,
    is_confirmation,
)
from audit import AuditEntry, audit_trail
from system_prompt import build_system_prompt

load_dotenv()

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

ANTHROPIC_MODEL = "claude-sonnet-5"
MAX_TOOL_TURNS = 10


# ---------------------------------------------------------------------------
# Pydantic models for request validation
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    # WARNING: AUTHENTICATION GAP
    # Taking `role` from the request body is a hackathon shortcut. 
    # Before disabling ODOO_YOLO mode for production, this MUST be replaced 
    # with a real session/token validation (e.g. JWT) otherwise anyone can 
    # spoof the "admin" role and bypass the system prompt safety layer.
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

    async def connect(self, target: str) -> None:
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

# CORS — allow the Next.js frontend (any origin for dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Anthropic client (lazy singleton)
# ---------------------------------------------------------------------------

_anthropic: Anthropic | None = None


def get_anthropic() -> Anthropic:
    global _anthropic
    if _anthropic is None:
        key = os.getenv("ANTHROPIC_API_KEY")
        if not key:
            raise RuntimeError("ANTHROPIC_API_KEY not set")
        _anthropic = Anthropic(api_key=key)
    return _anthropic


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
# Core chat logic — Claude ↔ MCP loop with streaming
# ---------------------------------------------------------------------------

async def _run_agent_loop(
    req: ChatRequest,
    session_id: str,
):
    """Generator that yields Data Stream Protocol chunks.

    Reuses the tool-calling loop from Phase 0 client.py, adapted for
    streaming and with approval-copilot interception.
    """
    anthropic = get_anthropic()
    assert mcp_mgr.session is not None

    system = build_system_prompt(req.role, req.employee_id, req.employee_name)

    # Build messages from request
    messages: list[dict[str, Any]] = [
        {"role": m.role, "content": m.content} for m in req.messages
    ]

    # Track pending approval context
    pending_approval: dict[str, Any] | None = None

    # Check if the latest user message is a confirmation for a pending approval
    latest_msg = req.messages[-1].content if req.messages else ""

    for turn in range(MAX_TOOL_TURNS):
        # --- Call Claude (non-streaming for tool loop correctness) ---
        response = anthropic.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=2048,
            system=system,
            messages=messages,
            tools=mcp_mgr.tools,
        )

        # Separate text and tool-use blocks
        text_parts: list[str] = []
        tool_uses: list[Any] = []

        for block in response.content:
            if block.type == "text":
                text_parts.append(block.text)
            elif block.type == "tool_use":
                tool_uses.append(block)

        # Stream any text output
        full_text = "\n".join(text_parts)
        if full_text:
            # Stream text in chunks for a natural feel
            chunk_size = 12
            for i in range(0, len(full_text), chunk_size):
                yield _ds_text(full_text[i : i + chunk_size])
                await asyncio.sleep(0.01)  # small delay for streaming feel

        # If no tool calls, we're done
        if not tool_uses:
            messages.append({"role": "assistant", "content": response.content})
            yield _ds_finish(
                "stop",
                getattr(response.usage, "input_tokens", 0),
                getattr(response.usage, "output_tokens", 0),
            )
            return

        # --- Process tool calls ---
        messages.append({"role": "assistant", "content": response.content})
        tool_result_blocks: list[dict[str, Any]] = []

        for tool_use in tool_uses:
            tool_name = tool_use.name
            tool_args = tool_use.input

            # --- Approval Copilot interception ---
            if is_approval_action(tool_name, tool_args):
                leave_id = tool_args.get("record_id", 0)
                action = tool_args.get("values", {}).get("state", "unknown")

                # Check if user already confirmed
                if is_confirmation(latest_msg, action):
                    # Execute the approve/reject
                    yield _ds_text("\n\n✅ Confirmation received. Executing...\n\n")
                    await asyncio.sleep(0.05)
                else:
                    # Gather context and ask for confirmation
                    yield _ds_text("\n\n🔍 Gathering approval context...\n\n")
                    await asyncio.sleep(0.05)

                    context = await gather_approval_context(mcp_mgr.session, leave_id)
                    copilot_block = format_copilot_context(context, action)

                    # Inject copilot context as a tool result so Claude sees it
                    # and can make a recommendation
                    tool_result_blocks.append({
                        "type": "tool_result",
                        "tool_use_id": tool_use.id,
                        "content": [{"type": "text", "text": (
                            f"[APPROVAL COPILOT — DO NOT EXECUTE YET]\n"
                            f"{copilot_block}\n\n"
                            f"IMPORTANT: Do NOT execute the {action} action yet. "
                            f"Present your recommendation and reasoning to the user, "
                            f"then ask them to reply with 'confirm' or 'yes' to proceed."
                        )}],
                        "is_error": False,
                    })

                    # Log the copilot interception
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

            content_blocks: list[dict[str, str]] = []
            for item in result.content:
                if getattr(item, "type", None) == "text":
                    content_blocks.append({"type": "text", "text": item.text})
                else:
                    content_blocks.append({"type": "text", "text": str(item)})

            result_text = " ".join(b["text"] for b in content_blocks)

            tool_result_blocks.append({
                "type": "tool_result",
                "tool_use_id": tool_use.id,
                "content": content_blocks,
                "is_error": is_error,
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

            # Stream a visual indicator of tool execution
            preview = result_text[:100]
            yield _ds_text(f"\n")

        messages.append({"role": "user", "content": tool_result_blocks})

    # If we hit the turn limit
    yield _ds_text(f"\n\n[Stopped after {MAX_TOOL_TURNS} tool-use turns]\n")
    yield _ds_finish("length")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/agent/chat")
async def agent_chat(request: Request):
    """Streaming chat endpoint — Vercel AI SDK Data Stream Protocol.

    Request body: { messages, role, employee_id, employee_name }
    Response: text/event-stream with Data Stream Protocol lines.
    """
    body = await request.json()
    req = ChatRequest(**body)
    session_id = str(uuid.uuid4())

    async def generate():
        try:
            async for chunk in _run_agent_loop(req, session_id):
                yield chunk
        except Exception as exc:  # noqa: BLE001
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
    """Return the audit trail as JSON.

    Optional query param: ?session_id=xxx to filter by session.
    """
    if session_id:
        return JSONResponse(audit_trail.get_by_session(session_id))
    return JSONResponse(audit_trail.get_all())

@app.delete("/agent/audit")
async def clear_audit():
    """Clear the audit trail."""
    audit_trail.clear()
    return {"status": "ok"}


@app.get("/health")
async def health():
    """Health check — confirms MCP is connected."""
    return {
        "status": "ok",
        "mcp_connected": mcp_mgr.session is not None,
        "tools": [t["name"] for t in mcp_mgr.tools] if mcp_mgr._tools_cache else [],
    }
