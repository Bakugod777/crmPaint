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
    const body = await request.json()
    const { id, client, project, date, validUntil, amount, status } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    conn = await getConnection()
    const [res] = await conn.query('UPDATE quotes SET client = ?, project = ?, date = ?, valid_until = ?, amount = ?, status = ? WHERE id = ?', [client, project, date, validUntil, amount || 0, status || 'draft', id])
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    if (conn) await conn.end()
  }
}
