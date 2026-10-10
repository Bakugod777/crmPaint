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
    console.error('deleteDeal id:', id)
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    conn = await getConnection()
    const [res] = await conn.query('DELETE FROM deals WHERE id = ?', [id])
    // @ts-ignore
    const affected = res && (res as any).affectedRows ? (res as any).affectedRows : 0
    console.error('deleteDeal result:', res)
    return NextResponse.json({ ok: true, affected })
  } catch (err) {
    console.error('deleteDeal error:', err)
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
    console.error('createDeal body:', body)
    conn = await getConnection()
    const { title, client, value, stage, probability, closeDate, assignedTo } = body
    const [result] = await conn.query(
      'INSERT INTO deals (title, client, value, stage, probability, close_date, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title, client, value || 0, stage || 'lead', probability || 0, closeDate || null, assignedTo || null]
    )
    // @ts-ignore
    const insertId = (result && (result as any).insertId) ? (result as any).insertId : null
    return NextResponse.json({ ok: true, id: insertId })
  } catch (err) {
    console.error('createDeal error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    if (conn) await conn.end()
  }
}
