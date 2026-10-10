import { NextResponse } from "next/server"
import { guard, isResponse } from "@/lib/api-guard"
import mysql from "mysql2/promise"
import dbConfig from "@/lib/db-config"

const getConnection = async () => {
  return await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
  })
}

export async function PUT(request: Request) {
  const __auth = await guard(request); if (isResponse(__auth)) return __auth
  let conn
  try {
    const body: any = await request.json()
    console.error('updateDeal body:', body)
    const { id } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    // Build dynamic SET clause only for provided fields to avoid overwriting with NULLs
    const mapping: Array<[string, string]> = [
      ['title', 'title'],
      ['client', 'client'],
      ['value', 'value'],
      ['stage', 'stage'],
      ['probability', 'probability'],
      ['closeDate', 'close_date'],
      ['assignedTo', 'assigned_to'],
    ]

    const sets: string[] = []
    const values: any[] = []
    for (const [key, col] of mapping) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        sets.push(`${col} = ?`)
        // normalize empty string closeDate to null
        let v = body[key]
        if (key === 'closeDate' && v === '') v = null
        values.push(v)
      }
    }

    if (sets.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

    conn = await getConnection()
    const sql = `UPDATE deals SET ${sets.join(', ')} WHERE id = ?`
    values.push(id)
    const [res] = await conn.query(sql, values)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('updateDeal error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    if (conn) await conn.end()
  }
}
