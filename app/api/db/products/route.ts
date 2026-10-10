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
    const body: any = await request.json()
    conn = await getConnection()
    const sql = `INSERT INTO products (name, category, price, unit, stock, description) VALUES (?, ?, ?, ?, ?, ?)`
    const params = [body.name || '', body.category || '', body.price != null ? Number(body.price) : 0, body.unit || '', body.stock != null ? Number(body.stock) : 0, body.description || '']
    const [result] = await conn.query(sql, params)
    // @ts-ignore
    const insertId = (result && (result as any).insertId) ? (result as any).insertId : null
    return NextResponse.json({ ok: true, id: insertId })
  } catch (err) {
    console.error('createProduct error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    if (conn) await conn.end()
  }
}

export async function PUT(request: Request) {
  const __auth = await guard(request); if (isResponse(__auth)) return __auth
  let conn
  try {
    const body: any = await request.json()
    const { id } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    const allowed = ['name','category','price','unit','stock','description']
    const sets: string[] = []
    const values: any[] = []
    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, k)) {
        sets.push(`${k} = ?`)
        values.push(body[k])
      }
    }
    if (sets.length === 0) return NextResponse.json({ ok: true })
    conn = await getConnection()
    const sql = `UPDATE products SET ${sets.join(', ')} WHERE id = ?`
    values.push(id)
    await conn.query(sql, values)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('updateProduct error:', err)
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
    const id = url.searchParams.get('id')
    console.error('deleteProduct id:', id)
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    conn = await getConnection()
    const [res] = await conn.query('DELETE FROM products WHERE id = ?', [id])
    // @ts-ignore
    const affected = res && (res as any).affectedRows ? (res as any).affectedRows : 0
    console.error('deleteProduct result:', res)
    return NextResponse.json({ ok: true, affected })
  } catch (err) {
    console.error('deleteProduct error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    if (conn) await conn.end()
  }
}

export async function GET(request: Request) {
  const __auth = await guard(request); if (isResponse(__auth)) return __auth
  try {
    const { q } = await import("@/lib/db")
    const rows = await q("SELECT id, name, category, price, unit, stock, description FROM products ORDER BY category, name")
    return NextResponse.json({ ok: true, rows })
  } catch (err) {
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }
}
