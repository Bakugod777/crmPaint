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

const normalizeDateForMySQL = (v: any) => {
  if (!v && v !== 0) return v
  try {
    const d = new Date(v)
    if (isNaN(d.getTime())) return v
    // produce 'YYYY-MM-DD HH:MM:SS'
    return d.toISOString().replace('T', ' ').slice(0, 19)
  } catch (e) {
    return v
  }
}

export async function PUT(request: Request) {
  const __auth = await guard(request); if (isResponse(__auth)) return __auth
  let conn
  try {
    const body = await request.json().catch(() => ({}))
    const id = body?.id
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    // only allow updating known columns to avoid SQL errors on different schemas
    const allowed = ['type', 'title', 'client', 'date', 'duration', 'status', 'assigned_to', 'description', 'starred']
    const sets: string[] = []
    const params: any[] = []
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        sets.push(`${key} = ?`)
        let val = (body as any)[key]
        if (key === 'date') val = normalizeDateForMySQL(val)
        params.push(val)
      }
    }
    if (sets.length === 0) return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
    params.push(id)
    const sql = `UPDATE activities SET ${sets.join(', ')} WHERE id = ?`
    conn = await getConnection()
    try {
      const [res] = await conn.query(sql, params)
      return NextResponse.json({ ok: true })
    } catch (e) {
      // log query + params for easier debugging
      console.error('[activities update] SQL error', { sql, params, err: String(e) })
      return NextResponse.json({ error: String(e) }, { status: 500 })
    }
  } catch (err) {
    console.error('[activities update] unexpected error', String(err))
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    if (conn) await conn.end()
  }
}
