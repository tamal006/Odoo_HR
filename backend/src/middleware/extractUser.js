import odooClient from '../odooClient.js';

const ADMIN_EMAILS = [
  'tamalkumarkhan006@gmail.com',
  'admin@company.com'
];

export async function extractUser(req, _res, next) {
  // Start with headers (helpful fallback for Postman/MCP/local testing)
  const headerRole = req.headers["x-user-role"];
  if (headerRole === "admin" || headerRole === "employee") {
    req.userRole = headerRole;
  } else {
    req.userRole = "admin"; // Default to admin for seamless self-service
  }

  const headerEmpId = req.headers["x-employee-id"];
  if (headerEmpId && headerEmpId !== "null" && headerEmpId !== "undefined") {
    req.employeeId = parseInt(headerEmpId, 10) || undefined;
  }

  next();
}
