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
    return d.toISOString().replace('T', ' ').slice(0, 19)
  } catch (e) {
    return v
  }
}

export async function DELETE(request: Request) {
  const __auth = await guard(request); if (isResponse(__auth)) return __auth
  let conn
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    conn = await getConnection()
    const [res] = await conn.query('DELETE FROM activities WHERE id = ?', [id])
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    if (conn) await conn.end()
  }
}

export async function POST(request: Request) {
  const __auth = await guard(request); if (isResponse(__auth)) return __auth
  let conn
  try {
    const body = await request.json().catch(() => ({}))
    conn = await getConnection()
    const { type, title, client, date, duration } = body
    const dateVal = normalizeDateForMySQL(date)
    const [result] = await conn.query(
      'INSERT INTO activities (type, title, client, date, duration) VALUES (?, ?, ?, ?, ?)',
      [type, title, client, dateVal, duration]
    )
    // @ts-ignore
    const insertId = (result && (result as any).insertId) ? (result as any).insertId : null
    return NextResponse.json({ ok: true, id: insertId })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    if (conn) await conn.end()
  }
}
