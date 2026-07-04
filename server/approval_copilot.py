"""
approval_copilot.py — Phase 2 Approval Copilot for HR-on-Odoo AI agent.

Intercepts approve/reject tool calls targeting leave requests (hr.leave),
gathers contextual data the human reviewer needs to make an informed decision,
and gates execution behind explicit user confirmation.

The flow:
1. ``is_approval_action()`` detects whether an outgoing tool call is an
   approve or reject action on a leave request.
2. ``gather_approval_context()`` pulls four data points via MCP:
   - the leave request itself
   - the employee record (incl. leave balance)
   - overlapping team leave in the same date range
   - recent attendance pattern
3. ``format_copilot_context()`` renders that data into a human-readable
   summary injected back into the conversation so the LLM (and the human
   behind it) can review before confirming.
4. ``is_confirmation()`` checks the user's next message against a set of
   known confirmation phrases before the action is actually executed.

Design notes:
- MCP tool results come back as text content blocks. We pass them through
  as raw strings rather than parsing structured data, because the real
  mcp-server-odoo output format may differ from the mock, and the LLM is
  perfectly capable of reading either. Parsing can be tightened in Phase 3.
- Every ``gather_*`` sub-call is wrapped in a try/except so a single
  failure (e.g., missing attendance data) doesn't block the entire copilot
  context from being presented.
"""

from __future__ import annotations

from typing import Any

from mcp import ClientSession

__all__ = [
    "CONFIRMATION_PHRASES",
    "is_approval_action",
    "gather_approval_context",
    "format_copilot_context",
    "is_confirmation",
]

# ---------------------------------------------------------------------------
# 1. Detection: is this tool call an approve/reject on a leave request?
# ---------------------------------------------------------------------------

_APPROVAL_STATES = frozenset({"validate", "refuse"})


def is_approval_action(tool_name: str, tool_args: dict[str, Any]) -> bool:
    """Return True if *tool_name* / *tool_args* represent an approve or reject
    action on an ``hr.leave`` record.

    Conditions (all must be true):
    - ``tool_name`` is ``'update_record'``
    - ``tool_args['model']`` is ``'hr.leave'``
    - ``tool_args['values']['state']`` is ``'validate'`` or ``'refuse'``
    """
    if tool_name != "update_record":
        return False
    if tool_args.get("model") != "hr.leave":
        return False
    state = tool_args.get("values", {}).get("state")
    return state in _APPROVAL_STATES


# ---------------------------------------------------------------------------
# 2. Context gathering via MCP
# ---------------------------------------------------------------------------

async def _call_tool_safe(
    session: ClientSession,
    tool_name: str,
    arguments: dict[str, Any],
) -> str:
    """Call an MCP tool and return the concatenated text content, or an error
    string if the call fails for any reason."""
    try:
        result = await session.call_tool(tool_name, arguments)
        parts: list[str] = []
        for item in result.content:
            if getattr(item, "type", None) == "text":
                parts.append(item.text)
            else:
                parts.append(str(item))
        return "\n".join(parts)
    except Exception as exc:  # noqa: BLE001
        return f"[copilot-error] {tool_name}({arguments}) failed: {exc}"


async def gather_approval_context(
    session: ClientSession,
    leave_request_id: int,
) -> dict[str, str]:
    """Gather all context the human reviewer needs to evaluate a leave
    approve/reject decision.

    Parameters
    ----------
    session:
        An active MCP ``ClientSession`` connected to the Odoo MCP server
        (real or mock).
    leave_request_id:
        The ``id`` of the ``hr.leave`` record being approved or refused.

    Returns
    -------
    dict[str, str]
        Keys: ``leave_request``, ``employee_details``, ``team_overlap``,
        ``attendance_pattern``.  Values are raw text from the MCP tool
        responses (or error descriptions if a call failed).
    """
    # -- 1. Leave request details ------------------------------------------
    leave_text = await _call_tool_safe(
        session,
        "get_record",
        {"model": "hr.leave", "record_id": leave_request_id},
    )

    # -- 2. Employee details (need employee_id from the leave record) ------
    #    We parse the employee_id out of the leave text. If we fail,
    #    we return an explicit error instead of proceeding blindly.
    employee_id = _extract_employee_id(leave_text)
    if employee_id is None:
        return {
            "leave_request": leave_text,
            "employee_details": "[copilot-error] Could not extract employee_id from the leave request text.",
            "team_overlap": "[copilot-error] Aborted team overlap search due to missing employee_id.",
            "attendance_pattern": "[copilot-error] Aborted attendance search due to missing employee_id.",
        }

    employee_text = await _call_tool_safe(
        session,
        "get_record",
        {"model": "hr.employee", "record_id": employee_id},
    )

    # -- 3. Team leave overlap (same date window, confirmed or approved) ---
    #    We extract date_from / date_to from the leave text so we can search
    #    for overlapping leave. We also extract department_id to scope the overlap.
    date_from, date_to = _extract_date_range(leave_text)
    department_id = _extract_department_id(employee_text)

    overlap_domain: list[list[Any]] = [
        ["state", "in", ["confirm", "validate"]],
        ["id", "!=", leave_request_id],
    ]
    if department_id:
        overlap_domain.append(["department_id", "=", department_id])
    if date_from and date_to:
        overlap_domain.append(["date_from", "<=", date_to])
        overlap_domain.append(["date_to", ">=", date_from])

    overlap_text = await _call_tool_safe(
        session,
        "search_records",
        {"model": "hr.leave", "domain": overlap_domain},
    )

    # -- 4. Attendance pattern ---------------------------------------------
    attendance_text = await _call_tool_safe(
        session,
        "get_attendance_pattern",
        {"employee_id": employee_id},
    )

    return {
        "leave_request": leave_text,
        "employee_details": employee_text,
        "team_overlap": overlap_text,
        "attendance_pattern": attendance_text,
    }


# ---------------------------------------------------------------------------
# Lightweight field extraction helpers
# ---------------------------------------------------------------------------
# WARNING: These helpers regex-match against the raw string representation
# returned by the mock server (e.g., Python dict reprs). When the real Odoo
# MCP server is connected, its output format may differ. These regexes MUST
# be re-verified against real output to ensure the copilot doesn't silently
# fail to extract context.

def _extract_employee_id(leave_text: str) -> int | None:
    """Best-effort extraction of ``employee_id`` from a leave-record text
    dump. Returns None on failure."""
    import re

    match = re.search(r"'employee_id':\s*(\d+)", leave_text)
    if match:
        return int(match.group(1))
    # Fallback: try unquoted key (JSON-style)
    match = re.search(r'"employee_id":\s*(\d+)', leave_text)
    if match:
        return int(match.group(1))
    return None

def _extract_department_id(employee_text: str) -> str | None:
    """Best-effort extraction of ``department_id`` from employee record text."""
    import re
    match = re.search(r"['\"]department_id['\"]\s*:\s*['\"]([^'\"]+)['\"]", employee_text)
    if match:
        return match.group(1)
    return None


def _extract_date_range(leave_text: str) -> tuple[str | None, str | None]:
    """Best-effort extraction of ``date_from`` and ``date_to`` from a
    leave-record text dump.  Returns ``(None, None)`` on failure."""
    import re

    date_from = date_to = None
    m = re.search(r"['\"]date_from['\"]\s*:\s*['\"]([^'\"]+)['\"]", leave_text)
    if m:
        date_from = m.group(1)
    m = re.search(r"['\"]date_to['\"]\s*:\s*['\"]([^'\"]+)['\"]", leave_text)
    if m:
        date_to = m.group(1)
    return date_from, date_to


# ---------------------------------------------------------------------------
# 3. Formatting the context block for injection into the conversation
# ---------------------------------------------------------------------------

_ACTION_LABELS: dict[str, str] = {
    "validate": "APPROVE",
    "refuse": "REJECT",
}


def format_copilot_context(context: dict[str, str], action: str) -> str:
    """Render *context* (from :func:`gather_approval_context`) into a
    human-readable block suitable for injection into the conversation.

    Parameters
    ----------
    context:
        Dict with keys ``leave_request``, ``employee_details``,
        ``team_overlap``, ``attendance_pattern``.
    action:
        The Odoo state value: ``'validate'`` or ``'refuse'``.

    Returns
    -------
    str
        Multi-line formatted context block.
    """
    label = _ACTION_LABELS.get(action, action.upper())
    sections = [
        f"📋 APPROVAL COPILOT — Context for {label} decision",
        "",
        "═" * 60,
        "",
        "▸ Leave Request Details",
        "─" * 40,
        context.get("leave_request", "(not available)"),
        "",
        "▸ Employee Details & Leave Balance",
        "─" * 40,
        context.get("employee_details", "(not available)"),
        "",
        "▸ Team Leave Overlap (same date range)",
        "─" * 40,
        context.get("team_overlap", "(not available)"),
        "",
        "▸ Attendance Pattern (recent check-ins)",
        "─" * 40,
        context.get("attendance_pattern", "(not available)"),
        "",
        "═" * 60,
        "",
        "Based on the above, please state your recommendation and "
        "reasoning, then ask the user to confirm before executing.",
    ]
    return "\n".join(sections)


# ---------------------------------------------------------------------------
# 4. Confirmation detection
# ---------------------------------------------------------------------------

import re

def is_confirmation(message: str, action: str) -> bool:
    """Return True if *message* looks like an explicit user confirmation for the given *action*.

    action must be either ``'validate'`` (approve) or ``'refuse'`` (reject).
    The logic safely matches natural phrasings by ensuring it contains an
    action-appropriate affirmative word AND contains no negation/hedge word.
    """
    normalised = message.lower()
    
    # Hedge/negation words that immediately invalidate a confirmation
    hedge_words = {"no", "not", "wait", "cancel", "don't", "stop"}
    if action == "validate":
        hedge_words.add("reject")
        
    for hedge in hedge_words:
        # Check for whole-word matches of hedge words
        if re.search(r'\b' + re.escape(hedge) + r'\b', normalised):
            return False
            
    if action == "validate":
        # Must contain at least one affirmative word
        affirmatives = {"yes", "confirm", "approve", "proceed", "go ahead", "do it"}
        return any(re.search(r'\b' + re.escape(aff) + r'\b', normalised) for aff in affirmatives)
    elif action == "refuse":
        # Must contain at least one rejection word
        affirmatives = {"yes", "reject", "refuse"}
        return any(re.search(r'\b' + re.escape(aff) + r'\b', normalised) for aff in affirmatives)
        
    return False
