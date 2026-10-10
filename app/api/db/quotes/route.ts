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

export async function DELETE(request: Request) {
  const __auth = await guard(request); if (isResponse(__auth)) return __auth
  let conn
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    conn = await getConnection()
    const [res] = await conn.query('DELETE FROM quotes WHERE id = ?', [id])
    // @ts-ignore
    const affected = (res && (res as any).affectedRows) ? (res as any).affectedRows : 0
    // eslint-disable-next-line no-console
    console.log('[quotes DELETE] id=', id, 'affectedRows=', affected)
    return NextResponse.json({ ok: true, affectedRows: affected })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[quotes DELETE] error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    if (conn) await conn.end()
  }
}

export async function POST(request: Request) {
  const __auth = await guard(request); if (isResponse(__auth)) return __auth
  let conn
  try {
    const body = await request.json()
    // eslint-disable-next-line no-console
    console.log('[quotes POST] body=', body)
    conn = await getConnection()
    const { client, project, date, validUntil, amount, status } = body
    const [result] = await conn.query(
      'INSERT INTO quotes (client, project, date, valid_until, amount, status) VALUES (?, ?, ?, ?, ?, ?)',
      [client, project, date, validUntil, amount || 0, status || 'draft']
    )
    // @ts-ignore
    const insertId = (result && (result as any).insertId) ? (result as any).insertId : null
    // eslint-disable-next-line no-console
    console.log('[quotes POST] inserted id=', insertId)
    return NextResponse.json({ ok: true, id: insertId })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[quotes POST] error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    if (conn) await conn.end()
  }
}
