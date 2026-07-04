import { clerkClient } from '@clerk/express';
import odooClient from '../odooClient.js';

// Cache userId -> { employeeId, role } to avoid repetitive API queries
const identityCache = new Map();

const ADMIN_EMAILS = [
  'tamalkumarkhan006@gmail.com',
  'admin@company.com'
];

export async function extractUser(req, _res, next) {
  // 1. Start with headers (helpful fallback for Postman/MCP/local testing)
  const headerRole = req.headers["x-user-role"];
  if (headerRole === "admin" || headerRole === "employee") {
    req.userRole = headerRole;
  }
  const headerEmpId = req.headers["x-employee-id"];
  if (headerEmpId) {
    req.employeeId = parseInt(headerEmpId, 10) || undefined;
  }

  // 2. If Clerk Auth is present (token verified by clerkMiddleware)
  if (req.auth && req.auth.userId) {
    const userId = req.auth.userId;

    if (identityCache.has(userId)) {
      const cached = identityCache.get(userId);
      req.userRole = cached.role;
      req.employeeId = cached.employeeId;
      return next();
    }

    try {
      const user = await clerkClient.users.getUser(userId);
      const email = user.emailAddresses[0]?.emailAddress;

      if (email) {
        const employees = await odooClient.searchRead(
          "hr.employee",
          [["work_email", "=", email]],
          ["id"],
          { limit: 1 }
        );

        if (employees.length > 0) {
          const employeeId = employees[0].id;
          const role = ADMIN_EMAILS.includes(email.toLowerCase()) ? 'admin' : 'employee';

          identityCache.set(userId, { employeeId, role });
          
          // Securely override headers with verified session details
          req.userRole = role;
          req.employeeId = employeeId;
        }
      }
    } catch (err) {
      console.error("Clerk session resolution failed:", err);
    }
  }

  next();
}
