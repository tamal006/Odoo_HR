"""
mock_odoo_mcp_server.py

A stand-in for `uvx mcp-server-odoo` (https://github.com/ivnvxd/mcp-server-odoo)
that speaks the *same* MCP tool surface (search_records, get_record, list_models,
create_record, update_record, delete_record, post_message, aggregate_records)
but is backed by an in-memory fake HR dataset instead of a real Odoo instance.

Why this exists:
Person 2's mcp-server-odoo isn't confirmed live yet. The riskiest unknown for
Person 3 isn't Odoo's XML-RPC layer (that's a mature, battle-tested package) —
it's whether Claude can reliably drive an MCP tool loop over stdio: list tools,
decide which one to call, call it, read the result back, and keep going across
multiple turns. This mock lets us prove *that* mechanic works today.

Swap-in plan for Phase 2:
Once `uvx mcp-server-odoo` is live against the real Odoo box, point the client
at it instead of this file. Nothing in client.py needs to change — same tool
names, same argument shapes, same response shape (text content blocks). Only
the server process being launched changes.

Run standalone for a smoke test:
    python mock_odoo_mcp_server.py
(it will just sit there waiting for stdio input, matching real MCP server behavior;
Ctrl+C to exit — normally this is launched by an MCP client, not run directly)
"""

from __future__ import annotations

from datetime import date
from typing import Any

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("mock-odoo")

# ---------------------------------------------------------------------------
# Fake Odoo dataset — small HR slice: employees + leave requests + attendance.
# Shaped like real Odoo records (same field names) so swapping to the real
# server later doesn't require the agent's prompts/logic to change.
# ---------------------------------------------------------------------------

EMPLOYEES: dict[int, dict[str, Any]] = {
    1: {"id": 1, "name": "Ananya Roy", "job_title": "Backend Engineer", "department_id": "Engineering",
        "work_email": "ananya.roy@company.test", "leaves_taken_this_year": 6, "leave_balance": 14},
    2: {"id": 2, "name": "Rohit Sen", "job_title": "Frontend Engineer", "department_id": "Engineering",
        "work_email": "rohit.sen@company.test", "leaves_taken_this_year": 11, "leave_balance": 9},
    3: {"id": 3, "name": "Priya Nair", "job_title": "HR Manager", "department_id": "Human Resources",
        "work_email": "priya.nair@company.test", "leaves_taken_this_year": 3, "leave_balance": 17},
    4: {"id": 4, "name": "Kabir Malhotra", "job_title": "Product Designer", "department_id": "Design",
        "work_email": "kabir.malhotra@company.test", "leaves_taken_this_year": 8, "leave_balance": 12},
}

# state mirrors Odoo's hr.leave selection: draft, confirm, validate1, validate, refuse
LEAVE_REQUESTS: dict[int, dict[str, Any]] = {
    101: {"id": 101, "employee_id": 1, "employee_name": "Ananya Roy", "department_id": "Engineering", "holiday_status_id": "Paid Time Off",
          "date_from": "2026-07-14", "date_to": "2026-07-18", "number_of_days": 5, "state": "confirm"},
    102: {"id": 102, "employee_id": 2, "employee_name": "Rohit Sen", "department_id": "Engineering", "holiday_status_id": "Sick Leave",
          "date_from": "2026-07-06", "date_to": "2026-07-07", "number_of_days": 2, "state": "confirm"},
    103: {"id": 103, "employee_id": 4, "employee_name": "Kabir Malhotra", "department_id": "Design", "holiday_status_id": "Paid Time Off",
          "date_from": "2026-08-01", "date_to": "2026-08-10", "number_of_days": 8, "state": "confirm"},
    104: {"id": 104, "employee_id": 3, "employee_name": "Priya Nair", "department_id": "Human Resources", "holiday_status_id": "Paid Time Off",
          "date_from": "2026-06-20", "date_to": "2026-06-21", "number_of_days": 2, "state": "validate"},
}

ATTENDANCE: dict[int, list[dict[str, Any]]] = {
    1: [{"check_in": "2026-07-01 09:05"}, {"check_in": "2026-07-02 09:40"}, {"check_in": "2026-07-03 09:10"}],
    2: [{"check_in": "2026-07-01 10:15"}, {"check_in": "2026-07-02 10:05"}, {"check_in": "2026-07-03 09:55"}],
    4: [{"check_in": "2026-07-01 09:00"}, {"check_in": "2026-07-02 09:02"}, {"check_in": "2026-07-03 08:58"}],
}

MODELS: dict[str, list[dict[str, Any]]] = {
    "hr.employee": list(EMPLOYEES.values()),
    "hr.leave": list(LEAVE_REQUESTS.values()),
}


def _matches(record: dict[str, Any], domain: list[list[Any]] | None) -> bool:
    """Very small subset of Odoo domain matching: [[field, op, value], ...] ANDed together."""
    if not domain:
        return True
    for clause in domain:
        if len(clause) != 3:
            continue
        field, op, value = clause
        actual = record.get(field)
        if op == "=" and actual != value:
            return False
        if op == "!=" and actual == value:
            return False
        if op == "in" and actual not in value:
            return False
        if op == ">" and not (actual is not None and actual > value):
            return False
        if op == "<" and not (actual is not None and actual < value):
            return False
        if op == ">=" and not (actual is not None and actual >= value):
            return False
        if op == "<=" and not (actual is not None and actual <= value):
            return False
    return True


def _select_fields(record: dict[str, Any], fields: list[str] | None) -> dict[str, Any]:
    if not fields or fields == ["__all__"]:
        return record
    return {f: record[f] for f in fields if f in record}


# ---------------------------------------------------------------------------
# Tools — same names/shapes as ivnvxd/mcp-server-odoo so the client code is
# identical whether it's talking to this mock or the real thing.
# ---------------------------------------------------------------------------

@mcp.tool()
def list_models() -> str:
    """List all models enabled for MCP access."""
    return "Enabled models (MOCK — read-only demo data):\n- " + "\n- ".join(MODELS.keys())


@mcp.tool()
def search_records(
    model: str,
    domain: list[list[Any]] | None = None,
    fields: list[str] | None = None,
    limit: int = 10,
) -> str:
    """Search for records in a model with an Odoo-style domain filter."""
    if model not in MODELS:
        return f"[MOCK] Unknown model '{model}'. Known models: {list(MODELS.keys())}"
    matches = [r for r in MODELS[model] if _matches(r, domain)][:limit]
    if not matches:
        return f"[MOCK] No {model} records matched domain={domain}"
    lines = [f"[MOCK-ODOO YOLO-READ] {len(matches)} {model} record(s) matching {domain}:"]
    for r in matches:
        lines.append(" - " + str(_select_fields(r, fields)))
    return "\n".join(lines)


@mcp.tool()
def get_record(model: str, record_id: int, fields: list[str] | None = None) -> str:
    """Retrieve a specific record by ID."""
    table = MODELS.get(model)
    if table is None:
        return f"[MOCK] Unknown model '{model}'"
    rec = next((r for r in table if r["id"] == record_id), None)
    if rec is None:
        return f"[MOCK] No {model} record with id={record_id}"
    return f"[MOCK-ODOO] {model}#{record_id}: {_select_fields(rec, fields)}"


@mcp.tool()
def create_record(model: str, values: dict[str, Any]) -> str:
    """Create a new record. (MOCK: held in memory only, not persisted to a real Odoo.)"""
    table = MODELS.get(model)
    if table is None:
        return f"[MOCK] Unknown model '{model}'"
    new_id = max((r["id"] for r in table), default=0) + 1
    record = {"id": new_id, **values}
    table.append(record)
    return f"[MOCK-ODOO FULL-ACCESS] Created {model}#{new_id}: {record}"


@mcp.tool()
def update_record(model: str, record_id: int, values: dict[str, Any]) -> str:
    """Update an existing record. This is the tool an approve/reject action would call."""
    table = MODELS.get(model)
    if table is None:
        return f"[MOCK] Unknown model '{model}'"
    rec = next((r for r in table if r["id"] == record_id), None)
    if rec is None:
        return f"[MOCK] No {model} record with id={record_id}"
    rec.update(values)
    return f"[MOCK-ODOO FULL-ACCESS] Updated {model}#{record_id} -> {values}. Now: {rec}"


@mcp.tool()
def delete_record(model: str, record_id: int) -> str:
    """Delete a record from a model."""
    table = MODELS.get(model)
    if table is None:
        return f"[MOCK] Unknown model '{model}'"
    before = len(table)
    table[:] = [r for r in table if r["id"] != record_id]
    if len(table) == before:
        return f"[MOCK] No {model} record with id={record_id} to delete"
    return f"[MOCK-ODOO FULL-ACCESS] Deleted {model}#{record_id}"


@mcp.tool()
def aggregate_records(
    model: str,
    groupby: list[str] | None = None,
    aggregates: list[str] | None = None,
    domain: list[list[Any]] | None = None,
) -> str:
    """Server-side aggregation, e.g. counts/sums grouped by a field."""
    table = MODELS.get(model)
    if table is None:
        return f"[MOCK] Unknown model '{model}'"
    matches = [r for r in table if _matches(r, domain)]
    groupby = groupby or []
    group_field = groupby[0].split(":")[0] if groupby else None
    if not group_field:
        return f"[MOCK-ODOO] count({model}, domain={domain}) = {len(matches)}"
    buckets: dict[Any, int] = {}
    for r in matches:
        key = r.get(group_field, "N/A")
        buckets[key] = buckets.get(key, 0) + 1
    return f"[MOCK-ODOO] {model} grouped by {group_field}: " + str(buckets)


@mcp.tool()
def get_attendance_pattern(employee_id: int) -> str:
    """
    MOCK-ONLY helper (not part of real mcp-server-odoo — real deployment would
    derive this from hr.attendance via search_records/aggregate_records).
    Included here so Person 3 can prototype the Approval Copilot's
    'pull attendance pattern' step before the real tool wiring exists.
    """
    records = ATTENDANCE.get(employee_id)
    if not records:
        return f"[MOCK] No attendance records for employee_id={employee_id}"
    return f"[MOCK] Recent check-ins for employee {employee_id}: {records}"


@mcp.tool()
def post_message(
    model: str,
    record_id: int,
    body: str,
    subtype: str = "note",
    body_is_html: bool = False,
) -> str:
    """Post a message to a record's chatter (audit-trail-style note)."""
    return f"[MOCK-ODOO] Posted {subtype} to {model}#{record_id}: {body!r} (html={body_is_html})"


if __name__ == "__main__":
    mcp.run()
