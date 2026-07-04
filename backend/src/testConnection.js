/**
 * testConnection.js — Standalone sanity check.
 *
 * Run:  node src/testConnection.js
 *
 * 1. Authenticates against Odoo → logs uid
 * 2. Reads hr.employee list → logs names + emails
 * 3. Confirms the XML-RPC pipeline works before any Express code runs.
 */

import odooClient from "./odooClient.js";

async function main() {
  console.log("── Odoo Connection Test ──────────────────────────────────\n");

  // 1. Authenticate
  try {
    const uid = await odooClient.authenticate();
    console.log(`✔  Authenticated. uid = ${uid}\n`);
  } catch (err) {
    console.error("✘  Authentication failed:", err.message);
    process.exit(1);
  }

  // 2. Read employees
  try {
    const employees = await odooClient.searchRead(
      "hr.employee",
      [],
      ["name", "work_email", "department_id", "job_title"],
      { limit: 20 }
    );

    if (employees.length === 0) {
      console.log("⚠  No hr.employee records found (trial may be empty).\n");
    } else {
      console.log(`✔  Found ${employees.length} employee(s):\n`);
      employees.forEach((e) => {
        const dept =
          e.department_id && e.department_id[1]
            ? e.department_id[1]
            : "(no dept)";
        console.log(
          `   [${e.id}] ${e.name} — ${e.work_email || "(no email)"} — ${dept} — ${e.job_title || "(no title)"}`
        );
      });
    }
  } catch (err) {
    console.error("✘  Failed to read employees:", err.message);
  }

  // 3. Quick model availability check
  console.log("\n── Model availability ────────────────────────────────────\n");
  const models = [
    "hr.employee",
    "hr.attendance",
    "hr.leave",
    "hr.work.entry.type",
    "hr.version",
    "hr.payslip",
  ];

  for (const model of models) {
    try {
      const count = await odooClient.execute(model, "search_count", [[]]);
      console.log(`   ✔  ${model} — ${count} record(s)`);
    } catch {
      console.log(`   ✘  ${model} — not available (module may not be installed)`);
    }
  }

  console.log("\n── Done ─────────────────────────────────────────────────\n");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
