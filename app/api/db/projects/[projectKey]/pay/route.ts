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

export async function POST(request: Request, context: any) {
  const __auth = await guard(request); if (isResponse(__auth)) return __auth
  let conn
  try {
    const params = await (context?.params ?? {})
    const projectKey = params?.projectKey
    const body = await request.json().catch(() => ({}))
    console.log('[projects pay] projectKey=', projectKey, 'body=', body)
    const userId = body.userId || body.id
    const amount = Number(body.amount || 0)
    if (!projectKey || !userId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })
    conn = await getConnection()

    // update accounting JSON
    try {
      const [acctRows] = await conn.query('SELECT accounting FROM project_accounting WHERE projectId = ?', [projectKey])
      // @ts-ignore
      if (acctRows && (acctRows as any).length > 0) {
        // @ts-ignore
        const acct = typeof (acctRows as any)[0].accounting === 'string' ? JSON.parse((acctRows as any)[0].accounting) : (acctRows as any)[0].accounting
        acct.workers = acct.workers || []
        const uid = String(userId)
        acct.workers = acct.workers.map((w: any) => (String(w.id) === uid ? { ...w, status: 'PAID', paidAt: new Date().toISOString(), totalPayment: (w.totalPayment || 0) + amount } : w))
        acct.logs = acct.logs || []
        acct.logs.push({ id: `log-${Date.now()}`, time: new Date().toISOString(), action: 'pay-worker', details: { userId: uid, amount } })
        await conn.query('REPLACE INTO project_accounting (projectId, accounting) VALUES (?, ?)', [projectKey, JSON.stringify(acct)])
      }
    } catch (e) {
      console.error('[projects pay] update accounting failed', String(e))
      return NextResponse.json({ error: String(e) }, { status: 500 })
    }

    // best-effort: update project_workers and close project if all paid
    try {
      const [projRows] = await conn.query('SELECT id FROM projects WHERE project_key = ? OR id = ? LIMIT 1', [projectKey, projectKey])
      // @ts-ignore
      if (projRows && (projRows as any).length > 0) {
        // @ts-ignore
        const projectId = (projRows as any)[0].id
        try {
          await conn.query('UPDATE project_workers SET status = ?, paid_at = NOW() WHERE project_id = ? AND user_id = ?', ['PAID', projectId, userId])
        } catch (e) {
          console.warn('[projects pay] update project_workers failed', String(e))
        }
      }
    } catch (e) {
      console.warn('[projects pay] project lookup failed', String(e))
    }

    // Check if all paid -> close project (best-effort)
    try {
      const [acctCheckRows] = await conn.query('SELECT accounting FROM project_accounting WHERE projectId = ?', [projectKey])
      // @ts-ignore
      if (acctCheckRows && (acctCheckRows as any).length > 0) {
        // @ts-ignore
        const acct = typeof (acctCheckRows as any)[0].accounting === 'string' ? JSON.parse((acctCheckRows as any)[0].accounting) : (acctCheckRows as any)[0].accounting
        const allPaid = (acct.workers || []).every((w: any) => w.status === 'PAID')
        if (allPaid) {
          try {
            await conn.query('UPDATE projects SET status = ? WHERE project_key = ? OR id = ?', ['CLOSED', projectKey, projectKey])
          } catch (e) {
            console.warn('[projects pay] update project status failed', String(e))
          }
        }
      }
    } catch (e) {
      console.error('[projects pay] check close failed', String(e))
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[projects pay] error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    if (conn) await conn.end()
  }
}
