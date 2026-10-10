// Central role/permission table for every /api/db/* route.
// Shared by proxy.ts (fast check) and lib/api-guard.ts (per-handler check).
//   admin     -> everything
//   contador  -> finance + CRM read/write, NO user management
//   empleado / worker / user -> only their own data (attendance, payments, profile)
export type Access = "public" | "any" | "staff" | "admin"

export const STAFF_ROLES = ["admin", "contador", "accountant"]

export function normalizeRole(role: string | null | undefined): string {
  const r = String(role || "").toLowerCase()
  if (r === "accountant") return "contador"
  return r || "user"
}

export function isStaff(role: string | null | undefined) {
  return STAFF_ROLES.includes(normalizeRole(role))
}

export function requiredAccess(pathname: string, method: string): Access {
  const m = method.toUpperCase()
  if (!pathname.startsWith("/api/db")) return "public"
  const p = pathname.replace(/\/+$/, "")
  // user management & job applications review: admin only
  if (/^\/api\/db\/users\/[^/]+\/resign$/.test(p) && m === "POST") return "any" // handler: self or admin
  if (p === "/api/db/users" || p.startsWith("/api/db/users/")) return "admin"
  if (p === "/api/db/applications" || p.startsWith("/api/db/applications/")) return "admin"
  // self-service endpoints (handlers filter to the caller's own records)
  if (p === "/api/db/apply" && m === "POST") return "any"
  if (p === "/api/db/me") return "any"
  if (p === "/api/db/data" && m === "GET") return "any"
  if ((p === "/api/db/attendance" || p === "/api/db/employee_payments" || p === "/api/db/employees") && m === "GET") return "any"
  // everything else (finance, CRM, projects, inventory, reports): staff
  return "staff"
}

export function roleAllows(access: Access, role: string | null | undefined): boolean {
  if (access === "public" || access === "any") return true
  const r = normalizeRole(role)
  if (access === "admin") return r === "admin"
  return isStaff(r)
}
