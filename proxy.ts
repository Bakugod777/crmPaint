import { NextResponse, type NextRequest } from "next/server"
import { verifySession, SESSION_COOKIE } from "@/lib/session"
import { requiredAccess, roleAllows, isStaff, normalizeRole } from "@/lib/permissions"
import { loadSessionUser } from "@/lib/session-store"

// Next 16 "proxy" (formerly middleware): first line of defense.
//  - /api/db/*  -> 401 without a valid session, 403 if the role is not allowed
//  - /api/data  -> legacy file DB, admin only
//  - pages      -> redirect to /login without a session; role-restricted sections redirect to /
// Every API handler ALSO calls guard() (lib/api-guard.ts) which re-checks against MySQL.

const PUBLIC_PAGES = ["/login", "/register"]
const ADMIN_PAGES = ["/admin"]
const STAFF_PAGES = [
  "/leads", "/contacts", "/pipeline", "/clients", "/products", "/quotes", "/invoices", "/cases",
  "/email", "/reports", "/automation", "/employees", "/attendance", "/materials", "/expenses",
  "/price-list", "/accounting",
]
const under = (p: string, list: string[]) => list.some((b) => p === b || p.startsWith(b + "/"))

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  // Public self-signup is closed unless ALLOW_PUBLIC_REGISTER=1
  if (pathname === "/register" && process.env.ALLOW_PUBLIC_REGISTER !== "1") return NextResponse.redirect(new URL("/login", req.url))
  if (pathname.startsWith("/api/auth/")) return NextResponse.next()

  // Signed cookie + DB check (banned / session_version). Proxy runs in the Node.js runtime in Next 16.
  const token = req.cookies.get(SESSION_COOKIE)?.value
  const signed = await verifySession(token)
  let sess: { role: string } | null = null
  if (signed) {
    try {
      const row = await loadSessionUser(signed)
      sess = row ? { role: normalizeRole(row.role) } : null
    } catch {
      return NextResponse.json({ error: "Service unavailable (DB)" }, { status: 503 })
    }
  }

  if (pathname.startsWith("/api/")) {
    if (pathname === "/api/data" || pathname.startsWith("/api/data/")) {
      if (!sess) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
      if (normalizeRole(sess.role) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      return NextResponse.next()
    }
    if (pathname.startsWith("/api/db")) {
      if (!sess) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
      const access = requiredAccess(pathname, req.method)
      if (!roleAllows(access, sess.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      return NextResponse.next()
    }
    // any other API path: require a session
    if (!sess) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    return NextResponse.next()
  }

  if (under(pathname, PUBLIC_PAGES)) return NextResponse.next()
  if (!sess) {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    url.search = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : ""
    return NextResponse.redirect(url)
  }
  if (under(pathname, ADMIN_PAGES) && normalizeRole(sess.role) !== "admin") {
    // contador may use payroll
    if (!(pathname.startsWith("/admin/payroll") && isStaff(sess.role))) return NextResponse.redirect(new URL("/", req.url))
  }
  if (under(pathname, STAFF_PAGES) && !isStaff(sess.role)) return NextResponse.redirect(new URL("/my-work", req.url))
  return NextResponse.next()
}

export const config = {
  matcher: [
    // everything except Next internals and static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|txt|xml|webmanifest)$|\\.well-known).*)",
  ],
}
