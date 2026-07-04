/**
 * requireRole.js — Role-check middleware factory.
 *
 * Usage:
 *   router.get('/employees', requireRole('admin'), handler)
 *   router.get('/profile/:id', requireRole('any'), handler)
 *
 * Depends on extractUser having run first (sets req.userRole).
 *
 * "admin"    → only x-user-role: admin
 * "employee" → only x-user-role: employee
 * "any"      → either, but at least one must be set
 */

export function requireRole(role) {
  return (req, res, next) => {
    const userRole = req.userRole;

    // No role header at all
    if (!userRole) {
      return res.status(401).json({
        success: false,
        message: "Missing x-user-role header. Authentication required.",
      });
    }

    if (role === "any") {
      // Any authenticated role is fine
      return next();
    }

    if (role === "admin" && userRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin/HR role required.",
      });
    }

    if (role === "employee" && userRole !== "employee") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Employee role required.",
      });
    }

    next();
  };
}
