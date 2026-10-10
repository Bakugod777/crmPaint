import { NextResponse } from "next/server"
import bcrypt from "bcrypt"
import { q, exec } from "@/lib/db"
import { publicUser, withSessionCookie } from "@/lib/auth-server"

// Public self-registration: CLOSED unless ALLOW_PUBLIC_REGISTER=1. When open it always creates the
// lowest role ("user"): own data only. Admins create staff accounts from the Users page.
export async function POST(request: Request) {
  if (process.env.ALLOW_PUBLIC_REGISTER !== "1") return NextResponse.json({ error: "Public registration is disabled" }, { status: 403 })
  try {
    const { name, email, password, phone } = (await request.json().catch(() => ({}))) as any
    const em = String(email || "").trim().toLowerCase()
    if (!em || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em) || !password || String(password).length < 8)
      return NextResponse.json({ error: "Valid email and password (min 8 chars) required" }, { status: 400 })
    const exists = await q("SELECT id FROM users WHERE email = ?", [em])
    if (exists.length) return NextResponse.json({ error: "Email exists" }, { status: 409 })
    const hash = await bcrypt.hash(String(password), 10)
    const r = await exec("INSERT INTO users (email, name, password, role, phone, created_at) VALUES (?, ?, ?, 'user', ?, NOW())", [em, String(name || "").slice(0, 255), hash, phone ? String(phone).slice(0, 20) : null])
    const rows = await q("SELECT id, email, name, role, phone, session_version, created_at AS createdAt FROM users WHERE id = ?", [r.insertId])
    return withSessionCookie(NextResponse.json(publicUser(rows[0]), { status: 201 }), rows[0])
  } catch (err) {
    console.error("[auth/register] error", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
