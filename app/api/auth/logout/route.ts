import { NextResponse } from "next/server"
import { SESSION_COOKIE, sessionCookieOptions, verifySession, readCookie } from "@/lib/session"
import { loadSessionUser, bumpSessionVersion } from "@/lib/session-store"

// Logout = clear the cookie AND bump users.session_version, so a copied cookie stops working immediately.
export async function POST(request: Request) {
  try {
    const sess = await verifySession(readCookie(request.headers.get("cookie"), SESSION_COOKIE))
    const row = await loadSessionUser(sess)
    if (row) await bumpSessionVersion(Number(row.id))
  } catch (e) {
    console.error("[auth/logout] could not bump session_version", e)
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0))
  return res
}
