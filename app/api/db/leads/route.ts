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

export async function GET(request: Request) {
  const __auth = await guard(request); if (isResponse(__auth)) return __auth
  let conn
  try {
    conn = await getConnection()
    const [rows] = await conn.query(`SELECT id, name, company, email, phone, status, source, value, assignedTo, createdAt FROM leads ORDER BY createdAt DESC`)
    return NextResponse.json({ ok: true, leads: rows })
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
    const body = await request.json()
    conn = await getConnection()
    const { name, company, email, phone, status, source, value, assignedTo } = body
    const createdAt = body.createdAt || new Date().toISOString()
    const [result] = await conn.query(
      'INSERT INTO leads (name, company, email, phone, status, source, value, assignedTo, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, company, email, phone, status || 'new', source || 'Website', value || 0, assignedTo || null, createdAt]
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

export async function PUT(request: Request) {
  const __auth = await guard(request); if (isResponse(__auth)) return __auth
  let conn
  try {
    const body = await request.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    const allowed = ['name','company','email','phone','status','source','value','assignedTo']
    const sets: string[] = []
    const params: any[] = []
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        sets.push(`${key} = ?`)
        params.push((updates as any)[key])
      }
    }
    if (sets.length === 0) return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    params.push(id)
    conn = await getConnection()
    const sql = `UPDATE leads SET ${sets.join(', ')} WHERE id = ?`
    await conn.query(sql, params)

    // record audit: ensure table exists and insert an audit row
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS leads_audit (
          id INT PRIMARY KEY AUTO_INCREMENT,
          lead_id VARCHAR(50),
          edited_by VARCHAR(255),
          edited_at DATETIME,
          changes JSON
        )
      `)
    } catch (e) {
      // ignore create table errors
    }

    const editedBy = (body as any).editedBy || null
    const editedAt = new Date().toISOString().slice(0, 19).replace('T', ' ')
    const changes = JSON.stringify(updates)
    const [auditRes] = await conn.query('INSERT INTO leads_audit (lead_id, edited_by, edited_at, changes) VALUES (?, ?, ?, ?)', [id, editedBy, editedAt, changes])
    // return the inserted audit info
    // @ts-ignore
    const insertId = (auditRes && (auditRes as any).insertId) ? (auditRes as any).insertId : null
    const auditRecord = { id: insertId, lead_id: id, edited_by: editedBy, edited_at: editedAt, changes: updates }
    return NextResponse.json({ ok: true, audit: auditRecord })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    if (conn) await conn.end()
  }
}

export async function DELETE(request: Request) {
  const __auth = await guard(request); if (isResponse(__auth)) return __auth
  let conn
  try {
    const url = new URL(request.url)
    let id: any = url.searchParams.get('id')
    if (!id) {
      const body = await request.json().catch(() => null)
      id = body?.id
    }
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    conn = await getConnection()
    await conn.query('DELETE FROM leads WHERE id = ?', [id])
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    if (conn) await conn.end()
  }
}
