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
    const [rows] = await conn.query(`SELECT id, name, email, phone, company, position, status, lastContact FROM contacts ORDER BY name ASC`)
    return NextResponse.json({ ok: true, contacts: rows })
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
    const { id, name, email, phone, company, position, status, lastContact } = body
    const [result] = await conn.query(
      'INSERT INTO contacts (id, name, email, phone, company, position, status, lastContact) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id || null, name || null, email || null, phone || null, company || null, position || null, status || 'active', lastContact || null],
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
    const allowed = ['name', 'email', 'phone', 'company', 'position', 'status', 'lastContact']
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
    const sql = `UPDATE contacts SET ${sets.join(', ')} WHERE id = ?`
    await conn.query(sql, params)
    return NextResponse.json({ ok: true })
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
    console.log(`/app/api/db/contacts DELETE called id=${id}`)
    await conn.query('DELETE FROM contacts WHERE id = ?', [id])
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    if (conn) await conn.end()
  }
}
