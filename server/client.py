"""
client.py — Person 3 prep task: prove Claude <-> MCP <-> Odoo works, terminal only.

Forked from the official MCP quickstart client:
https://github.com/modelcontextprotocol/quickstart-resources (mcp-client-python)

Changes vs. the quickstart baseline, and why:

1. connect_to_server() now launches ANY stdio MCP server (a .py script, or a
   shell command like `uvx mcp-server-odoo`), not just local .py/.js files.
   This is the one piece that has to change between "talking to the mock"
   today and "talking to the real Odoo box" in Phase 2 — everything else
   about this script is identical either way, which is the point.

2. Conversation history now persists across turns in the chat loop (the
   quickstart resets `messages` on every call). An HR agent needs to remember
   "he" in "reject his leave request" from the previous turn.

3. Tool calls/results are echoed clearly (model, args, result) — this is a
   preview of the Phase 2 audit trail requirement, not the real thing yet.

4. MCP tool result content is explicitly converted to Anthropic content
   blocks (rather than passed through as raw mcp.types objects) and tool
   errors are flagged with is_error, so a failed Odoo call doesn't silently
   look like a success to Claude.

5. Model pinned to claude-sonnet-5.

What's deliberately NOT here (Phase 2, not Phase 0):
- No HR persona / role-restriction system prompt. That needs real decisions
  about what employees vs. admins can do, which belongs in Phase 2 once the
  MVP gate is cleared. The placeholder system prompt below is intentionally
  bare so nobody mistakes it for that design work.
- No approval-copilot logic (leave balance + overlap + attendance pattern
  injection). That's Phase 2's Approval Copilot feature.
- No FastAPI/streaming wrapper. This is terminal-only, on purpose.
"""

import asyncio
import os
import shlex
import sys
from contextlib import AsyncExitStack
from pathlib import Path
from typing import Any

from anthropic import Anthropic
from dotenv import load_dotenv
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

load_dotenv()

ANTHROPIC_MODEL = "claude-sonnet-5"
MAX_TOOL_TURNS = 10

# Placeholder only — replace in Phase 2 with the real HR persona / role
# restrictions. Deliberately minimal so it's obviously not the final thing.
PLACEHOLDER_SYSTEM_PROMPT = (
    "You are a terminal test harness for an HR agent that will eventually run "
    "against Odoo via MCP tools. Phase-0 goal: prove tool calling works "
    "end-to-end. Use the available tools to answer questions about employees "
    "and leave requests. State which tool you called and why before giving "
    "your final answer."
)


class MCPClient:
    def __init__(self) -> None:
        self.session: ClientSession | None = None
        self.exit_stack = AsyncExitStack()
        self._anthropic: Anthropic | None = None
        self.messages: list[dict[str, Any]] = []  # persists across turns

    @property
    def anthropic(self) -> Anthropic:
        if self._anthropic is None:
            api_key = os.getenv("ANTHROPIC_API_KEY")
            if not api_key:
                raise RuntimeError(
                    "No ANTHROPIC_API_KEY found. Set it in .env or `export ANTHROPIC_API_KEY=...`."
                )
            self._anthropic = Anthropic(api_key=api_key)
        return self._anthropic

    async def connect_to_server(self, target: str) -> None:
        """
        Connect to an MCP server over stdio.

        `target` is one of:
          - a path to a local .py script  -> run with the current interpreter
                                              (e.g. mock_odoo_mcp_server.py)
          - the literal string "odoo"     -> launch `uvx mcp-server-odoo`,
                                              forwarding ODOO_* env vars from .env
          - any other string              -> treated as a raw shell command
                                              (split with shlex), for flexibility
        """
        if target == "odoo":
            command, args, env = self._odoo_server_params()
        elif target.endswith(".py"):
            path = Path(target).resolve()
            if not path.exists():
                raise FileNotFoundError(f"No such script: {path}")
            command, args, env = sys.executable, [str(path)], None
        else:
            parts = shlex.split(target)
            command, args, env = parts[0], parts[1:], None

        print(f"[connecting] command={command!r} args={args!r}")
        server_params = StdioServerParameters(command=command, args=args, env=env)

        stdio_transport = await self.exit_stack.enter_async_context(stdio_client(server_params))
        self.stdio, self.write = stdio_transport
        self.session = await self.exit_stack.enter_async_context(ClientSession(self.stdio, self.write))
        await self.session.initialize()

        response = await self.session.list_tools()
        print("\nConnected. Tools available:", [tool.name for tool in response.tools])

    @staticmethod
    def _odoo_server_params() -> tuple[str, list[str], dict[str, str] | None]:
        """
        Build the launch command for the real mcp-server-odoo, per its README:
        https://github.com/ivnvxd/mcp-server-odoo

        Required in .env: ODOO_URL, plus either ODOO_API_KEY or
        (ODOO_USER + ODOO_PASSWORD). ODOO_DB and ODOO_YOLO are optional but
        YOLO mode ("read" or "true") is what the brief calls for pre-MCP-module.
        """
        required_any = ["ODOO_API_KEY"] if os.getenv("ODOO_API_KEY") else ["ODOO_USER", "ODOO_PASSWORD"]
        missing = [v for v in ["ODOO_URL", *required_any] if not os.getenv(v)]
        if missing:
            raise RuntimeError(
                f"Missing env vars for real Odoo connection: {missing}. "
                "Fill these in .env once Person 2 confirms mcp-server-odoo is live."
            )
        # Pass the whole current environment through so PATH etc. still resolves;
        # StdioServerParameters env=None already inherits the parent env, so we
        # only need to set env=None here and let the ODOO_* vars already be in
        # os.environ (loaded via load_dotenv() above).
        return "uvx", ["mcp-server-odoo"], None

    async def process_query(self, query: str) -> str:
        assert self.session is not None, "call connect_to_server() first"

        self.messages.append({"role": "user", "content": query})

        tools_response = await self.session.list_tools()
        available_tools = [
            {"name": t.name, "description": t.description, "input_schema": t.inputSchema}
            for t in tools_response.tools
        ]

        final_text: list[str] = []
        response = self.anthropic.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=1000,
            system=PLACEHOLDER_SYSTEM_PROMPT,
            messages=self.messages,
            tools=available_tools,
        )

        for _ in range(MAX_TOOL_TURNS):
            tool_uses = []
            for block in response.content:
                if block.type == "text":
                    final_text.append(block.text)
                elif block.type == "tool_use":
                    tool_uses.append(block)

            if not tool_uses:
                self.messages.append({"role": "assistant", "content": response.content})
                return "\n".join(final_text)

            self.messages.append({"role": "assistant", "content": response.content})

            tool_result_blocks = []
            for tool_use in tool_uses:
                print(f"  [tool] {tool_use.name}({tool_use.input})")
                result = await self.session.call_tool(tool_use.name, tool_use.input)
                is_error = bool(getattr(result, "isError", False))

                content_blocks = []
                for item in result.content:
                    if getattr(item, "type", None) == "text":
                        content_blocks.append({"type": "text", "text": item.text})
                    else:
                        content_blocks.append({"type": "text", "text": str(item)})

                preview = " ".join(b["text"] for b in content_blocks)[:200]
                print(f"  [result{' ERROR' if is_error else ''}] {preview}")

                tool_result_blocks.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": tool_use.id,
                        "content": content_blocks,
                        "is_error": is_error,
                    }
                )

            self.messages.append({"role": "user", "content": tool_result_blocks})

            response = self.anthropic.messages.create(
                model=ANTHROPIC_MODEL,
                max_tokens=1000,
                system=PLACEHOLDER_SYSTEM_PROMPT,
                messages=self.messages,
                tools=available_tools,
            )

        final_text.append(f"[stopped after {MAX_TOOL_TURNS} tool-use turns]")
        return "\n".join(final_text)

    async def chat_loop(self) -> None:
        print("\nMCP Client Started! Type your queries, 'reset' to clear history, or 'quit' to exit.")
        while True:
            try:
                query = input("\nQuery: ").strip()
            except (EOFError, KeyboardInterrupt):
                break

            if query.lower() == "quit":
                break
            if query.lower() == "reset":
                self.messages.clear()
                print("[history cleared]")
                continue
            if not query:
                continue

            try:
                answer = await self.process_query(query)
                print("\n" + answer)
            except Exception as e:  # noqa: BLE001 - terminal harness, surface anything
                print(f"\nError: {e}")

    async def cleanup(self) -> None:
        await self.exit_stack.aclose()


async def main() -> None:
    target = sys.argv[1] if len(sys.argv) > 1 else "mock_odoo_mcp_server.py"

    client = MCPClient()
    try:
        await client.connect_to_server(target)
        if not os.getenv("ANTHROPIC_API_KEY"):
            print("\nNo ANTHROPIC_API_KEY found. Set it in .env, then re-run.")
            return
        await client.chat_loop()
    finally:
        await client.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
