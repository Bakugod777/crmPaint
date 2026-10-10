import { NextResponse } from "next/server"
import { q, exec } from "@/lib/db"
import { guard, isResponse } from "@/lib/api-guard"

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await guard(request, "admin"); if (isResponse(u)) return u
  const { id } = await ctx.params
  const { status, adminResponse } = (await request.json().catch(() => ({}))) as any
  if (!["UNDER_REVIEW", "APPROVED", "REJECTED"].includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  await exec("UPDATE job_applications SET status = ?, admin_response = ?, updated_at = NOW() WHERE id = ?", [status, adminResponse || null, Number(id)])
  if (status === "APPROVED") {
    const rows = await q("SELECT user_id FROM job_applications WHERE id = ?", [Number(id)])
    const userId = rows[0]?.user_id
    if (userId) await exec("UPDATE users SET role = 'worker', session_version = session_version + 1 WHERE id = ? AND role = 'user'", [userId])
  }
  return NextResponse.json({ success: true })
}
