/**
 * employees.js — Employee routes.
 *
 * POST /api/signup-hook       — Link Clerk user to hr.employee by email
 * GET  /api/employees         — List all employees (admin only)
 * GET  /api/employees/:id     — Employee profile detail (self or admin)
 * PATCH /api/employees/:id    — Edit employee profile (limited fields for employee, all for admin)
 */

import { Router } from "express";
import { body, param, validationResult } from "express-validator";
import { requireRole } from "../middleware/requireRole.js";
import odooClient from "../odooClient.js";

const router = Router();

// ─── Field sets ─────────────────────────────────────────────────────────────

const LIST_FIELDS = [
  "name",
  "work_email",
  "department_id",
  "job_id",
  "job_title",
  "work_phone",
  "mobile_phone",
  "image_128",
];

const DETAIL_FIELDS = [
  "name",
  "work_email",
  "department_id",
  "job_id",
  "job_title",
  "work_phone",
  "mobile_phone",
  "work_location_id",
  "coach_id",
  "parent_id",
  "private_street",
  "private_city",
  "private_state_id",
  "private_zip",
  "private_country_id",
  "private_phone",
  "private_email",
  "image_1920",
  "company_id",
  "resource_calendar_id",
];

/** Fields an employee can edit on their own profile. */
const EMPLOYEE_EDITABLE = new Set([
  "private_street",
  "private_city",
  "private_state_id",
  "private_zip",
  "private_country_id",
  "private_phone",
  "private_email",
  "image_1920",
]);

// ─── POST /api/signup-hook ──────────────────────────────────────────────────

router.post(
  "/signup-hook",
  body("email").isEmail().withMessage("Valid email is required"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { email, clerkUserId } = req.body;

      const employees = await odooClient.searchRead(
        "hr.employee",
        [["work_email", "=", email]],
        ["id", "name", "work_email", "department_id", "job_title"],
        { limit: 1 }
      );

      if (employees.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "No employee found with this email. The employee must be created in Odoo first.",
        });
      }

      const employee = employees[0];

      // NOTE: If you later add a Mongo cache for clerkUserId ↔ employeeId,
      // the upsert would go here. For now we just return the mapping.

      return res.status(200).json({
        success: true,
        employeeId: employee.id,
        name: employee.name,
        email: employee.work_email,
        department: employee.department_id
          ? employee.department_id[1]
          : null,
        jobTitle: employee.job_title || null,
        clerkUserId: clerkUserId || null,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─── GET /api/employees ─────────────────────────────────────────────────────

router.get("/", requireRole("admin"), async (_req, res) => {
  try {
    const employees = await odooClient.searchRead(
      "hr.employee",
      [],
      LIST_FIELDS,
      { order: "name asc" }
    );

    // Flatten many2one fields for the frontend
    const data = employees.map((e) => ({
      id: e.id,
      name: e.name,
      email: e.work_email,
      department: e.department_id ? e.department_id[1] : null,
      departmentId: e.department_id ? e.department_id[0] : null,
      jobId: e.job_id ? e.job_id[0] : null,
      jobPosition: e.job_id ? e.job_id[1] : null,
      jobTitle: e.job_title || null,
      workPhone: e.work_phone || null,
      mobilePhone: e.mobile_phone || null,
      avatar: e.image_128 || null,
    }));

    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/employees/:id ─────────────────────────────────────────────────

router.get(
  "/:id",
  requireRole("any"),
  param("id").isInt().withMessage("Employee ID must be an integer"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const id = parseInt(req.params.id, 10);

    // Employee can only view own profile
    if (req.userRole === "employee" && req.employeeId !== id) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only view your own profile.",
      });
    }

    try {
      const records = await odooClient.read("hr.employee", [id], DETAIL_FIELDS);

      if (!records || records.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Employee not found." });
      }

      const e = records[0];

      const data = {
        id: e.id,
        name: e.name,
        email: e.work_email,
        department: e.department_id ? e.department_id[1] : null,
        departmentId: e.department_id ? e.department_id[0] : null,
        jobId: e.job_id ? e.job_id[0] : null,
        jobPosition: e.job_id ? e.job_id[1] : null,
        jobTitle: e.job_title || null,
        workPhone: e.work_phone || null,
        mobilePhone: e.mobile_phone || null,
        workLocation: e.work_location_id ? e.work_location_id[1] : null,
        coach: e.coach_id ? e.coach_id[1] : null,
        manager: e.parent_id ? e.parent_id[1] : null,
        address: {
          street: e.private_street || null,
          city: e.private_city || null,
          state: e.private_state_id ? e.private_state_id[1] : null,
          zip: e.private_zip || null,
          country: e.private_country_id ? e.private_country_id[1] : null,
        },
        privatePhone: e.private_phone || null,
        privateEmail: e.private_email || null,
        profilePicture: e.image_1920 || null,
        company: e.company_id ? e.company_id[1] : null,
        workSchedule: e.resource_calendar_id
          ? e.resource_calendar_id[1]
          : null,
      };

      return res.status(200).json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─── PATCH /api/employees/:id ───────────────────────────────────────────────

router.patch(
  "/:id",
  requireRole("any"),
  param("id").isInt().withMessage("Employee ID must be an integer"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const id = parseInt(req.params.id, 10);

    // Employee can only edit own profile, and only certain fields
    if (req.userRole === "employee") {
      if (req.employeeId !== id) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only edit your own profile.",
        });
      }

      // Filter to only allowed fields
      const filtered = {};
      for (const [key, value] of Object.entries(req.body)) {
        if (EMPLOYEE_EDITABLE.has(key)) {
          filtered[key] = value;
        }
      }

      if (Object.keys(filtered).length === 0) {
        return res.status(400).json({
          success: false,
          message: `No editable fields provided. Employees can edit: ${[...EMPLOYEE_EDITABLE].join(", ")}`,
        });
      }

      try {
        await odooClient.write("hr.employee", id, filtered);
        const updated = await odooClient.read("hr.employee", [id], DETAIL_FIELDS);
        return res.status(200).json({
          success: true,
          message: "Profile updated.",
          data: updated[0],
        });
      } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
      }
    }

    // Admin can edit any field
    try {
      const values = { ...req.body };
      if (Object.keys(values).length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "No fields provided to update." });
      }

      await odooClient.write("hr.employee", id, values);
      const updated = await odooClient.read("hr.employee", [id], DETAIL_FIELDS);
      return res.status(200).json({
        success: true,
        message: "Employee updated.",
        data: updated[0],
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

export default router;
