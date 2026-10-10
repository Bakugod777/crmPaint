import { NextResponse } from "next/server"
import { guard, isResponse } from "@/lib/api-guard"
import { promises as fs } from "fs"
import path from "path"

const dbPath = path.join(process.cwd(), "data", "db.json")

export async function GET(request: Request) {
  const __auth = await guard(request, "admin"); if (isResponse(__auth)) return __auth
  try {
    const file = await fs.readFile(dbPath, "utf8")
    return NextResponse.json(JSON.parse(file))
  } catch (err: any) {
    if (err?.code === "ENOENT") return NextResponse.json({ error: "Legacy data/db.json not found" }, { status: 404 })
    return NextResponse.json({ error: "Could not read database" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const __auth = await guard(request, "admin"); if (isResponse(__auth)) return __auth
  try {
    const body = await request.json()
    await fs.writeFile(dbPath, JSON.stringify(body, null, 2), "utf8")
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: "Could not write database" }, { status: 500 })
  }
}
