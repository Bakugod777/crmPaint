import { NextResponse } from "next/server"
import { verifySession, readCookie, SESSION_COOKIE } from "@/lib/session"
import { requiredAccess, roleAllows, normalizeRole, isStaff } from "@/lib/permissions"
import { q } from "@/lib/db"
import { loadSessionUser } from "@/lib/session-store"

export interface ApiUser {
  id: number
  role: string
  name: string
  email: string
  staff: boolean
  employeeId: number | null
}

const deny = (status: 401 | 403, msg: string) => NextResponse.json({ error: msg }, { status })

/**
 * Per-handler guard. Verifies the signed cookie, re-reads the user from MySQL
 * (so deleted/banned users and role changes take effect immediately) and checks
 * the role against lib/permissions.ts. Returns the user or a 401/403 response.
 */
export async function guard(request: Request, accessOverride?: "any" | "staff" | "admin"): Promise<ApiUser | NextResponse> {
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE)
  const sess = await verifySession(token)
  if (!sess) return deny(401, "Not authenticated")
  let row: any
  try {
    row = await loadSessionUser(sess) // checks banned + session_version
  } catch (e) {
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }
  if (!row) return deny(401, "Session no longer valid")
  const role = normalizeRole(row.role)
  const url = new URL(request.url)
  const access = accessOverride || requiredAccess(url.pathname, request.method)
  if (!roleAllows(access, role)) return deny(403, "Forbidden for role " + role)
  let employeeId: number | null = null
  if (!isStaff(role)) {
    try {
      const e = await q("SELECT id FROM employees WHERE user_id = ? LIMIT 1", [row.id])
      employeeId = e[0]?.id ?? null
    } catch { employeeId = null }
  }
  return { id: Number(row.id), role, name: row.name || "", email: row.email || "", staff: isStaff(role), employeeId }
}

export const isResponse = (x: any): x is NextResponse => x instanceof Response
