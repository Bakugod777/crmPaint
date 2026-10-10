import { NextResponse } from "next/server"
import bcrypt from "bcrypt"
import { q, exec } from "@/lib/db"
import { guard, isResponse } from "@/lib/api-guard"

const ROLES = ["admin", "contador", "empleado", "worker", "user"]

export async function GET(request: Request) {
  const u = await guard(request, "admin"); if (isResponse(u)) return u
  const rows = await q("SELECT id, email, name, role, phone, banned, created_at AS createdAt FROM users ORDER BY id")
  return NextResponse.json(rows)
}

export async function POST(request: Request) {
  const u = await guard(request, "admin"); if (isResponse(u)) return u
  try {
    const { name, email, password, role, phone } = (await request.json().catch(() => ({}))) as any
    if (!email || !password || !role) return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    if (!ROLES.includes(String(role))) return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    if (String(password).length < 8) return NextResponse.json({ error: "Password min 8 chars" }, { status: 400 })
    const exists = await q("SELECT id FROM users WHERE email = ?", [email])
    if (exists.length) return NextResponse.json({ error: "Email exists" }, { status: 409 })
    const hash = await bcrypt.hash(String(password), 10)
    const r = await exec("INSERT INTO users (email, name, password, role, phone, created_at) VALUES (?, ?, ?, ?, ?, NOW())", [email, name || "", hash, role, phone || null])
    const rows = await q("SELECT id, email, name, role, phone, created_at AS createdAt FROM users WHERE id = ?", [r.insertId])
    return NextResponse.json(rows[0] || null, { status: 201 })
  } catch (err) {
    console.error("[users POST]", err)
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }
}
