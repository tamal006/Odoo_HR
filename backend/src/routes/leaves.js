/**
 * leaves.js — Leave / Time-Off routes.
 *
 * GET   /api/leaves      — List leave requests (own for employee, all for admin)
 * POST  /api/leaves      — Apply for leave
 * PATCH /api/leaves/:id  — Approve / reject a leave request (admin only)
 */

import { Router } from "express";
import { body, param, query, validationResult } from "express-validator";
import { requireRole } from "../middleware/requireRole.js";
import odooClient from "../odooClient.js";

const router = Router();

const LEAVE_FIELDS = [
  "employee_id",
  "work_entry_type_id",
  "date_from",
  "date_to",
  "number_of_days",
  "state",
  "name",
];

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Map Odoo leave state codes to user-friendly labels.
 */
const STATE_LABELS = {
  draft: "Draft",
  confirm: "Pending",
  validate1: "First Approval",
  validate: "Approved",
  refuse: "Rejected",
};

function friendlyState(state) {
  return STATE_LABELS[state] || state;
}

/**
 * Flatten a leave record for the frontend.
 */
function flatten(r) {
  return {
    id: r.id,
    employeeId: r.employee_id ? r.employee_id[0] : null,
    employeeName: r.employee_id ? r.employee_id[1] : null,
    leaveType: r.work_entry_type_id ? r.work_entry_type_id[1] : null,
    leaveTypeId: r.work_entry_type_id ? r.work_entry_type_id[0] : null,
    dateFrom: r.date_from || null,
    dateTo: r.date_to || null,
    numberOfDays: r.number_of_days != null ? r.number_of_days : null,
    state: r.state,
    stateLabel: friendlyState(r.state),
    reason: r.name || null,
  };
}

// ─── GET /api/leaves/types ──────────────────────────────────────────────────

router.get("/types", requireRole("any"), async (_req, res) => {
  try {
    const types = await odooClient.searchRead(
      "hr.work.entry.type",
      [],
      ["id", "name"],
      { order: "name asc" }
    );
    return res.status(200).json({ success: true, data: types });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/leaves ────────────────────────────────────────────────────────

router.get(
  "/",
  requireRole("any"),
  query("employee_id")
    .optional()
    .isInt()
    .withMessage("employee_id must be an integer"),
  query("state")
    .optional()
    .isIn(["draft", "confirm", "validate1", "validate", "refuse"])
    .withMessage("Invalid state filter"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const domain = [];

      // Employee sees only own leaves
      if (req.userRole === "employee") {
        if (!req.employeeId) {
          return res.status(400).json({
            success: false,
            message: "x-employee-id header is required for employee role.",
          });
        }
        domain.push(["employee_id", "=", req.employeeId]);
      } else if (req.query.employee_id) {
        domain.push(["employee_id", "=", parseInt(req.query.employee_id, 10)]);
      }

      if (req.query.state) {
        domain.push(["state", "=", req.query.state]);
      }

      const records = await odooClient.searchRead(
        "hr.leave",
        domain,
        LEAVE_FIELDS,
        { order: "date_from desc", limit: 200 }
      );

      const data = records.map(flatten);

      return res.status(200).json({ success: true, count: data.length, data });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─── POST /api/leaves ───────────────────────────────────────────────────────

router.post(
  "/",
  requireRole("any"),
  body("employee_id")
    .isInt({ min: 1 })
    .withMessage("employee_id is required"),
  body("date_from")
    .notEmpty()
    .withMessage("date_from is required (ISO 8601 or YYYY-MM-DD HH:MM:SS)"),
  body("date_to")
    .notEmpty()
    .withMessage("date_to is required (ISO 8601 or YYYY-MM-DD HH:MM:SS)"),
  body("leave_type")
    .optional({ values: "falsy" }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { employee_id, leave_type, date_from, date_to, reason } = req.body;
    const empId = parseInt(employee_id, 10);

    // Employee can only apply for themselves
    if (req.userRole === "employee" && req.employeeId !== empId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only apply leave for yourself.",
      });
    }

    try {
      // Verify employee exists
      const employees = await odooClient.read("hr.employee", [empId], [
        "id",
        "name",
      ]);
      if (!employees || employees.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Employee not found." });
      }

      // Resolve leave_type — can be an ID, a name string, or empty
      let leaveTypeId;
      if (leave_type && (typeof leave_type === "number" || /^\d+$/.test(leave_type))) {
        leaveTypeId = parseInt(leave_type, 10);
      } else if (leave_type) {
        // Search by name (case-insensitive)
        const types = await odooClient.searchRead(
          "hr.work.entry.type",
          [["name", "ilike", leave_type]],
          ["id", "name"],
          { limit: 1 }
        );
        if (types.length === 0) {
          const allTypes = await odooClient.searchRead(
            "hr.work.entry.type",
            [],
            ["name"],
            { limit: 20 }
          );
          return res.status(400).json({
            success: false,
            message: `Leave type "${leave_type}" not found.`,
            availableTypes: allTypes.map((t) => t.name),
          });
        }
        leaveTypeId = types[0].id;
      } else {
        // No leave type provided — pick the first available one
        const defaultTypes = await odooClient.searchRead(
          "hr.work.entry.type",
          [],
          ["id", "name"],
          { limit: 1 }
        );
        if (defaultTypes.length === 0) {
          return res.status(400).json({
            success: false,
            message: "No leave types configured in Odoo. Please create one first.",
          });
        }
        leaveTypeId = defaultTypes[0].id;
      }

      // Normalize dates — Odoo expects "YYYY-MM-DD HH:MM:SS"
      let normDateFrom = date_from;
      let normDateTo = date_to;

      // If only date provided (YYYY-MM-DD), append time
      if (normDateFrom && normDateFrom.length === 10) {
        normDateFrom = normDateFrom + " 00:00:00";
      } else if (normDateFrom && normDateFrom.includes("T")) {
        normDateFrom = normDateFrom.replace("T", " ").slice(0, 19);
      }

      if (normDateTo && normDateTo.length === 10) {
        normDateTo = normDateTo + " 23:59:59";
      } else if (normDateTo && normDateTo.includes("T")) {
        normDateTo = normDateTo.replace("T", " ").slice(0, 19);
      }

      const newId = await odooClient.create("hr.leave", {
        employee_id: empId,
        work_entry_type_id: leaveTypeId,
        date_from: normDateFrom,
        date_to: normDateTo,
        name: reason || "",
      });

      // Read back the created record
      const created = await odooClient.read("hr.leave", [newId], LEAVE_FIELDS);

      return res.status(201).json({
        success: true,
        message: "Leave request created.",
        data: flatten(created[0]),
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─── PATCH /api/leaves/:id ──────────────────────────────────────────────────

router.patch(
  "/:id",
  requireRole("admin"),
  param("id").isInt().withMessage("Leave ID must be an integer"),
  body("action")
    .isIn(["approve", "reject"])
    .withMessage('action must be "approve" or "reject"'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const leaveId = parseInt(req.params.id, 10);
    const { action, comment } = req.body;

    try {
      // Verify leave exists
      const leaves = await odooClient.read("hr.leave", [leaveId], LEAVE_FIELDS);
      if (!leaves || leaves.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Leave request not found." });
      }

      // Add comment if provided (write to the 'name' field — reason/notes)
      if (comment) {
        const existingName = leaves[0].name || "";
        const updatedName = existingName
          ? `${existingName}\n[Admin comment]: ${comment}`
          : `[Admin comment]: ${comment}`;
        await odooClient.write("hr.leave", leaveId, { name: updatedName });
      }

      // Execute the workflow action
      if (action === "approve") {
        await odooClient.callMethod("hr.leave", "action_validate", [leaveId]);
      } else {
        await odooClient.callMethod("hr.leave", "action_refuse", [leaveId]);
      }

      // Read back updated state
      const updated = await odooClient.read(
        "hr.leave",
        [leaveId],
        LEAVE_FIELDS
      );

      return res.status(200).json({
        success: true,
        message: `Leave ${action === "approve" ? "approved" : "rejected"}.`,
        data: flatten(updated[0]),
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

export default router;
