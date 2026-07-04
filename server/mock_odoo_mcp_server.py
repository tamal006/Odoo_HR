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

import json
from datetime import date
from typing import Any

from mcp.server.fastmcp import FastMCP

import intelligence

mcp = FastMCP("mock-odoo")

# Fixed "today" so the demo forecasts/timelines are deterministic and line up
# with the dated sample data below. A real deployment uses date.today().
MOCK_TODAY = date(2026, 7, 4)

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
    # Approved Rohit leave that OVERLAPS Ananya's pending #101 (both Engineering,
    # a 2-person team) — so the capacity timeline lights up a real understaffed
    # week and approval_risk on #101 flags the coverage collision.
    105: {"id": 105, "employee_id": 2, "employee_name": "Rohit Sen", "department_id": "Engineering", "holiday_status_id": "Paid Time Off",
          "date_from": "2026-07-15", "date_to": "2026-07-16", "number_of_days": 2, "state": "validate"},
}

ATTENDANCE: dict[int, list[dict[str, Any]]] = {
    1: [{"check_in": "2026-07-01 09:05"}, {"check_in": "2026-07-02 09:40"}, {"check_in": "2026-07-03 09:10"}],
    2: [{"check_in": "2026-07-01 10:15"}, {"check_in": "2026-07-02 10:05"}, {"check_in": "2026-07-03 09:55"}],
    4: [{"check_in": "2026-07-01 09:00"}, {"check_in": "2026-07-02 09:02"}, {"check_in": "2026-07-03 08:58"}],
}

# hr.contract — wage / payroll structure, so the agent can reason over Odoo's
# full HR surface (employees + leave + attendance + contracts).
CONTRACTS: dict[int, dict[str, Any]] = {
    1: {"id": 1, "employee_id": 1, "employee_name": "Ananya Roy", "department_id": "Engineering",
        "wage": 95000, "job_title": "Backend Engineer", "state": "open", "date_start": "2024-02-01"},
    2: {"id": 2, "employee_id": 2, "employee_name": "Rohit Sen", "department_id": "Engineering",
        "wage": 88000, "job_title": "Frontend Engineer", "state": "open", "date_start": "2023-09-15"},
    3: {"id": 3, "employee_id": 3, "employee_name": "Priya Nair", "department_id": "Human Resources",
        "wage": 110000, "job_title": "HR Manager", "state": "open", "date_start": "2022-05-01"},
    4: {"id": 4, "employee_id": 4, "employee_name": "Kabir Malhotra", "department_id": "Design",
        "wage": 82000, "job_title": "Product Designer", "state": "open", "date_start": "2024-11-20"},
}

MODELS: dict[str, list[dict[str, Any]]] = {
    "hr.employee": list(EMPLOYEES.values()),
    "hr.leave": list(LEAVE_REQUESTS.values()),
    "hr.contract": list(CONTRACTS.values()),
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


# ---------------------------------------------------------------------------
# Predictive / AI tools — turn the raw Odoo HR data above into forecasts and
# risk signals. These wrap the pure models in intelligence.py, so the agent
# gets structured numbers + a plain-English narrative instead of doing math
# itself. Output is JSON so both the LLM and the dashboard consume one shape.
# ---------------------------------------------------------------------------

def _leaves_overlapping(leave: dict[str, Any]) -> int:
    """Count OTHER same-department leaves overlapping this one's date window."""
    df, dt = leave.get("date_from"), leave.get("date_to")
    dept = leave.get("department_id")
    n = 0
    for lv in LEAVE_REQUESTS.values():
        if lv["id"] == leave["id"] or lv.get("department_id") != dept:
            continue
        if lv.get("state") not in ("confirm", "validate", "validate1"):
            continue
        if lv.get("date_from", "") <= dt and lv.get("date_to", "") >= df:
            n += 1
    return n


@mcp.tool()
def forecast_leave_balance(employee_id: int) -> str:
    """Project an employee's year-end leave balance from their YTD burn rate.
    Returns JSON: projected_remaining_eoy, pace, exhaustion_date, status, narrative."""
    emp = EMPLOYEES.get(employee_id)
    if emp is None:
        return json.dumps({"error": f"No hr.employee with id={employee_id}"})
    result = intelligence.forecast_leave_balance(
        emp["leaves_taken_this_year"], emp["leave_balance"], MOCK_TODAY)
    return json.dumps({"employee_id": employee_id, "employee_name": emp["name"], **result})


@mcp.tool()
def attendance_risk(employee_id: int) -> str:
    """Score an employee's punctuality / burnout risk (0–100) from hr.attendance
    check-ins. Returns JSON: score, label, avg_lateness_min, trend, narrative."""
    checkins = [a["check_in"] for a in ATTENDANCE.get(employee_id, [])]
    result = intelligence.attendance_risk(checkins)
    emp = EMPLOYEES.get(employee_id, {})
    return json.dumps({"employee_id": employee_id, "employee_name": emp.get("name"), **result})


@mcp.tool()
def team_capacity_forecast(department_id: str | None = None, weeks: int = 8) -> str:
    """Week-by-week staffing outlook for a department (or the whole org): who's
    off, projected coverage %, and an understaffing flag. Returns JSON timeline."""
    if department_id:
        headcount = sum(1 for e in EMPLOYEES.values() if e.get("department_id") == department_id)
        leaves = [lv for lv in LEAVE_REQUESTS.values() if lv.get("department_id") == department_id]
    else:
        headcount = len(EMPLOYEES)
        leaves = list(LEAVE_REQUESTS.values())
    result = intelligence.team_capacity_forecast(leaves, headcount, MOCK_TODAY, weeks)
    return json.dumps({"department_id": department_id or "ALL", **result})


@mcp.tool()
def approval_risk(leave_id: int) -> str:
    """Composite, explainable risk score for GRANTING a leave request — folds in
    the requester's balance, team overlap, and burnout signal into a single
    APPROVE / REVIEW / CAUTION recommendation with reasons. Returns JSON."""
    leave = LEAVE_REQUESTS.get(leave_id)
    if leave is None:
        return json.dumps({"error": f"No hr.leave with id={leave_id}"})
    emp = EMPLOYEES.get(leave["employee_id"], {})
    checkins = [a["check_in"] for a in ATTENDANCE.get(leave["employee_id"], [])]
    att = intelligence.attendance_risk(checkins)
    result = intelligence.approval_risk(
        days_requested=leave.get("number_of_days"),
        requester_remaining=emp.get("leave_balance"),
        team_overlap=_leaves_overlapping(leave),
        attendance_score=att.get("score"),
    )
    return json.dumps({
        "leave_id": leave_id, "employee_name": leave.get("employee_name"),
        "date_from": leave.get("date_from"), "date_to": leave.get("date_to"),
        "days": leave.get("number_of_days"), **result,
    })


@mcp.tool()
def simulate_approval(leave_id: int) -> str:
    """IMPACT PREVIEW — recompute team capacity as if this leave were approved,
    and diff it against the current outlook. Shows the staffing consequence
    BEFORE you approve (which weeks drop, which cross the understaffing floor).
    Returns JSON."""
    leave = LEAVE_REQUESTS.get(leave_id)
    if leave is None:
        return json.dumps({"error": f"No hr.leave with id={leave_id}"})
    dept = leave.get("department_id")
    headcount = sum(1 for e in EMPLOYEES.values() if e.get("department_id") == dept)
    leaves = [lv for lv in LEAVE_REQUESTS.values() if lv.get("department_id") == dept]
    sim = intelligence.simulate_leave_impact(leaves, headcount, leave_id, MOCK_TODAY, 8)
    return json.dumps({
        "leave_id": leave_id, "employee_name": leave.get("employee_name"),
        "department_id": dept, "date_from": leave.get("date_from"),
        "date_to": leave.get("date_to"), **sim,
    })


@mcp.tool()
def hr_overview() -> str:
    """Org-wide HR snapshot for the cockpit dashboard: pending approvals,
    per-employee risk flags, and the worst capacity week across the whole org.
    Returns JSON. (Mock convenience — a real deployment composes this from
    search_records + the predictive tools.)"""
    people = []
    for e in EMPLOYEES.values():
        checkins = [a["check_in"] for a in ATTENDANCE.get(e["id"], [])]
        att = intelligence.attendance_risk(checkins)
        bal = intelligence.forecast_leave_balance(
            e["leaves_taken_this_year"], e["leave_balance"], MOCK_TODAY)
        people.append({
            "id": e["id"], "name": e["name"], "department_id": e["department_id"],
            "job_title": e["job_title"],
            "attendance_score": att["score"], "attendance_label": att["label"],
            "balance_status": bal["status"],
            "projected_remaining_eoy": bal["projected_remaining_eoy"],
        })
    pending = [l for l in LEAVE_REQUESTS.values() if l["state"] == "confirm"]
    cap = intelligence.team_capacity_forecast(
        list(LEAVE_REQUESTS.values()), len(EMPLOYEES), MOCK_TODAY, 8)
    at_risk = [p for p in people
               if (p["attendance_score"] or 0) >= 50 or p["balance_status"] == "over_pace"]
    return json.dumps({
        "headcount": len(EMPLOYEES),
        "pending_count": len(pending),
        "pending_approvals": [
            {"id": l["id"], "employee_name": l["employee_name"],
             "date_from": l["date_from"], "date_to": l["date_to"],
             "days": l["number_of_days"], "department_id": l["department_id"]}
            for l in pending],
        "at_risk": at_risk,
        "people": people,
        "capacity": cap,
    })


if __name__ == "__main__":
    mcp.run()
