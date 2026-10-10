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
  // Non-staff (empleado/worker/user): only the projects they are assigned to, nothing financial.
  if (!__auth.staff) {
    try {
      const { q } = await import("@/lib/db")
      const rows = await q(
        "SELECT p.id, p.project_key, p.name, p.status, p.start_date, p.end_date, p.location FROM projects p JOIN project_workers pw ON (pw.project_id = p.id OR pw.project_id = p.project_key) WHERE pw.user_id = ?",
        [String(__auth.id)]
      )
      const projects = rows.map((r: any) => ({ id: String(r.id), projectKey: r.project_key || String(r.id), name: r.name || '', client: '', type: '', status: r.status || 'PLANNED', progress: 0, value: 0, startDate: r.start_date || '', endDate: r.end_date || '', location: r.location || '', assignee: '' }))
      return NextResponse.json({ notifications: [], leads: [], contacts: [], tasks: [], projects, projectAccounting: [], deals: [], products: [], activities: [] })
    } catch (e) {
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }
  }
  let conn
  try {
    conn = await getConnection()

    const [notificationsRows] = await conn.query("SELECT * FROM notifications")
    const [leadsRows] = await conn.query("SELECT * FROM leads")
    const [contactsRows] = await conn.query("SELECT * FROM contacts")
    const [activitiesRows] = await conn.query("SELECT * FROM activities")
    const [tasksRows] = await conn.query("SELECT * FROM tasks")
    const [paRows] = await conn.query("SELECT * FROM project_accounting")
    const [projectsRows] = await conn.query("SELECT * FROM projects")
    const [dealsRows] = await conn.query("SELECT * FROM deals")
    const [productsRows] = await conn.query("SELECT * FROM products")

    // Parse project_accounting.accounting JSON if needed
    const projectAccounting = ((paRows as any[]) || []).map((r: any) => {
      try {
        return { projectId: r.projectId, ...((typeof r.accounting === 'string') ? JSON.parse(r.accounting) : r.accounting) }
      } catch (e) {
        return { projectId: r.projectId, accounting: r.accounting }
      }
    })

    const formatDateLocal = (d: any) => {
      try {
        if (!d && d !== 0) return ''
        if (typeof d === 'string') return d.slice(0,10)
        if (d instanceof Date) {
          const y = d.getFullYear()
          const mo = String(d.getMonth() + 1).padStart(2, '0')
          const da = String(d.getDate()).padStart(2, '0')
          return `${y}-${mo}-${da}`
        }
        if (d && typeof d.toISOString === 'function') {
          const dt = new Date(d.toISOString())
          const y = dt.getFullYear()
          const mo = String(dt.getMonth() + 1).padStart(2, '0')
          const da = String(dt.getDate()).padStart(2, '0')
          return `${y}-${mo}-${da}`
        }
        return String(d).slice(0,10)
      } catch (e) { return '' }
    }

    const projects = ((projectsRows as any[]) || []).map((r: any) => ({
      id: String(r.id),
      projectKey: r.project_key || String(r.id),
      name: r.name || '',
      client: r.client || '',
      type: r.type || '',
      status: (r.status || 'PLANNED'),
      progress: typeof r.progress === 'number' ? r.progress : 0,
      value: typeof r.value === 'number' ? r.value : Number(r.value || 0),
      startDate: r.start_date ? formatDateLocal(r.start_date) : '',
      endDate: r.end_date ? formatDateLocal(r.end_date) : '',
      location: r.location || '',
      assignee: r.assignee || r.assigned_to || '',
    }))

      const deals = ((dealsRows as any[]) || []).map((r: any) => ({
      id: String(r.id),
      title: r.title,
      client: r.client,
      value: typeof r.value === 'number' ? r.value : Number(r.value || 0),
      stage: (r.stage || '').toLowerCase(),
      probability: r.probability || 0,
      closeDate: r.close_date ? formatDateLocal(r.close_date) : '',
      assignedTo: r.assigned_to != null ? String(r.assigned_to) : null,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
      description: r.description || '',
    }))

    const products = ((productsRows as any[]) || []).map((r: any) => ({
      id: String(r.id),
      name: r.name || '',
      category: r.category || '',
      price: typeof r.price === 'number' ? r.price : Number(r.price || 0),
      unit: r.unit || '',
      stock: typeof r.stock === 'number' ? r.stock : Number(r.stock || 0),
      description: r.description || '',
    }))

    const activities = ((activitiesRows as any[]) || []).map((r: any) => ({
      id: String(r.id),
      type: r.type || 'task',
      title: r.title || '',
      client: r.client || '',
      // keep date as ISO-ish string (DB may store datetime)
      date: r.date ? (typeof r.date === 'string' ? r.date : new Date(r.date).toISOString()) : (r.created_at ? new Date(r.created_at).toISOString() : ''),
      duration: r.duration != null ? String(r.duration) : '',
      status: r.status || null,
      assignedTo: r.assigned_to != null ? String(r.assigned_to) : null,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
      starred: false,
      description: r.description || ''
    }))

    return NextResponse.json({
      notifications: notificationsRows,
      leads: leadsRows,
      contacts: contactsRows,
      tasks: tasksRows,
      projects,
      projectAccounting,
      deals,
      products,
      activities,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    if (conn) await conn.end()
  }
}
