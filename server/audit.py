"""In-memory audit trail for all tool calls made by the HR agent.

Every tool invocation is recorded as an ``AuditEntry`` and appended to a
module-level ``AuditTrail`` singleton (``audit_trail``).  Entries can be
queried globally or filtered by chat session, and the entire trail can be
cleared when no longer needed.

Typical usage::

    from audit import audit_trail, AuditEntry

    entry = AuditEntry(
        timestamp="2026-07-04T11:47:58+05:30",
        session_id="abc-123",
        user_role="employee",
        user_id=42,
        user_name="Jane Doe",
        request_summary="Show me my leave balance",
        tool_name="get_leave_balance",
        tool_args={"employee_id": 42},
        tool_result='{"remaining": 12}',
        is_error=False,
        requires_confirmation=False,
        confirmed_by=None,
    )
    audit_trail.log(entry)
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import List

__all__ = ["AuditEntry", "AuditTrail", "audit_trail"]


@dataclass
class AuditEntry:
    """Single audit record for one tool invocation.

    Attributes:
        timestamp:             ISO-8601 formatted time of the call.
        session_id:            Groups entries belonging to the same chat session.
        user_role:             Either ``'employee'`` or ``'admin'``.
        user_id:               ``employee_id`` of the caller.
        user_name:             Display name of the caller.
        request_summary:       The user's original message, truncated to 200
                               characters.
        tool_name:             Name of the tool that was invoked.
        tool_args:             Dictionary of arguments passed to the tool.
        tool_result:           Result text returned by the tool, truncated to
                               500 characters.
        is_error:              ``True`` when the tool call resulted in an error.
        requires_confirmation: ``True`` for approve/reject actions that need
                               explicit human confirmation before execution.
        confirmed_by:          Identifier of the person who confirmed the
                               action, or ``None`` if not (yet) confirmed.
    """

    timestamp: str
    session_id: str
    user_role: str
    user_id: int
    user_name: str
    request_summary: str
    tool_name: str
    tool_args: dict
    tool_result: str
    is_error: bool
    requires_confirmation: bool
    confirmed_by: str | None = None


class AuditTrail:
    """Append-only, in-memory store for :class:`AuditEntry` records.

    The class is intentionally simple — it wraps a plain list so that all
    audit records are kept in insertion order and can be serialised to JSON
    via :func:`dataclasses.asdict`.
    """

    def __init__(self) -> None:
        self._entries: List[AuditEntry] = []

    # ------------------------------------------------------------------
    # Mutators
    # ------------------------------------------------------------------

    def log(self, entry: AuditEntry) -> None:
        """Append *entry* to the audit trail."""
        self._entries.append(entry)

    def clear(self) -> None:
        """Remove **all** entries from the trail."""
        self._entries.clear()

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------

    def get_all(self) -> list[dict]:
        """Return every entry as a JSON-serialisable dictionary."""
        return [asdict(e) for e in self._entries]

    def get_by_session(self, session_id: str) -> list[dict]:
        """Return only the entries whose *session_id* matches."""
        return [asdict(e) for e in self._entries if e.session_id == session_id]


# ------------------------------------------------------------------
# Module-level singleton
# ------------------------------------------------------------------
audit_trail: AuditTrail = AuditTrail()
