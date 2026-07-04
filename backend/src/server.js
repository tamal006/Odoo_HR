/**
 * server.js — Express app entrypoint for the HRMS backend.
 *
 * Mounts all route modules on /api/* paths.
 * No MongoDB — Odoo is the single source of truth for all HR data.
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { extractUser } from "./middleware/extractUser.js";
import employeesRouter from "./routes/employees.js";
import attendanceRouter from "./routes/attendance.js";
import leavesRouter from "./routes/leaves.js";
import payrollRouter from "./routes/payroll.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Global Middleware ──────────────────────────────────────────────────────

app.use(express.json());

app.use(
  cors({
    origin: "*",
    credentials: false,
  })
);

// Extract user identity from headers on every request
app.use(extractUser);

// ─── Health Check ───────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    service: "hrms-backend",
    timestamp: new Date().toISOString(),
    odooUrl: process.env.ODOO_URL || "(not configured)",
  });
});

// ─── Routes ─────────────────────────────────────────────────────────────────

app.use("/api/employees", employeesRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/leaves", leavesRouter);
app.use("/api/payroll", payrollRouter);

// ─── 404 Catch-all ──────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

// ─── Global Error Handler ───────────────────────────────────────────────────

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    message: err.message || "Internal server error.",
  });
});

// ─── Start ──────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 HRMS Backend running on http://localhost:${PORT}`);
  console.log(`   Odoo: ${process.env.ODOO_URL || "(not configured)"}`);
  console.log(`   DB:   ${process.env.ODOO_DB || "(not configured)"}\n`);
});
