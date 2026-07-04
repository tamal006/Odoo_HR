# MCP Bridge Handoff — For Person 3

This document provides everything Person 3 needs to connect an AI agent to the same Odoo instance this backend uses, via the `mcp-server-odoo` MCP bridge.

## ⚡ Quick Start

The MCP server is a **separate, already-built tool** — you don't need to write it from scratch. It's the [`mcp-server-odoo`](https://github.com/ivnvxd/mcp-server-odoo) package.

### Prerequisites

1. **Python 3.10+** and **UV** installed:
   ```powershell
   powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
   ```

2. **Odoo instance** — same one the backend uses. Credentials below.

### Running in YOLO Mode (Testing/Development)

YOLO mode requires **no custom Odoo module** — it works with any standard Odoo installation that has XML-RPC enabled.

```bash
# Set environment variables
ODOO_URL=https://your-domain.odoo.com
ODOO_DB=your-database-name
ODOO_API_KEY=your-api-key-here
ODOO_YOLO=true
```

### Verify with MCP Inspector

```bash
npx @modelcontextprotocol/inspector uvx mcp-server-odoo
```

In the Inspector UI, set these environment variables:
- `ODOO_URL` → your Odoo URL
- `ODOO_DB` → your database name  
- `ODOO_API_KEY` → your API key
- `ODOO_YOLO` → `true`

Test operations:
1. **Search** → `hr.employee` → should return employee list
2. **Create** → try creating a test record
3. **Update** → modify a field on an existing record

### Claude Desktop / Cursor / VS Code Config

```json
{
  "mcpServers": {
    "odoo": {
      "command": "uvx",
      "args": ["mcp-server-odoo"],
      "env": {
        "ODOO_URL": "https://your-domain.odoo.com",
        "ODOO_API_KEY": "your-api-key-here",
        "ODOO_DB": "your-database-name",
        "ODOO_YOLO": "true"
      }
    }
  }
}
```

---

## 📋 Odoo Credentials (fill in before handing off)

| Variable | Value |
|----------|-------|
| `ODOO_URL` | `https://your-domain.odoo.com` |
| `ODOO_DB` | `your-database-name` |
| `ODOO_USERNAME` | `admin` |
| `ODOO_API_KEY` | `(generate at Settings → Users → profile → Account Security → New API Key)` |

> **Important:** Use the same credentials as the backend `.env` file. The MCP bridge and this Express backend both talk to the same Odoo instance via XML-RPC.

---

## 📦 HR Models Available in Odoo

These are the models the Express backend uses. The MCP bridge can access all of them (and any other Odoo model):

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `hr.employee` | Employee records | `name`, `work_email`, `department_id`, `job_id`, `job_title`, `work_phone`, `mobile_phone`, `image_1920` |
| `hr.department` | Departments | `name`, `parent_id` |
| `hr.job` | Job positions | `name`, `department_id` |
| `hr.attendance` | Check-in/out records | `employee_id`, `check_in`, `check_out`, `worked_hours` |
| `hr.leave` | Leave/time-off requests | `employee_id`, `holiday_status_id`, `date_from`, `date_to`, `state`, `name` |
| `hr.leave.type` | Leave type definitions | `name`, `allocation_type` |
| `hr.contract` | Employment contracts | `employee_id`, `wage`, `state`, `date_start`, `date_end`, `struct_id` |
| `hr.payslip` | Payslips (Enterprise only) | `employee_id`, `date_from`, `date_to`, `state`, `net_wage`, `basic_wage` |

### Leave States
- `draft` → Draft
- `confirm` → Pending / To Approve
- `validate1` → First Approval
- `validate` → Approved
- `refuse` → Rejected

### Key Workflow Methods
- `hr.leave` → `action_validate` (approve), `action_refuse` (reject), `action_draft` (reset to draft)

---

## 🚫 What NOT to Do

- **Don't write MCP client code** — that's your job as Person 3, using whatever agent framework you choose
- **Don't write any Express routes** — those are built and tested (this backend)
- **Don't duplicate HR data into MongoDB** — Odoo is the single source of truth
- **Don't install a custom Odoo module** — YOLO mode doesn't need one

---

## ✅ What to Verify Before Building

1. MCP Inspector shows successful search/create/update against `hr.employee`
2. Leave approval workflow works: create a `hr.leave`, then call `action_validate`
3. Attendance toggle works: create `hr.attendance` with `check_in`, then update with `check_out`

Once verified, you can start building the MCP client / agent integration.
