"""Quick verification that all Phase 2 modules import and work correctly."""

import sys

def main():
    errors = []

    # 1. System prompt
    try:
        from system_prompt import build_system_prompt
        p1 = build_system_prompt("employee", 1, "Ananya Roy")
        assert "employee" in p1.lower()
        assert "Ananya Roy" in p1
        assert "delete_record" in p1
        p2 = build_system_prompt("admin", 3, "Priya Nair")
        assert "admin" in p2.lower()
        assert "approve" in p2.lower() or "Approve" in p2
        print(f"[OK] system_prompt.py — employee={len(p1)} chars, admin={len(p2)} chars")
    except Exception as e:
        errors.append(f"system_prompt: {e}")
        print(f"[FAIL] system_prompt.py — {e}")

    # 2. Audit
    try:
        from audit import audit_trail, AuditEntry
        entry = AuditEntry(
            timestamp="2026-07-04T12:00:00Z",
            session_id="test-123",
            user_role="admin",
            user_id=3,
            user_name="Priya Nair",
            request_summary="Test",
            tool_name="get_record",
            tool_args={"model": "hr.employee"},
            tool_result="OK",
            is_error=False,
            requires_confirmation=False,
        )
        audit_trail.log(entry)
        all_entries = audit_trail.get_all()
        assert len(all_entries) >= 1
        assert all_entries[-1]["tool_name"] == "get_record"
        by_session = audit_trail.get_by_session("test-123")
        assert len(by_session) >= 1
        audit_trail.clear()
        assert len(audit_trail.get_all()) == 0
        print("[OK] audit.py — log/get_all/get_by_session/clear all work")
    except Exception as e:
        errors.append(f"audit: {e}")
        print(f"[FAIL] audit.py — {e}")

    # 3. Approval copilot
    try:
        from approval_copilot import is_approval_action, is_confirmation, format_copilot_context
        assert is_approval_action("update_record", {"model": "hr.leave", "values": {"state": "validate"}}) == True
        assert is_approval_action("update_record", {"model": "hr.leave", "values": {"state": "refuse"}}) == True
        assert is_approval_action("get_record", {"model": "hr.employee"}) == False
        assert is_approval_action("update_record", {"model": "hr.employee", "values": {"name": "X"}}) == False
        assert is_confirmation("yes", "validate") == True
        assert is_confirmation("yes, approve it", "validate") == True
        assert is_confirmation("yes but wait", "validate") == False
        assert is_confirmation("no, don't", "validate") == False
        assert is_confirmation("confirm the approval", "validate") == True
        assert is_confirmation("reject", "validate") == False
        assert is_confirmation("yes, reject it", "refuse") == True
        ctx = format_copilot_context({"leave_request": "test", "employee_details": "test", "team_overlap": "none", "attendance_pattern": "ok"}, "validate")
        assert "APPROVE" in ctx
        print("[OK] approval_copilot.py — detection, confirmation, formatting all work")
    except Exception as e:
        errors.append(f"approval_copilot: {e}")
        print(f"[FAIL] approval_copilot.py — {e}")

    # 4. FastAPI app import
    try:
        from app import app
        assert app.title == "HR Agent Layer"
        routes = [r.path for r in app.routes]
        assert "/agent/chat" in routes
        assert "/agent/audit" in routes
        assert "/health" in routes
        print(f"[OK] app.py — FastAPI app with routes: {[r for r in routes if r.startswith('/')]}")
    except Exception as e:
        errors.append(f"app: {e}")
        print(f"[FAIL] app.py — {e}")

    if errors:
        print(f"\n{len(errors)} FAILURE(S)")
        sys.exit(1)
    else:
        print("\nALL PHASE 2 CHECKS PASSED")

if __name__ == "__main__":
    main()
