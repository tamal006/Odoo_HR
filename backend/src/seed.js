/**
 * seed.js — Populate a fresh Odoo trial with test HR data.
 *
 * Run once:  node src/seed.js
 *
 * Creates:
 *   • 5 hr.employee records (varied departments/job titles)
 *   • 1 week of hr.attendance check-in/check-out records
 *   • 2–3 pending hr.leave requests
 *
 * No duplicate-guarding — designed for a blank trial, run once.
 */

import odooClient from "./odooClient.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Format a Date as "YYYY-MM-DD HH:MM:SS" (Odoo datetime string). */
function fmtDatetime(date) {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

/** Format a Date as "YYYY-MM-DD" (Odoo date string). */
function fmtDate(date) {
  return date.toISOString().slice(0, 10);
}

/** Get or create a department by name. Returns its ID. */
async function ensureDepartment(name) {
  const existing = await odooClient.searchRead(
    "hr.department",
    [["name", "=", name]],
    ["id"],
    { limit: 1 }
  );
  if (existing.length) return existing[0].id;
  return odooClient.create("hr.department", { name });
}

/** Get or create a job position by name. Returns its ID. */
async function ensureJob(name) {
  const existing = await odooClient.searchRead(
    "hr.job",
    [["name", "=", name]],
    ["id"],
    { limit: 1 }
  );
  if (existing.length) return existing[0].id;
  return odooClient.create("hr.job", { name });
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("── Seeding Odoo with test data ────────────────────────────\n");

  await odooClient.authenticate();

  // ── 1. Departments ──────────────────────────────────────────────────────

  const deptIds = {
    engineering: await ensureDepartment("Engineering"),
    hr: await ensureDepartment("Human Resources"),
    sales: await ensureDepartment("Sales"),
    finance: await ensureDepartment("Finance"),
  };
  console.log("✔  Departments ready:", deptIds);

  // ── 2. Job Positions ────────────────────────────────────────────────────

  const jobIds = {
    softwareEngineer: await ensureJob("Software Engineer"),
    seniorDeveloper: await ensureJob("Senior Developer"),
    hrManager: await ensureJob("HR Manager"),
    salesRep: await ensureJob("Sales Representative"),
    accountant: await ensureJob("Accountant"),
  };
  console.log("✔  Job positions ready:", jobIds);

  // ── 3. Employees ────────────────────────────────────────────────────────

  const employeeDefs = [
    {
      name: "Alice Johnson",
      work_email: "alice@example.com",
      department_id: deptIds.engineering,
      job_id: jobIds.softwareEngineer,
      job_title: "Software Engineer",
      work_phone: "+1-555-0101",
      mobile_phone: "+1-555-0111",
    },
    {
      name: "Bob Smith",
      work_email: "bob@example.com",
      department_id: deptIds.engineering,
      job_id: jobIds.seniorDeveloper,
      job_title: "Senior Developer",
      work_phone: "+1-555-0102",
      mobile_phone: "+1-555-0112",
    },
    {
      name: "Carol White",
      work_email: "carol@example.com",
      department_id: deptIds.hr,
      job_id: jobIds.hrManager,
      job_title: "HR Manager",
      work_phone: "+1-555-0103",
      mobile_phone: "+1-555-0113",
    },
    {
      name: "David Brown",
      work_email: "david@example.com",
      department_id: deptIds.sales,
      job_id: jobIds.salesRep,
      job_title: "Sales Representative",
      work_phone: "+1-555-0104",
      mobile_phone: "+1-555-0114",
    },
    {
      name: "Eve Davis",
      work_email: "eve@example.com",
      department_id: deptIds.finance,
      job_id: jobIds.accountant,
      job_title: "Accountant",
      work_phone: "+1-555-0105",
      mobile_phone: "+1-555-0115",
    },
  ];

  const employeeIds = [];
  for (const def of employeeDefs) {
    const id = await odooClient.create("hr.employee", def);
    employeeIds.push(id);
    console.log(`   ✔  Created employee [${id}] ${def.name}`);
  }

  // ── 3.5. Update Auto-Created Contracts (hr.contract) ──────────────────────
  console.log("\n── Updating auto-created contracts (hr.contract) ───────────\n");
  const baseWages = [50000, 75000, 65000, 45000, 55000];
  for (let i = 0; i < employeeIds.length; i++) {
    const empId = employeeIds[i];
    const wage = baseWages[i];
    try {
      const contracts = await odooClient.searchRead("hr.contract", [["employee_id", "=", empId]], ["id"]);
      if (contracts.length > 0) {
        await odooClient.write("hr.contract", contracts[0].id, { wage });
        console.log(`   ✔  Set wage = ${wage} for employee ${empId} (Contract ${contracts[0].id})`);
      }
    } catch (err) {
      console.log(`   ⚠  Could not update wage for employee ${empId}: ${err.message}`);
    }
  }

  // ── 4. Attendance (Mon–Fri for the past week) ───────────────────────────

  console.log("\n── Seeding attendance (past 5 work days) ──────────────────\n");

  const today = new Date();
  // Find last Monday
  const dayOfWeek = today.getDay(); // 0=Sun … 6=Sat
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() - ((dayOfWeek + 6) % 7) - 7); // Monday of previous week

  const startHours = [8, 8.5, 9, 8.25, 9.5]; // varied check-in times
  const workHours = [8, 8.5, 7.5, 9, 8]; // varied durations

  for (let d = 0; d < 5; d++) {
    // Mon-Fri
    const day = new Date(lastMonday);
    day.setDate(lastMonday.getDate() + d);

    for (let e = 0; e < employeeIds.length; e++) {
      const empId = employeeIds[e];
      const startH = startHours[(e + d) % startHours.length];
      const duration = workHours[(e + d) % workHours.length];

      const checkIn = new Date(day);
      checkIn.setHours(Math.floor(startH), (startH % 1) * 60, 0, 0);

      const checkOut = new Date(checkIn);
      checkOut.setHours(checkIn.getHours() + Math.floor(duration));
      checkOut.setMinutes(checkIn.getMinutes() + (duration % 1) * 60);

      await odooClient.create("hr.attendance", {
        employee_id: empId,
        check_in: fmtDatetime(checkIn),
        check_out: fmtDatetime(checkOut),
      });
    }
    console.log(`   ✔  Attendance for ${fmtDate(day)}`);
  }

  // ── 5. Leave Requests (2–3 pending) ─────────────────────────────────────

  console.log("\n── Seeding leave requests ─────────────────────────────────\n");

  // Find available leave types (mapped to hr.work.entry.type in newer Odoo versions)
  const leaveTypes = await odooClient.searchRead(
    "hr.work.entry.type",
    [["code", "like", "LEAVE"]],
    ["id", "name"],
    { limit: 10 }
  );

  if (leaveTypes.length === 0) {
    console.log("⚠  No leave types found — skipping leave seed.");
    console.log(
      '   Create leave types in Odoo (Time Off → Configuration → Leave Types) first.'
    );
  } else {
    console.log(
      `   Found ${leaveTypes.length} leave type(s): ${leaveTypes.map((lt) => lt.name).join(", ")}`
    );

    // Use the first available leave type
    const leaveTypeId = leaveTypes[0].id;

    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + ((8 - dayOfWeek) % 7 || 7));

    const leaveDefs = [
      {
        employee_id: employeeIds[0], // Alice
        work_entry_type_id: leaveTypeId,
        date_from: fmtDatetime(
          new Date(nextMonday.getFullYear(), nextMonday.getMonth(), nextMonday.getDate(), 8, 0, 0)
        ),
        date_to: fmtDatetime(
          new Date(nextMonday.getFullYear(), nextMonday.getMonth(), nextMonday.getDate() + 2, 17, 0, 0)
        ),
        name: "Family vacation — planned well in advance",
      },
      {
        employee_id: employeeIds[1], // Bob
        work_entry_type_id: leaveTypeId,
        date_from: fmtDatetime(
          new Date(nextMonday.getFullYear(), nextMonday.getMonth(), nextMonday.getDate() + 3, 8, 0, 0)
        ),
        date_to: fmtDatetime(
          new Date(nextMonday.getFullYear(), nextMonday.getMonth(), nextMonday.getDate() + 4, 17, 0, 0)
        ),
        name: "Medical appointment — need two days off",
      },
      {
        employee_id: employeeIds[3], // David
        work_entry_type_id: leaveTypeId,
        date_from: fmtDatetime(
          new Date(nextMonday.getFullYear(), nextMonday.getMonth(), nextMonday.getDate() + 7, 8, 0, 0)
        ),
        date_to: fmtDatetime(
          new Date(nextMonday.getFullYear(), nextMonday.getMonth(), nextMonday.getDate() + 7, 17, 0, 0)
        ),
        name: "Personal day",
      },
    ];

    for (const def of leaveDefs) {
      try {
        const id = await odooClient.create("hr.leave", def);
        console.log(
          `   ✔  Created leave [${id}] for employee ${def.employee_id}: "${def.name}"`
        );
      } catch (err) {
        console.log(
          `   ⚠  Could not create leave for employee ${def.employee_id}: ${err.message}`
        );
        console.log(
          "      (Leave allocation may be required — configure in Odoo Time Off settings)"
        );
      }
    }
  }

  console.log("\n── Seed complete ─────────────────────────────────────────\n");
  console.log("Employee IDs:", employeeIds);
  console.log(
    "Use these IDs in x-employee-id headers when testing the API.\n"
  );
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
