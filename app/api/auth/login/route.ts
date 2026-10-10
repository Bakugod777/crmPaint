import { NextResponse } from "next/server"
import bcrypt from "bcrypt"
import { q } from "@/lib/db"
import { publicUser, withSessionCookie, throttleKey, isThrottled, noteFailure, clearFailures } from "@/lib/auth-server"

export async function POST(request: Request) {
  try {
    const { email, password } = (await request.json().catch(() => ({}))) as any
    if (!email || !password) return NextResponse.json({ error: "Missing credentials" }, { status: 400 })
    const k = throttleKey(request, email)
    if (isThrottled(k)) return NextResponse.json({ error: "Too many attempts, try again later" }, { status: 429 })
    const rows = await q("SELECT id, email, name, password, role, phone, banned, session_version, created_at AS createdAt FROM users WHERE email = ? LIMIT 1", [String(email).trim()])
    const u = rows[0]
    const ok = u && !u.banned && u.password ? await bcrypt.compare(String(password), u.password) : false
    if (!ok) {
      noteFailure(k)
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }
    clearFailures(k)
    return withSessionCookie(NextResponse.json(publicUser(u)), u)
  } catch (err) {
    console.error("[auth/login] error", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
