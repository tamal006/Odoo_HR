"""
Proves the MCP stdio transport + tool-call round trip works, independent of
whether an ANTHROPIC_API_KEY is available in this environment. This isolates
"does the plumbing work" from "does Claude decide to call the right tool" —
useful to run first, since a failure here means the transport/server is
broken, not that Claude made a bad decision.
"""

import asyncio

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def main() -> None:
    params = StdioServerParameters(command="python3", args=["mock_odoo_mcp_server.py"], env=None)

    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            tools = (await session.list_tools()).tools
            tool_names = {t.name for t in tools}
            print("tools:", sorted(tool_names))
            expected = {
                "list_models", "search_records", "get_record", "create_record",
                "update_record", "delete_record", "aggregate_records", "post_message",
            }
            missing = expected - tool_names
            assert not missing, f"missing expected tools: {missing}"

            r = await session.call_tool(
                "search_records",
                {"model": "hr.leave", "domain": [["state", "=", "confirm"]], "limit": 10},
            )
            text = r.content[0].text
            print("\nsearch_records(pending leaves):\n", text)
            assert "3 " in text or "3 hr.leave" in text, "expected 3 pending leave requests in mock data"

            r = await session.call_tool("get_record", {"model": "hr.employee", "record_id": 1})
            print("\nget_record(employee 1):\n", r.content[0].text)
            assert "Ananya Roy" in r.content[0].text

            r = await session.call_tool(
                "update_record",
                {"model": "hr.leave", "record_id": 101, "values": {"state": "validate"}},
            )
            print("\nupdate_record(approve leave 101):\n", r.content[0].text)
            assert "validate" in r.content[0].text

            r = await session.call_tool("get_record", {"model": "hr.leave", "record_id": 101})
            print("\nget_record(leave 101, post-approval):\n", r.content[0].text)
            assert "'state': 'validate'" in r.content[0].text

            r = await session.call_tool(
                "aggregate_records", {"model": "hr.leave", "groupby": ["state"]}
            )
            print("\naggregate_records(leaves by state):\n", r.content[0].text)

            r = await session.call_tool("get_attendance_pattern", {"employee_id": 2})
            print("\nget_attendance_pattern(employee 2):\n", r.content[0].text)

    print("\nALL MCP PLUMBING CHECKS PASSED")


if __name__ == "__main__":
    asyncio.run(main())
