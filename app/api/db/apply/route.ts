import { NextResponse } from "next/server"
import { exec } from "@/lib/db"
import { guard, isResponse } from "@/lib/api-guard"

// Job application by the logged-in user (user id is taken from the session, not the body).
export async function POST(request: Request) {
  const u = await guard(request, "any"); if (isResponse(u)) return u
  const { name, email, skills, availability, message, resume } = (await request.json().catch(() => ({}))) as any
  if (!name || !email) return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  await exec("INSERT INTO job_applications (user_id, name, email, skills, availability, message, resume, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'SUBMITTED', NOW())",
    [u.id, name, email, skills || null, availability || null, message || null, resume || null])
  return NextResponse.json({ success: true }, { status: 201 })
}
