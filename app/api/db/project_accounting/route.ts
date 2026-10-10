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

export async function POST(request: Request) {
  const __auth = await guard(request); if (isResponse(__auth)) return __auth
  let conn
  try {
    const body = await request.json()
        if (!body || !body.projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
    conn = await getConnection()
    const json = JSON.stringify(body)
    await conn.query('REPLACE INTO project_accounting (projectId, accounting) VALUES (?, ?)', [body.projectId, json])
    // Money is also stored normalized as DECIMAL(14,2) columns (project_finance); JSON kept for legacy UI.
    try {
      const n = (v: any) => Math.round((Number(v) || 0) * 100) / 100
      await conn.query(
        `INSERT INTO project_finance (project_key, total_price, labor, materials, materials_charged, insurance, profit)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE total_price=VALUES(total_price), labor=VALUES(labor), materials=VALUES(materials),
           materials_charged=VALUES(materials_charged), insurance=VALUES(insurance), profit=VALUES(profit)`,
        [String(body.projectId), n(body.totalPrice), n(body.labor), n(body.materials), n(body.materialsCharged), n(body.insurance), n(body.profit)]
      )
    } catch (e) {
      console.error('[project_accounting POST] project_finance upsert failed (run sql/02_contabilidad.sql)', String(e))
    }
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    console.error('[project_accounting POST] error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    if (conn) await conn.end()
  }
}
