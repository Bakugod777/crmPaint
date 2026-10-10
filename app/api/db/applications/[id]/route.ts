import { NextResponse } from "next/server"
import { q } from "@/lib/db"
import { guard, isResponse } from "@/lib/api-guard"

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await guard(request, "admin"); if (isResponse(u)) return u
  const { id } = await ctx.params
  const rows = await q("SELECT * FROM job_applications WHERE id = ?", [Number(id)])
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(rows[0])
}
