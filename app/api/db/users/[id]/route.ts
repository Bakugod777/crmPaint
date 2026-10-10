import { NextResponse } from "next/server"
import bcrypt from "bcrypt"
import { q, exec } from "@/lib/db"
import { guard, isResponse } from "@/lib/api-guard"
import { withSessionCookie } from "@/lib/auth-server"

const ROLES = ["admin", "contador", "empleado", "worker", "user"]

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await guard(request, "admin"); if (isResponse(u)) return u
  const { id } = await ctx.params
  const b = (await request.json().catch(() => ({}))) as any
  const sets: string[] = []; const vals: any[] = []
  if (b.name !== undefined) { sets.push("name = ?"); vals.push(String(b.name)) }
  if (b.phone !== undefined) { sets.push("phone = ?"); vals.push(b.phone || null) }
  if (b.role !== undefined) {
    if (!ROLES.includes(String(b.role))) return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    if (Number(id) === u.id && b.role !== "admin") return NextResponse.json({ error: "Cannot remove your own admin role" }, { status: 400 })
    sets.push("role = ?"); vals.push(b.role)
  }
  if (b.banned !== undefined) { sets.push("banned = ?"); vals.push(b.banned ? 1 : 0) }
  if (b.password) {
    if (String(b.password).length < 8) return NextResponse.json({ error: "Password min 8 chars" }, { status: 400 })
    sets.push("password = ?"); vals.push(await bcrypt.hash(String(b.password), 10))
  }
  if (!sets.length) return NextResponse.json({ ok: true })
  // role / ban / password change -> invalidate every existing session of that user
  const revoke = b.role !== undefined || b.banned !== undefined || !!b.password
  if (revoke) sets.push("session_version = session_version + 1")
  vals.push(Number(id))
  await exec(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, vals)
  const rows = await q("SELECT id, email, name, role, phone, banned, session_version, created_at AS createdAt FROM users WHERE id = ?", [Number(id)])
  const row = rows[0] || null
  const out = row ? { id: row.id, email: row.email, name: row.name, role: row.role, phone: row.phone, banned: row.banned, createdAt: row.createdAt } : null
  // admin edited their own account: other devices are logged out, this one gets a fresh cookie
  if (revoke && row && Number(id) === u.id) return withSessionCookie(NextResponse.json(out), row)
  return NextResponse.json(out)
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await guard(request, "admin"); if (isResponse(u)) return u
  const { id } = await ctx.params
  const n = Number(id)
  if (!n) return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  if (n === u.id) return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 })
  await exec("DELETE FROM users WHERE id = ?", [n])
  return NextResponse.json({ success: true })
}
