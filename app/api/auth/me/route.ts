import { NextResponse } from "next/server"
import { guard, isResponse } from "@/lib/api-guard"
import { q } from "@/lib/db"
import { publicUser } from "@/lib/auth-server"

export async function GET(request: Request) {
  const u = await guard(request, "any")
  if (isResponse(u)) return u
  const rows = await q("SELECT id, email, name, role, phone, created_at AS createdAt FROM users WHERE id = ?", [u.id])
  return NextResponse.json({ ...publicUser(rows[0]), employeeId: u.employeeId })
}
