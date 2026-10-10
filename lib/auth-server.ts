import { NextResponse } from "next/server"
import { signSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/session"
import { normalizeRole } from "@/lib/permissions"

export function publicUser(r: any) {
  return { id: Number(r.id), email: r.email, name: r.name || "", role: normalizeRole(r.role), phone: r.phone || null, createdAt: r.createdAt || r.created_at || null }
}

export async function withSessionCookie(res: NextResponse, user: any) {
  const token = await signSession({ uid: Number(user.id), role: normalizeRole(user.role), name: user.name || "", email: user.email || "", sv: Number(user.session_version) || 0 })
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions())
  return res
}

// very small in-memory brute-force throttle (per process): 8 failures / 15 min per ip+email
const g = globalThis as any
const fails: Map<string, { n: number; until: number }> = g.__ppLoginFails || (g.__ppLoginFails = new Map())
export function throttleKey(req: Request, email: string) {
  const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "local").split(",")[0].trim()
  return `${ip}|${String(email).toLowerCase()}`
}
export function isThrottled(k: string) {
  const f = fails.get(k)
  return !!f && f.n >= 8 && f.until > Date.now()
}
export function noteFailure(k: string) {
  const f = fails.get(k)
  const now = Date.now()
  if (!f || f.until < now) fails.set(k, { n: 1, until: now + 15 * 60 * 1000 })
  else f.n++
}
export function clearFailures(k: string) { fails.delete(k) }
