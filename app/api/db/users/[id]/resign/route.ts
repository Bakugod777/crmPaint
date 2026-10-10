import { NextResponse } from "next/server"
import { q, exec } from "@/lib/db"
import { withSessionCookie } from "@/lib/auth-server"
import { guard, isResponse } from "@/lib/api-guard"

// Worker resignation: only the user themself or an admin.
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await guard(request, "any"); if (isResponse(u)) return u
  const { id } = await ctx.params
  const n = Number(id)
  if (!n) return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  if (n !== u.id && u.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { reason } = (await request.json().catch(() => ({}))) as any
  await exec("UPDATE users SET role = 'user', session_version = session_version + 1 WHERE id = ? AND role <> 'admin'", [n])
  try { await exec("UPDATE project_workers SET status = 'RESIGNED', paid_at = COALESCE(paid_at, NOW()) WHERE user_id = ? AND status <> 'PAID'", [n]) } catch {}
  try { await exec("INSERT INTO role_transitions (user_id, from_role, to_role, reason, created_at) VALUES (?, 'worker', 'user', ?, NOW())", [n, reason || null]) } catch {}
  if (n === u.id) {
    const row = (await q("SELECT id, email, name, role, session_version FROM users WHERE id = ?", [n]))[0]
    if (row) return withSessionCookie(NextResponse.json({ success: true }), row)
  }
  return NextResponse.json({ success: true })
}
