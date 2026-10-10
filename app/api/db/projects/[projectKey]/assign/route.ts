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
    console.log('[projects assign] projectKey=', projectKey, 'body=', body)
    const userId = body.userId || body.id
    const role = body.role || 'worker'
    const salaryRate = body.salaryRate !== undefined ? Number(body.salaryRate) : undefined
    const salaryType = body.salaryType || null
    if (!projectKey || !userId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })
    conn = await getConnection()

    // ensure project exists
    const [projRows] = await conn.query('SELECT id FROM projects WHERE project_key = ? OR id = ? LIMIT 1', [projectKey, projectKey])
    // @ts-ignore
    if (!projRows || (projRows as any).length === 0) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    // @ts-ignore
    const projectId = (projRows as any)[0].id

    // persist into project_workers if table exists (best-effort)
    try {
      // Some installations use numeric user_id, others use string ids (e.g. 'w1').
      // Only attempt the numeric INSERT when userId is numeric to avoid SQL errors on INT columns.
      const uidStr = String(userId)
      const isNumericId = /^\d+$/.test(uidStr)
      if (isNumericId) {
        await conn.query('INSERT INTO project_workers (project_id, user_id, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role)', [projectId, Number(uidStr), role || 'worker'])
        if (salaryRate !== undefined || salaryType !== null) {
          try {
            await conn.query('UPDATE project_workers SET salary_rate = ?, salary_type = ? WHERE project_id = ? AND user_id = ?', [salaryRate || 0, salaryType, projectId, Number(uidStr)])
          } catch (e) {
            // column may not exist, ignore
          }
        }
      } else {
        // userId is non-numeric (e.g. 'w1') — skip INSERT into INT column and rely on project_accounting JSON.
        console.log('[projects assign] skipping project_workers insert for non-numeric userId', uidStr)
      }
    } catch (e) {
      console.warn('[projects assign] project_workers insert skipped or failed', String(e))
    }

    // also update the projects table assignee/assigned_to and optionally status to reflect current assignment (best-effort)
    try {
      if (typeof (body as any).status !== 'undefined') {
        await conn.query('UPDATE projects SET assignee = ?, assigned_to = ?, status = ? WHERE id = ?', [userId, userId, (body as any).status, projectId])
      } else {
        await conn.query('UPDATE projects SET assignee = ?, assigned_to = ? WHERE id = ?', [userId, userId, projectId])
      }
    } catch (e) {
      // ignore if columns don't exist or update failed
      console.warn('[projects assign] update projects.assignee/status skipped or failed', String(e))
    }

    // update accounting JSON if present
    try {
      const [acctRows] = await conn.query('SELECT accounting FROM project_accounting WHERE projectId = ?', [projectKey])
      // fetch project dates to compute duration for salary calculations
      let projectDays = 30
      try {
        const [projInfo] = await conn.query('SELECT start_date, end_date, expected_duration_days FROM projects WHERE id = ? LIMIT 1', [projectId])
        if (projInfo && (projInfo as any).length > 0) {
          const row = (projInfo as any)[0]
          const s = row.start_date ? new Date(row.start_date) : null
          const e = row.end_date ? new Date(row.end_date) : null
          if (s && e && !isNaN(s.getTime()) && !isNaN(e.getTime())) {
            const diffMs = Math.max(0, e.getTime() - s.getTime())
            const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1
            projectDays = Math.max(1, days)
          } else if (row.expected_duration_days && Number.isFinite(Number(row.expected_duration_days))) {
            projectDays = Number(row.expected_duration_days)
          }
        }
      } catch (e) {
        // ignore and fallback to default days
      }
      // @ts-ignore
      if (acctRows && (acctRows as any).length > 0) {
        // @ts-ignore
        const acct = typeof (acctRows as any)[0].accounting === 'string' ? JSON.parse((acctRows as any)[0].accounting) : (acctRows as any)[0].accounting
        acct.workers = acct.workers || []
        const uid = String(userId)
        // compute estimated totalPayment from salaryRate & salaryType when absent
        const computePayment = (rate: any, type: any) => {
          const st = (type || '').toString().toLowerCase()
          if (typeof rate === 'number' && rate > 0) {
            if (st === 'monthly' || st === 'fixed') return rate
            if (st === 'weekly') return rate * Math.max(1, Math.ceil(projectDays / 7))
            if (st === 'daily') return rate * projectDays
          }
          return 0
        }

        if (!acct.workers.some((w: any) => String(w.id) === uid)) {
          acct.workers.push({ id: uid, name: '', days: [], totalPayment: computePayment(salaryRate || 0, salaryType), status: 'WORKING', salaryRate: salaryRate || 0, salaryType: salaryType || null, role })
        } else {
          acct.workers = acct.workers.map((w: any) => (String(w.id) === uid ? { ...w, status: 'WORKING', role, salaryRate: salaryRate !== undefined ? salaryRate : w.salaryRate, salaryType: salaryType || w.salaryType, totalPayment: computePayment(salaryRate !== undefined ? salaryRate : w.salaryRate, salaryType || w.salaryType) } : w))
        }
        acct.logs = acct.logs || []
        acct.logs.push({ id: `log-${Date.now()}`, time: new Date().toISOString(), action: 'assign-worker', details: { userId: uid, role } })
        await conn.query('REPLACE INTO project_accounting (projectId, accounting) VALUES (?, ?)', [projectKey, JSON.stringify(acct)])
      } else {
        const acct = { projectId: projectKey, totalPrice: 0, labor: 0, materials: 0, insurance: 0, profit: 0, workers: [{ id: String(userId), name: '', days: [], totalPayment: 0, status: 'WORKING', salaryRate: salaryRate || 0, salaryType: salaryType || null, role }], logs: [{ id: `log-${Date.now()}`, time: new Date().toISOString(), action: 'assign-worker' }] }
        await conn.query('REPLACE INTO project_accounting (projectId, accounting) VALUES (?, ?)', [projectKey, JSON.stringify(acct)])
      }
    } catch (e) {
      console.error('[projects assign] update accounting failed', String(e))
    }

    // Notify all project members (best-effort). Collect numeric user_ids from project_workers
    try {
      const memberIds = new Set<string>()
      try {
        const [pwRows] = await conn.query('SELECT user_id FROM project_workers WHERE project_id = ?', [projectId])
        if (pwRows && (pwRows as any).length) {
          for (const r of (pwRows as any)) {
            if (r.user_id != null) memberIds.add(String(r.user_id))
          }
        }
      } catch (e) {
        // table may not exist — ignore
      }

      // also collect from project_accounting JSON
      try {
        const [acctRows2] = await conn.query('SELECT accounting FROM project_accounting WHERE projectId = ?', [projectKey])
        if (acctRows2 && (acctRows2 as any).length) {
          const acct = typeof (acctRows2 as any)[0].accounting === 'string' ? JSON.parse((acctRows2 as any)[0].accounting) : (acctRows2 as any)[0].accounting
          if (acct && Array.isArray(acct.workers)) {
            for (const w of acct.workers) {
              if (w && w.id != null) memberIds.add(String(w.id))
            }
          }
        }
      } catch (e) {
        // ignore
      }

      // Insert notifications for each member (best-effort). Try inserting with user_id column first, fall back if fails.
      const title = `Assigned to project ${projectKey}`
      const description = `A user (${String(userId)}) was assigned to project ${projectKey}`
      const time = new Date().toISOString()
      for (const mid of Array.from(memberIds)) {
        try {
          // try with user_id column
          await conn.query('INSERT INTO notifications (title, description, time, unread, type, user_id) VALUES (?, ?, ?, ?, ?, ?)', [title, description, time, 1, 'project', mid])
        } catch (e) {
          try {
            // fallback: insert without user_id
            await conn.query('INSERT INTO notifications (title, description, time, unread, type) VALUES (?, ?, ?, ?, ?)', [title, description, time, 1, 'project'])
          } catch (e2) {
            // ignore failures to avoid breaking assignment
            console.warn('[projects assign] failed to insert notification', String(e2))
          }
        }
      }
    } catch (e) {
      console.warn('[projects assign] notify members failed', String(e))
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[projects assign] error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    if (conn) await conn.end()
  }
}
