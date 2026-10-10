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
    const startDate = body.startDate || new Date().toISOString().slice(0, 10)
    console.log('[projects start] projectKey=', projectKey, 'startDate=', startDate)
    if (!projectKey) return NextResponse.json({ error: 'Missing projectKey' }, { status: 400 })
    conn = await getConnection()
    try {
      await conn.query('UPDATE projects SET status = ?, start_date = ? WHERE project_key = ? OR id = ?', ['IN_PROGRESS', startDate, projectKey, projectKey])
    } catch (e) {
      console.warn('[projects start] update project failed', String(e))
    }

    try {
      const [acctRows] = await conn.query('SELECT accounting FROM project_accounting WHERE projectId = ?', [projectKey])
      // @ts-ignore
      if (acctRows && (acctRows as any).length > 0) {
        // @ts-ignore
        const acct = typeof (acctRows as any)[0].accounting === 'string' ? JSON.parse((acctRows as any)[0].accounting) : (acctRows as any)[0].accounting
        acct.workers = (acct.workers || []).map((w: any) => ({ ...w, status: 'WORKING' }))
        acct.logs = acct.logs || []
        acct.logs.push({ id: `log-${Date.now()}`, time: new Date().toISOString(), action: 'project-start' })
        await conn.query('REPLACE INTO project_accounting (projectId, accounting) VALUES (?, ?)', [projectKey, JSON.stringify(acct)])
      }
    } catch (e) {
      console.error('[projects start] update accounting failed', String(e))
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[projects start] error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    if (conn) await conn.end()
  }
}
