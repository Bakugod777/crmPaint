import { NextResponse } from "next/server"
import { q } from "@/lib/db"
import { guard, isResponse } from "@/lib/api-guard"

export async function GET(request: Request) {
  const u = await guard(request, "admin"); if (isResponse(u)) return u
  const rows = await q("SELECT id, user_id AS userId, name, email, skills, availability, message, resume, status, admin_response AS adminResponse, created_at AS createdAt, updated_at AS updatedAt FROM job_applications ORDER BY created_at DESC")
  return NextResponse.json(rows)
}
