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

export async function PUT(request: Request, context: any) {
  const __auth = await guard(request); if (isResponse(__auth)) return __auth
  let conn
  try {
    const params = await (context?.params ?? {})
    const projectKey = params?.projectKey
    const body = await request.json().catch(() => ({}))
    console.log('[projects][PUT] projectKey=', projectKey, 'body=', JSON.stringify(body))
    if (!projectKey) return NextResponse.json({ error: 'Missing projectKey' }, { status: 400 })

    conn = await getConnection()
    const dbName = dbConfig.database
    const [cols] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'projects'", [dbName])
    // @ts-ignore
    const colNames = (cols || []).map ? (cols as any).map((r: any) => String(r.COLUMN_NAME).toLowerCase()) : []
    console.log('[projects][PUT] table columns=', colNames)

    // Build dynamic update sets
    const sets: string[] = []
    const vals: any[] = []
    const push = (col: string, val: any) => { sets.push(`${col} = ?`); vals.push(val) }

    if (colNames.includes('name') && typeof (body as any).name !== 'undefined') push('name', (body as any).name)
    if (colNames.includes('client') && typeof (body as any).client !== 'undefined') push('client', (body as any).client)
    if (colNames.includes('type') && typeof (body as any).type !== 'undefined') push('type', (body as any).type)
    if (colNames.includes('assignee') && typeof (body as any).assignee !== 'undefined') push('assignee', (body as any).assignee)
    if (colNames.includes('assigned_to') && typeof (body as any).assignee !== 'undefined') push('assigned_to', (body as any).assignee)
    if (colNames.includes('start_date') && typeof (body as any).startDate !== 'undefined') push('start_date', (body as any).startDate || null)
    if (colNames.includes('end_date') && typeof (body as any).endDate !== 'undefined') push('end_date', (body as any).endDate || null)
    if (colNames.includes('status') && typeof (body as any).status !== 'undefined') push('status', (body as any).status)
    if (colNames.includes('location') && typeof (body as any).location !== 'undefined') push('location', (body as any).location)

    const incomingAmount = (typeof (body as any).budget !== 'undefined' && (body as any).budget !== null) ? (body as any).budget : ((body as any).value ?? (body as any).amount ?? null)
    const numericAmount = incomingAmount !== null && incomingAmount !== undefined ? Number(incomingAmount) : null
    if (numericAmount !== null) {
      if (colNames.includes('budget')) push('budget', numericAmount)
      else if (colNames.includes('value')) push('value', numericAmount)
      else if (colNames.includes('amount')) push('amount', numericAmount)
    }

    if (sets.length === 0) {
      console.log('[projects][PUT] no updatable columns found')
      return NextResponse.json({ error: 'No updatable columns found' }, { status: 400 })
    }

    // Choose where clause depending on whether project_key exists in schema
    let where = 'project_key = ?'
    let whereVal: any = projectKey
    if (!colNames.includes('project_key')) {
      if (/^\d+$/.test(String(projectKey))) {
        where = 'id = ?'
        whereVal = Number(projectKey)
      } else {
        // fallback to try numeric conversion
        where = 'id = ?'
        whereVal = Number(projectKey) || projectKey
      }
    }

    const sql = `UPDATE projects SET ${sets.join(', ')} WHERE ${where}`
    console.log('[projects][PUT] sql=', sql, 'vals=', [...vals, whereVal])
    // execute update and check affectedRows; if zero and we received a numeric id, retry by id
    // @ts-ignore
    const [res] = await conn.query(sql, [...vals, whereVal])
    try {
      // affectedRows is available on result objects for UPDATE
      // @ts-ignore
      const affected = (res && typeof (res as any).affectedRows === 'number') ? (res as any).affectedRows : null
      if ((affected === 0 || affected === null) && /^\d+$/.test(String(projectKey))) {
        // retry updating by id
        const sql2 = `UPDATE projects SET ${sets.join(', ')} WHERE id = ?`
        console.log('[projects][PUT] retrying update by id, sql=', sql2, 'vals=', [...vals, Number(projectKey)])
        // @ts-ignore
        await conn.query(sql2, [...vals, Number(projectKey)])
      }
    } catch (e) {
      console.warn('[projects][PUT] update fallback failed', String(e))
    }

    // Return updated record
    const [rows] = await conn.query('SELECT * FROM projects WHERE project_key = ? OR id = ? LIMIT 1', [projectKey, projectKey])
    // @ts-ignore
    if (!rows || (rows as any).length === 0) {
      console.log('[projects][PUT] update executed but project not found after update')
      return NextResponse.json({ error: 'Project not found after update' }, { status: 404 })
    }
    // @ts-ignore
    console.log('[projects][PUT] updated project=', (rows as any)[0])
    // @ts-ignore
    return NextResponse.json((rows as any)[0])
  } catch (err) {
    console.error('[projects PUT] error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    if (conn) await conn.end()
  }
}

export async function GET(_request: Request, context: any) {
  const __auth = await guard(_request); if (isResponse(__auth)) return __auth
  let conn
  try {
    const params = await (context?.params ?? {})
    const projectKey = params?.projectKey
    console.log('[projects][GET] projectKey=', projectKey)
    if (!projectKey) return NextResponse.json({ error: 'Missing projectKey' }, { status: 400 })
    conn = await getConnection()
    const [rows] = await conn.query('SELECT * FROM projects WHERE project_key = ? OR id = ? LIMIT 1', [projectKey, projectKey])
    // @ts-ignore
    if (!rows || (rows as any).length === 0) {
      console.log('[projects][GET] not found for', projectKey)
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    // @ts-ignore
    console.log('[projects][GET] found=', (rows as any)[0])
    // @ts-ignore
    return NextResponse.json((rows as any)[0])
  } catch (err) {
    console.error('[projects GET by key] error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    if (conn) await conn.end()
  }
}
