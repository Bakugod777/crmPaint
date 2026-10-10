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

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const __auth = await guard(_request); if (isResponse(__auth)) return __auth
  let conn
  try {
    // Next 16: params is a Promise and must be awaited
    const { projectId } = await context.params
    if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
    conn = await getConnection()
    const [rows] = await conn.query('SELECT accounting FROM project_accounting WHERE projectId = ?', [projectId])
    // @ts-ignore
    if (!rows || (rows as any).length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    // @ts-ignore
    const acct = (rows as any)[0].accounting
    return NextResponse.json(typeof acct === 'string' ? JSON.parse(acct) : acct)
  } catch (err) {
    console.error('[project_accounting GET] error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    if (conn) await conn.end()
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const __auth = await guard(_request); if (isResponse(__auth)) return __auth
  let conn
  try {
    const { projectId } = await context.params
    if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
    conn = await getConnection()
    await conn.query('DELETE FROM project_accounting WHERE projectId = ?', [projectId])
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[project_accounting DELETE] error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    if (conn) await conn.end()
  }
}
