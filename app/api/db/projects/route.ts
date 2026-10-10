import { NextResponse } from "next/server"
import { guard, isResponse } from "@/lib/api-guard"
import crypto from 'crypto'
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
    console.error('[projects POST]', body)
    // generate projectKey server-side when not provided
    const providedKey = (body && body.projectKey) ? String(body.projectKey).trim() : ''
    const projectKey = providedKey || (crypto && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `p-${Date.now()}`)
    const { name, startDate, expectedDurationDays, budget } = body || {}
    if (!name) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    conn = await getConnection()
    // Check if projects table and project_key column exist
    const dbName = dbConfig.database
    const [cols] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'projects'", [dbName])
    // @ts-ignore
    const colNames = (cols || []).map ? (cols as any).map((r: any) => String(r.COLUMN_NAME).toLowerCase()) : []
    if (!colNames || colNames.length === 0) {
      // table missing — create a minimal projects table with expected columns
      try {
        await conn.query(`CREATE TABLE IF NOT EXISTS projects (
          id INT AUTO_INCREMENT PRIMARY KEY,
          project_key VARCHAR(255) UNIQUE,
          name VARCHAR(255),
          start_date DATE,
          expected_duration_days INT,
          budget DECIMAL(15,2),
          status VARCHAR(50) DEFAULT 'PLANNED',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          end_date DATE
        )`)
        // refresh columns
        const [cols2] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'projects'", [dbName])
        // @ts-ignore
        colNames.splice(0, colNames.length, ...(cols2 as any).map((r: any) => String(r.COLUMN_NAME).toLowerCase()))
      } catch (e) {
        console.error('[projects POST] failed to create projects table', String(e))
      }
    }

    // Build dynamic INSERT using only existing columns to avoid errors when schema differs
    const insertCols: string[] = []
    const insertVals: any[] = []
    const placeholders: string[] = []

    // helper to push col/value
    const pushCol = (col: string, val: any) => { insertCols.push(col); insertVals.push(val); placeholders.push('?') }

    // If the schema lacks a project_key column but we have a projectKey, attempt to add it so
    // other routes that rely on project_key continue to work.
    if (!colNames.includes('project_key') && projectKey) {
      try {
        await conn.query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_key VARCHAR(255) NULL UNIQUE")
        // refresh columns list
        const [cols3] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'projects'", [dbName])
        // @ts-ignore
        colNames.splice(0, colNames.length, ...(cols3 as any).map((r: any) => String(r.COLUMN_NAME).toLowerCase()))
      } catch (e) {
        console.error('[projects POST] failed to add project_key column', String(e))
      }
    }
    // project_key if present (after possible ALTER)
    if (colNames.includes('project_key')) pushCol('project_key', projectKey)
    // always include name if present
    if (colNames.includes('name')) pushCol('name', name)
    if (colNames.includes('start_date')) pushCol('start_date', startDate || null)
    if (colNames.includes('expected_duration_days')) pushCol('expected_duration_days', expectedDurationDays || null)
    // many schemas store numeric project amount in `value` or `amount` instead of `budget`
    const incomingAmount = (typeof budget !== 'undefined' && budget !== null) ? budget : ((body as any).value ?? (body as any).amount ?? null)
    const numericAmount = incomingAmount !== null && incomingAmount !== undefined ? Number(incomingAmount) : null
    if (colNames.includes('budget')) pushCol('budget', numericAmount)
    else if (colNames.includes('value')) pushCol('value', numericAmount)
    else if (colNames.includes('amount')) pushCol('amount', numericAmount)
    // client / location mapping
    if (colNames.includes('client') && (body as any).client) pushCol('client', (body as any).client)
    if (colNames.includes('location') && (body as any).location) pushCol('location', (body as any).location)
    // optional: type/assignee mapping (some schemas may use different column names)
    if (colNames.includes('type') && (body as any).type) pushCol('type', (body as any).type)
    if (colNames.includes('assignee') && (body as any).assignee) pushCol('assignee', (body as any).assignee)
    if (colNames.includes('assigned_to') && (body as any).assignee) pushCol('assigned_to', (body as any).assignee)

    let insertId: number | null = null
    if (insertCols.length === 0) {
      throw new Error('No writable columns found in projects table')
    }
    const sql = `INSERT INTO projects (${insertCols.join(',')}) VALUES (${placeholders.join(',')})`
    const [ins] = await conn.query(sql, insertVals)
    // @ts-ignore
    insertId = (ins && (ins as any).insertId) ? (ins as any).insertId : null
    // Initialize empty accounting if possible
    try {
      const accounting = { projectId: projectKey, totalPrice: 0, labor: 0, materials: 0, insurance: 0, profit: 0, workers: [], logs: [] }
      await conn.query('REPLACE INTO project_accounting (projectId, accounting) VALUES (?, ?)', [projectKey, JSON.stringify(accounting)])
    } catch (e) {
      console.error('[projects POST] project_accounting init failed', String(e))
    }
    const [rows] = await conn.query('SELECT * FROM projects WHERE id = ?', [insertId])
    // @ts-ignore
    return NextResponse.json((rows && (rows as any)[0]) || null, { status: 201 })
  } catch (err) {
    console.error('[projects POST] error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    if (conn) await conn.end()
  }
}

export async function GET(request: Request) {
  const __auth = await guard(request); if (isResponse(__auth)) return __auth
  let conn
  try {
    conn = await getConnection()
    const [rows] = await conn.query('SELECT * FROM projects ORDER BY id DESC')
    return NextResponse.json(rows || [])
  } catch (err) {
    console.error('[projects GET] error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    if (conn) await conn.end()
  }
}
