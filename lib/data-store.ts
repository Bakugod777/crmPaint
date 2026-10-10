"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

// Resolve API base: prefer NEXT_PUBLIC_API_BASE, otherwise use current origin in browser.
// Historically this project routed API calls to :3001 during development when a
// separate backend was used. Most setups use Next's built-in API routes, so use
// the same origin by default to avoid 404s targeting the wrong port.
const getApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_BASE) return process.env.NEXT_PUBLIC_API_BASE
  if (typeof window !== 'undefined') {
    try {
      return window.location.origin
    } catch (e) {
      // fallback
    }
  }
  return 'http://localhost:3000'
}

// Notification types
export interface Notification {
  id: string
  title: string
  description: string
  time: string
  unread: boolean
  type: "lead" | "deal" | "project" | "payment" | "task"
}

// Lead types
export interface Lead {
  id: string
  name: string
  company: string
  email: string
  phone: string
  status: "new" | "contacted" | "qualified" | "lost"
  source: string
  value: number
  assignedTo: string
  createdAt: string
}

// Contact types
export interface Contact {
  id: string
  name: string
  email: string
  phone: string
  company: string
  position: string
  status: "active" | "inactive"
  avatar?: string
  lastContact: string
}

// Deal types
export interface Deal {
  id: string
  title: string
  client: string
  value: number
  stage: "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost"
  probability: number
  closeDate: string
  assignedTo: string
  description: string
}

// Product types
export interface Product {
  id: string
  name: string
  category: string
  price: number
  unit: string
  stock: number
  description: string
}

// Project types
export interface Project {
  id: string
  name: string
  client: string
  type: "Residential" | "Commercial"
  // Normalized project status values (system-level)
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CLOSED" | "ON_HOLD"
  progress: number
  value: number
  startDate: string
  endDate: string
  location: string
  assignee: string
  description?: string
}

// Accounting types for projects
export interface WorkerDay {
  id: string
  dayOfWeek: string
  hours: number
  payment: number
  // Whether this day has been confirmed/approved by an administrator
  confirmed?: boolean
}

export interface Worker {
  id: string
  name: string
  days: WorkerDay[]
  totalPayment: number
  // Workflow status for the worker within a project (normalized)
  // Allowed values: 'AVAILABLE', 'WORKING', 'PENDING_PAYMENT', 'PAID', 'RESIGNED', 'WAITING_FOR_ASSIGNMENT'
  // Additional internal status 'ON_COMPLAINT' is kept for complaint handling.
  status?:
    | "AVAILABLE"
    | "WORKING"
    | "PENDING_PAYMENT"
    | "PAID"
    | "RESIGNED"
    | "WAITING_FOR_ASSIGNMENT"
    | "ON_COMPLAINT"
  // Preserve previous status when moved into ON_COMPLAINT so we can restore it
  prevStatus?: string
  // Salary configuration: daily, hourly, weekly, monthly or fixed and the rate
  salaryType?: "daily" | "hourly" | "weekly" | "monthly" | "fixed"
  salaryRate?: number
  // Optional estimated days for daily-paid workers
  estimatedDays?: number
  // Date when this worker was paid (ISO string)
  paidAt?: string
}

export interface ProjectAccounting {
  projectId: string
  totalPrice: number
  labor: number
  materials: number
  // Amount charged to the client for materials (separate from materials cost)
  materialsCharged?: number
  // Computed materials profit = materialsCharged - materials (tracked separately)
  materialsProfit?: number
  insurance: number
  profit: number
  workers: Worker[]
  // Audit/change log for this project's accounting actions
  logs?: Array<{ id: string; time: string; actor?: string; action: string; details?: string }>
}

export interface Complaint {
  id: string
  type: "user" | "worker"
  category: string
  title: string
  description: string
  images: string[]
  mentionedUser?: string
  mentionedWorker?: string
  status: "pending" | "in-review" | "resolved" | "rejected"
  createdBy: string
  createdByRole: "user" | "worker" | "admin"
  createdAt: string
  adminResponse?: string
  respondedAt?: string
}

export interface SystemNotification extends Notification {
  actionType?: "request" | "response" | "approval" | "rejection"
  requestId?: string
  from?: string
  to?: string
  status?: "pending" | "approved" | "rejected"
  message?: string
}

export interface Case {
  id: string
  caseNumber: string
  client: string
  subject: string
  priority: "high" | "medium" | "low"
  status: "open" | "in-progress" | "resolved" | "closed"
  assignedTo: string
  createdDate: string
  lastUpdate: string
  description: string
  notes: string[]
}

export interface Activity {
  id: string
  type: "call" | "email" | "meeting" | "task"
  time?: string
  title: string
  client: string
  date: string
  duration: string
  status: "upcoming" | "scheduled" | "completed" | "cancelled"
  assignedTo: string
  description: string
  starred: boolean
}

export interface WorkflowRule {
  id: string
  name: string
  description: string
  trigger: string
  actions: string[]
  status: "active" | "inactive"
  runs: number
}

// TeamMember removed — use `users` from auth-store instead

export interface Task {
  id: string
  title: string
  assignee: string
  priority: "high" | "medium" | "low"
  status: "pending" | "in-progress" | "completed"
  dueDate: string
  client?: string
  date?: string
  project: string
  description: string
}

// Store interface
interface DataStore {
  navigation?: Array<{ name: string; href: string; icon: string; roles?: string[] }>

  notifications: Notification[]
  addNotification: (notification: Notification) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void

  leads: Lead[]
  addLead: (lead: Lead) => Promise<boolean>
  updateLead: (id: string, lead: Partial<Lead>) => Promise<any>
  deleteLead: (id: string) => Promise<boolean>

  contacts: Contact[]
  addContact: (contact: Contact) => Promise<boolean>
  updateContact: (id: string, contact: Partial<Contact>) => Promise<boolean>
  deleteContact: (id: string) => Promise<boolean>

  deals: Deal[]
  addDeal: (deal: Deal) => Promise<boolean>
  updateDeal: (id: string, deal: Partial<Deal>) => Promise<boolean>
  deleteDeal: (id: string) => Promise<boolean>

  products: Product[]
  addProduct: (product: Product) => void
  updateProduct: (id: string, product: Partial<Product>) => void
  deleteProduct: (id: string) => void

  projects: Project[]
  addProject: (project: Project) => void
  updateProject: (id: string, project: Partial<Project>) => Promise<Project | null>
  deleteProject: (id: string) => void

  projectAccounting: ProjectAccounting[]
  createProject: (p: { projectKey: string; name: string; startDate?: string; expectedDurationDays?: number; budget?: number }) => Promise<boolean>
  assignWorkerToProject: (projectKey: string, userId: string, salaryRate?: number, salaryType?: string) => Promise<boolean>
  startProject: (projectKey: string) => Promise<boolean>
  completeProject: (projectKey: string) => Promise<boolean>
  payWorkerOnProject: (projectKey: string, userId: string, amount?: number) => Promise<boolean>
  generatePayrollExport: (projectKey: string) => { csv: string; rows: any[] }
  getProjectAccounting: (projectId: string) => ProjectAccounting | undefined
  updateProjectAccounting: (accounting: ProjectAccounting) => void
  addWorker: (projectId: string, worker: Worker) => void
  updateWorker: (projectId: string, workerId: string, worker: Partial<Worker>) => void
  deleteWorker: (projectId: string, workerId: string) => void
  addWorkerDay: (projectId: string, workerId: string, day: WorkerDay) => void
  updateWorkerDay: (projectId: string, workerId: string, dayId: string, day: Partial<WorkerDay>) => void
  deleteWorkerDay: (projectId: string, workerId: string, dayId: string) => void
  // Approve (confirm) a worker day (admin action)
  approveWorkerDay?: (projectId: string, workerId: string, dayId: string, approver?: string) => void
  // Change worker status (admin action). Actor optional (who did it)
  changeWorkerStatus?: (
    projectId: string,
    workerId: string,
    status:
      | "AVAILABLE"
      | "WORKING"
      | "PENDING_PAYMENT"
      | "PAID"
      | "RESIGNED"
      | "WAITING_FOR_ASSIGNMENT"
      | "ON_COMPLAINT",
    actor?: string,
  ) => void

  complaints: Complaint[]
  addComplaint: (complaint: Complaint) => void
  updateComplaint: (id: string, complaint: Partial<Complaint>) => void
  deleteComplaint: (id: string) => void
  getUserComplaints: (userId: string) => Complaint[]
  getWorkerComplaints: (workerId: string) => Complaint[]

  cases: Case[]
  addCase: (caseItem: Case) => void
  updateCase: (id: string, caseItem: Partial<Case>) => void
  deleteCase: (id: string) => void
  updateCaseStatus: (id: string | number, status: string) => Promise<boolean>

  invoices: any[]
  createInvoice: (inv: any) => Promise<boolean>
  updateInvoiceStatus: (id: any, status: any, paid?: any) => Promise<boolean>

  quotes: any[]
  deleteQuote: (id: any) => Promise<boolean>
  createQuote: (q: any) => Promise<boolean>
  updateQuote: (id: any, q: any) => Promise<boolean>

  activities: Activity[]
  addActivity: (activity: Activity) => void
  updateActivity: (id: string | number, activity: Partial<Activity>) => Promise<boolean>
  deleteActivity: (id: string | number) => Promise<boolean>
  createActivity: (activity: Partial<Activity>) => Promise<boolean>

  workflows: WorkflowRule[]
  addWorkflow: (workflow: WorkflowRule) => void
  updateWorkflow: (id: string, workflow: Partial<WorkflowRule>) => void
  deleteWorkflow: (id: string) => void

  // teamMembers removed — use `useAuthStore().users` instead

  tasks: Task[]
  addTask: (task: Task) => void
  updateTask: (id: string, task: Partial<Task>) => void
  deleteTask: (id: string) => void
}

// Initial data are now stored in a JSON file and served via an API.
const initialNotifications: Notification[] = []
const initialLeads: Lead[] = []
const initialContacts: Contact[] = []
const initialDeals: Deal[] = []
const initialProducts: Product[] = []
const initialProjects: Project[] = []
const initialProjectAccounting: ProjectAccounting[] = []
const initialComplaints: Complaint[] = []
const initialCases: Case[] = []
const initialActivities: Activity[] = []
const initialWorkflows: WorkflowRule[] = []
// teamMembers removed; users are managed by auth-store
const initialTasks: Task[] = []
const initialNavigation: Array<{ name: string; href: string; icon: string; roles?: string[] }> = []

export const useDataStore = create<DataStore>()(
  persist(
    (set, get) => ({
      notifications: initialNotifications,
      invoices: [],
      quotes: [],
      addNotification: (notification) =>
        set((state) => ({
          notifications: [notification, ...state.notifications],
        })),
      markNotificationRead: (id: string) =>
        set((state) => ({
          notifications: state.notifications.map((n) => (n.id === id ? { ...n, unread: false } : n)),
        })),
      markAllNotificationsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, unread: false })),
        })),

      // --- Project automation helpers ---
      createProject: async (p) => {
        try {
          const API_BASE = getApiBase()
          const resp = await fetch(`${API_BASE}/api/db/projects`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p),
          })
          if (!resp.ok) return false
          const created = await resp.json()
          set((s) => ({ projects: [...s.projects, { id: String(created.id), name: created.name, status: created.status || 'PLANNED', startDate: p.startDate || null, endDate: null, value: p.budget || 0, projectKey: p.projectKey }as any ] }))
          try {
            const acctResp = await fetch(`${API_BASE}/api/db/project_accounting/${p.projectKey}`)
            if (acctResp.ok) {
              const a = await acctResp.json()
              set((s) => ({ projectAccounting: [...s.projectAccounting.filter(x => x.projectId !== p.projectKey), a] }))
            }
          } catch (e) {}
          return true
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('createProject error', err)
          return false
        }
      },

      assignWorkerToProject: async (projectKey, userId, salaryRate = 0, salaryType = 'daily') => {
        try {
          const API_BASE = getApiBase()
          const body: any = { userId }
          if (salaryRate !== undefined && salaryRate !== null) body.salaryRate = salaryRate
          if (salaryType) body.salaryType = salaryType
          const resp = await fetch(`${API_BASE}/api/db/projects/${projectKey}/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
          if (!resp.ok) return false
          set((s) => {
            const nextAccounting = s.projectAccounting.map((a) => {
              if (a.projectId !== projectKey) return a
              const existing = Array.isArray(a.workers) ? a.workers.slice() : []
              const idx = existing.findIndex((w: any) => String(w.id) === String(userId))
              if (idx === -1) {
                // resolve user name from auth-store if available
                let resolvedName = ''
                try {
                  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
                  const { useAuthStore } = require('./auth-store')
                  const u = useAuthStore.getState().users.find((x: any) => String(x.id) === String(userId))
                  if (u) resolvedName = u.name || ''
                } catch (e) {}
                existing.push({ id: userId, name: resolvedName, days: [], totalPayment: 0, status: 'WORKING', salaryRate: body.salaryRate || 0, salaryType: body.salaryType || 'daily' })
              } else {
                existing[idx] = { ...existing[idx], salaryRate: body.salaryRate || existing[idx].salaryRate || 0, salaryType: body.salaryType || existing[idx].salaryType || 'daily', status: 'WORKING' }
              }
              return { ...a, workers: existing }
            })
            return { projectAccounting: nextAccounting }
          })

          // After optimistic update, compute an estimated totalPayment for the newly assigned worker
          // and persist the accounting using updateProjectAccounting so the DB stores salaryRate/type and estimated payment.
          try {
            const state = get()
            const acct = state.projectAccounting.find((a) => a.projectId === projectKey)
            const project = state.projects.find((p) => ((p as any).projectKey || p.id) === projectKey)
            const getProjectDurationDays = (proj: any) => {
              try {
                if (!proj) return 30
                const s = proj.startDate ? new Date(proj.startDate) : null
                const e = proj.endDate ? new Date(proj.endDate) : null
                if (s && e && !isNaN(s.getTime()) && !isNaN(e.getTime())) {
                  const diffMs = Math.max(0, e.getTime() - s.getTime())
                  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1
                  return Math.max(1, days)
                }
                const alt = (proj && (proj as any).expectedDurationDays) || (proj && (proj as any).expected_duration_days)
                if (alt && Number.isFinite(Number(alt))) return Number(alt)
                return 30
              } catch (e) {
                return 30
              }
            }

            if (acct) {
              const days = getProjectDurationDays(project)
              const updated = { ...acct, workers: (acct.workers || []).map((w: any) => {
                if (String(w.id) !== String(userId)) return w
                const st = (w.salaryType || '').toString().toLowerCase()
                if (typeof w.salaryRate === 'number' && w.salaryRate > 0) {
                  if (st === 'monthly' || st === 'fixed') return { ...w, totalPayment: w.salaryRate }
                  if (st === 'weekly') {
                    const weeks = Math.max(1, Math.ceil(days / 7))
                    return { ...w, totalPayment: w.salaryRate * weeks }
                  }
                  if (st === 'daily') return { ...w, totalPayment: w.salaryRate * days }
                }
                return w
              }) }
              // call existing updater to persist
              try { state.updateProjectAccounting(updated) } catch (e) { /* ignore */ }
            }
          } catch (e) {
            // non-fatal
          }

          return true
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('assignWorkerToProject', err)
          return false
        }
      },

      startProject: async (projectKey) => {
        try {
          const API_BASE = getApiBase()
          const resp = await fetch(`${API_BASE}/api/db/projects/${projectKey}/start`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ startDate: new Date().toISOString().slice(0, 10) }) })
          if (!resp.ok) return false
          set((s) => ({ projects: s.projects.map(p => (p as any).projectKey === projectKey ? { ...p, status: 'IN_PROGRESS', startDate: new Date().toISOString().slice(0, 10) } : p) }))
          set((s) => ({ projectAccounting: s.projectAccounting.map(a => a.projectId === projectKey ? { ...a, workers: (a.workers || []).map(w => ({ ...w, status: 'WORKING' })) } : a) }))
          return true
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('startProject', err)
          return false
        }
      },

      completeProject: async (projectKey) => {
        try {
          const API_BASE = getApiBase()
          const resp = await fetch(`${API_BASE}/api/db/projects/${projectKey}/complete`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endDate: new Date().toISOString().slice(0, 10) }) })
          if (!resp.ok) return false
          set((s) => ({ projects: s.projects.map(p => (p as any).projectKey === projectKey ? { ...p, status: 'COMPLETED', endDate: new Date().toISOString().slice(0, 10) } : p) }))
          set((s) => ({ projectAccounting: s.projectAccounting.map(a => a.projectId === projectKey ? { ...a, workers: (a.workers || []).map(w => ({ ...w, status: 'PENDING_PAYMENT' })) } : a) }))
          return true
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('completeProject', err)
          return false
        }
      },

      payWorkerOnProject: async (projectKey, userId, amount = 0) => {
        try {
          const API_BASE = getApiBase()
          const resp = await fetch(`${API_BASE}/api/db/projects/${projectKey}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, amount }) })
          if (!resp.ok) return false
          set((s) => ({ projectAccounting: s.projectAccounting.map(a => a.projectId === projectKey ? { ...a, workers: (a.workers || []).map(w => (String(w.id) === String(userId) ? { ...w, status: 'PAID', paidAt: new Date().toISOString() } : w)) } : a) }))
          set((s) => {
            const acct = s.projectAccounting.find(a => a.projectId === projectKey)
            if (acct && (acct.workers || []).every(w => w.status === 'PAID')) {
              return { projects: s.projects.map(p => (p as any).projectKey === projectKey ? { ...p, status: 'CLOSED' } : p) }
            }
            return {}
          })
          return true
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('payWorkerOnProject', err)
          return false
        }
      },

      // --- Invoices persistence ---
      createInvoice: async (inv: any) => {
        try {
          const API_BASE = getApiBase()
          const resp = await fetch(`${API_BASE}/api/db/invoices`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inv) })
          if (!resp.ok) return false
          const data = await resp.json()
          const id = data.id ? `INV-${data.id}` : `INV-${Date.now()}`
          set((s) => ({ invoices: [{ id, client: inv.client, project: inv.project, date: inv.date, dueDate: inv.dueDate, amount: inv.amount || 0, paid: 0, status: inv.status || 'pending' } as any, ...(s as any).invoices || []] } as any))
          return true
        } catch (err) {
          console.error('createInvoice', err)
          return false
        }
      },

      updateInvoiceStatus: async (id: any, status: any, paid: any) => {
        try {
          const API_BASE = getApiBase()
          const resp = await fetch(`${API_BASE}/api/db/invoices`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status, paid }) })
          if (!resp.ok) return false
          set((s) => ({ invoices: (s as any).invoices.map((inv: any) => inv.id === id ? { ...inv, status: status ?? inv.status, paid: paid ?? inv.paid } : inv) } as any))
          return true
        } catch (err) {
          console.error('updateInvoiceStatus', err)
          return false
        }
      },

      // --- Cases ---
      updateCaseStatus: async (id: any, status: any) => {
        try {
          const API_BASE = getApiBase()
          const resp = await fetch(`${API_BASE}/api/db/cases`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
          if (!resp.ok) return false
          set((s) => ({ cases: (s as any).cases ? (s as any).cases.map((c: any) => c.id === id ? { ...c, status } : c) : [] }))
          return true
        } catch (err) {
          console.error('updateCaseStatus', err)
          return false
        }
      },

      // --- Quotes ---
      deleteQuote: async (id: any) => {
        try {
          const API_BASE = getApiBase()
          const resp = await fetch(`${API_BASE}/api/db/quotes?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
          if (!resp.ok) return false
          set((s) => ({ quotes: (s as any).quotes ? (s as any).quotes.filter((q: any) => q.id !== id) : [] } as any))
          return true
        } catch (err) {
          console.error('deleteQuote', err)
          return false
        }
      },
      createQuote: async (q: any) => {
        try {
          const API_BASE = getApiBase()
          const resp = await fetch(`${API_BASE}/api/db/quotes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q) })
          if (!resp.ok) return false
          const data = await resp.json()
          const id = data.id ? `QT-${data.id}` : `QT-${Date.now()}`
          set((s) => ({ quotes: [{ id, client: q.client, project: q.project, date: q.date, validUntil: q.validUntil, amount: q.amount || 0, status: q.status || 'draft' } as any, ...(s as any).quotes || []] } as any))
          return true
        } catch (err) {
          console.error('createQuote', err)
          return false
        }
      },

      updateQuote: async (id: any, q: any) => {
        try {
          const API_BASE = getApiBase()
          const resp = await fetch(`${API_BASE}/api/db/quotes/update`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...q }) })
          if (!resp.ok) return false
          set((s) => ({ quotes: (s as any).quotes ? (s as any).quotes.map((qq: any) => (qq.id === id ? { ...qq, ...q } : qq)) : [] } as any))
          return true
        } catch (err) {
          console.error('updateQuote', err)
          return false
        }
      },

      // --- Activities ---
      deleteActivity: async (id: any) => {
        try {
          const API_BASE = getApiBase()
          const resp = await fetch(`${API_BASE}/api/db/activities?id=${encodeURIComponent(String(id) )}`, { method: 'DELETE' })
          if (!resp.ok) return false
          set((s) => ({ activities: (s as any).activities ? (s as any).activities.filter((a: any) => String(a.id) !== String(id)) : [] }))
          return true
        } catch (err) {
          console.error('deleteActivity', err)
          return false
        }
      },
      createActivity: async (a: any) => {
        try {
          const API_BASE = getApiBase()
          const resp = await fetch(`${API_BASE}/api/db/activities`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a) })
          if (!resp.ok) return false
          const data = await resp.json()
          const id = data.id || Date.now()
          set((s) => ({ activities: [{ id, ...a } as any, ...(s as any).activities || []] }))
          return true
        } catch (err) {
          console.error('createActivity', err)
          return false
        }
      },

      updateActivity: async (id: any, a: any) => {
        try {
          const API_BASE = getApiBase()
          const resp = await fetch(`${API_BASE}/api/db/activities/update`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...a }) })
          if (!resp.ok) {
            try {
              const txt = await resp.text().catch(() => '')
              console.error('updateActivity API error', resp.status, txt)
            } catch (e) {
              console.error('updateActivity: failed to read error body', String(e))
            }
            return false
          }
          set((s) => ({ activities: (s as any).activities ? (s as any).activities.map((act: any) => (String(act.id) === String(id) ? { ...act, ...a } : act)) : [] }))
          return true
        } catch (err) {
          console.error('updateActivity', err)
          return false
        }
      },

      generatePayrollExport: (projectKey) => {
        const acct = get().projectAccounting.find(a => a.projectId === projectKey)
        if (!acct) return { csv: '', rows: [] }
        const rows = (acct.workers || []).map(w => {
          const days = (w.days || []).length
          const rate = w.salaryRate || 0
          const total = w.totalPayment || 0
          return { name: w.name || w.id, days, rate, total, status: w.status || '' }
        })
        const header = ['Worker','Days','Rate','Total','Status']
        const csv = [header.join(',')].concat(rows.map(r => [r.name, r.days, r.rate.toFixed(2), r.total.toFixed(2), r.status].join(','))).join('\n')
        return { csv, rows }
      },

      

      leads: initialLeads,
      addLead: async (lead) => {
        // optimistic update
        set((state) => ({ leads: [...state.leads, lead] } as any))
        try {
          const API_BASE = getApiBase()
          const resp = await fetch(`${API_BASE}/api/db/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead) })
          if (!resp.ok) throw new Error('API create failed')
          const data = await resp.json().catch(() => ({}))
          // if DB provided id, replace temporary id
          if (data?.id) {
            const insertId = String(data.id)
            set((s) => ({ leads: s.leads.map((l: any) => (l.id === lead.id ? { ...l, id: insertId } : l)) } as any))
          }
          return true
        } catch (err) {
          console.error('addLead error', err)
          // rollback optimistic add
          set((s) => ({ leads: s.leads.filter((l) => l.id !== lead.id) } as any))
          return false
        }
      },
      updateLead: async (id, lead) => {
        // optimistic update
        const prev = get().leads.find((l) => l.id === id)
        set((state) => ({ leads: state.leads.map((l) => (l.id === id ? { ...l, ...lead } : l)) } as any))
        try {
          // include editor info if available
          let editedBy: string | null = null
          try {
            // avoid circular import at top by importing here
            // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
            const { useAuthStore } = require('./auth-store')
            const u = useAuthStore.getState().user
            if (u) editedBy = u.name || u.id
          } catch (e) {
            // ignore
          }

          const API_BASE = getApiBase()
          const payload = { id, ...lead, editedBy }
          const resp = await fetch(`${API_BASE}/api/db/leads`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          if (!resp.ok) throw new Error('API update failed')
          const json = await resp.json().catch(() => null)
          return json || { ok: true }
        } catch (err) {
          console.error('updateLead error', err)
          // rollback
          if (prev) set((s) => ({ leads: s.leads.map((l) => (l.id === id ? prev : l)) } as any))
          return { ok: false, error: String(err) }
        }
      },
      deleteLead: async (id) => {
        // optimistic delete
        const prevList = get().leads
        set((state) => ({ leads: state.leads.filter((l) => l.id !== id) } as any))
        try {
          const API_BASE = getApiBase()
          const resp = await fetch(`${API_BASE}/api/db/leads?id=${encodeURIComponent(String(id))}`, { method: 'DELETE' })
          if (!resp.ok) throw new Error('API delete failed')
          return true
        } catch (err) {
          console.error('deleteLead error', err)
          // rollback
          set((s) => ({ leads: prevList } as any))
          return false
        }
      },

      contacts: initialContacts,
      addContact: async (contact) => {
        // optimistic update
        set((state) => ({ contacts: [...state.contacts, contact] }))
        try {
          const API_BASE = getApiBase()
          const resp = await fetch(`${API_BASE}/api/db/contacts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(contact) })
          // If Next didn't expose the route but an auxiliary Express server runs on :3001, retry there
          let finalResp = resp
          if (resp.status === 404 && typeof API_BASE === 'string' && API_BASE.includes('localhost:3000')) {
            try {
              finalResp = await fetch(API_BASE.replace('localhost:3000', 'localhost:3001') + '/api/db/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(contact) })
            } catch (e) {
              // ignore and fall through to error handling
            }
          }
          if (!finalResp.ok) throw new Error('API create failed')
          const data = await resp.json().catch(() => ({}))
          if (data?.id) {
            const insertId = String(data.id)
            set((s) => ({ contacts: s.contacts.map((c: any) => (c.id === contact.id ? { ...c, id: insertId } : c)) }))
          }
          return true
        } catch (err) {
          console.error('addContact error', err)
          // rollback optimistic add
          set((s) => ({ contacts: s.contacts.filter((c) => c.id !== contact.id) }))
          return false
        }
      },
      updateContact: async (id, contact) => {
        const prev = get().contacts.find((c) => c.id === id)
        // optimistic update
        set((state) => ({ contacts: state.contacts.map((c) => (c.id === id ? { ...c, ...contact } : c)) }))
        try {
          const API_BASE = getApiBase()
          const payload = { id, ...contact }
          const resp = await fetch(`${API_BASE}/api/db/contacts`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          let finalResp = resp
          if (resp.status === 404 && typeof API_BASE === 'string' && API_BASE.includes('localhost:3000')) {
            try {
              finalResp = await fetch(API_BASE.replace('localhost:3000', 'localhost:3001') + '/api/db/contacts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            } catch (e) {}
          }
          if (!finalResp.ok) throw new Error('API update failed')
          return true
        } catch (err) {
          console.error('updateContact error', err)
          // rollback
          if (prev) set((s) => ({ contacts: s.contacts.map((c) => (c.id === id ? prev : c)) }))
          return false
        }
      },
      deleteContact: async (id) => {
        // optimistic delete
        const prevList = get().contacts
        set((state) => ({ contacts: state.contacts.filter((c) => c.id !== id) }))
        try {
          const API_BASE = getApiBase()
          const url = `${API_BASE}/api/db/contacts?id=${encodeURIComponent(String(id))}`
          const resp = await fetch(url, { method: 'DELETE' })
          let finalResp = resp
          if (resp.status === 404 && typeof API_BASE === 'string' && API_BASE.includes('localhost:3000')) {
            try {
              const alt = API_BASE.replace('localhost:3000', 'localhost:3001')
              finalResp = await fetch(`${alt}/api/db/contacts?id=${encodeURIComponent(String(id))}`, { method: 'DELETE' })
            } catch (e) {}
          }
          if (!finalResp.ok) throw new Error('API delete failed')
          return true
        } catch (err) {
          console.error('deleteContact error', err)
          // rollback
          set((s) => ({ contacts: prevList }))
          return false
        }
      },

      deals: initialDeals,
      addDeal: async (deal) => {
        // optimistic
        const prev = get().deals
        set((state) => ({ deals: [...state.deals, deal] }))
        try {
          const API_BASE = getApiBase()
          const resp = await fetch(`${API_BASE}/api/db/deals`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(deal) })
          if (!resp.ok) throw new Error('API create failed')
          const data = await resp.json()
          // if backend returns an insert id, map it
          if (data && data.id) {
            const newId = String(data.id)
            set((s) => ({ deals: (s.deals || []).map((d: any) => (d === deal || d.id === deal.id ? { ...d, id: newId } : d)) }))
          }
          return true
        } catch (err) {
          console.error('addDeal', err)
          // rollback
          set((s) => ({ deals: prev }))
          return false
        }
      },
      updateDeal: async (id, deal) => {
        const prev = get().deals
        set((state) => ({ deals: state.deals.map((d) => (d.id === id ? { ...d, ...deal } : d)) }))
        try {
          const API_BASE = getApiBase()
          const resp = await fetch(`${API_BASE}/api/db/deals/update`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...deal }) })
          if (!resp.ok) throw new Error('API update failed')
          return true
        } catch (err) {
          console.error('updateDeal', err)
          // rollback
          set((s) => ({ deals: prev }))
          return false
        }
      },
      deleteDeal: async (id) => {
        const prev = get().deals
        set((state) => ({ deals: state.deals.filter((d) => d.id !== id) }))
        try {
          const API_BASE = getApiBase()
          const resp = await fetch(`${API_BASE}/api/db/deals?id=${encodeURIComponent(String(id))}`, { method: 'DELETE' })
          if (!resp.ok) throw new Error('API delete failed')
          return true
        } catch (err) {
          console.error('deleteDeal', err)
          // rollback
          set((s) => ({ deals: prev }))
          return false
        }
      },

      products: initialProducts,
      addProduct: async (product) => {
        const prev = get().products
        set((s) => ({ products: [...(s.products || []), product] }))
        try {
          const API_BASE = getApiBase()
          const resp = await fetch(`${API_BASE}/api/db/products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(product) })
          if (!resp.ok) throw new Error('API create failed')
          const data = await resp.json().catch(() => ({}))
          if (data?.id) {
            const newId = String(data.id)
            set((s) => ({ products: (s.products || []).map((p: any) => (p === product || p.id === product.id ? { ...p, id: newId } : p)) }))
          }
          return true
        } catch (err) {
          console.error('addProduct error', err)
          set((s) => ({ products: prev }))
          return false
        }
      },
      updateProduct: async (id, product) => {
        const prev = get().products
        set((s) => ({ products: s.products.map((p) => (p.id === id ? { ...p, ...product } : p)) }))
        try {
          const API_BASE = getApiBase()
          const resp = await fetch(`${API_BASE}/api/db/products`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...product }) })
          if (!resp.ok) throw new Error('API update failed')
          return true
        } catch (err) {
          console.error('updateProduct error', err)
          set((s) => ({ products: prev }))
          return false
        }
      },
      deleteProduct: async (id) => {
        const prev = get().products
        set((s) => ({ products: s.products.filter((p) => p.id !== id) }))
        try {
          const API_BASE = getApiBase()
          const resp = await fetch(`${API_BASE}/api/db/products?id=${encodeURIComponent(String(id))}`, { method: 'DELETE' })
          if (!resp.ok) throw new Error('API delete failed')
          return true
        } catch (err) {
          console.error('deleteProduct error', err)
          set((s) => ({ products: prev }))
          return false
        }
      },

      projects: initialProjects,
      addProject: (project) =>
        set((state) => ({
          projects: [...state.projects, project],
        })),
      updateProject: async (id, project) => {
        const API_BASE = getApiBase()
        const prev = get().projects
        // optimistic update by id or projectKey
        set((state) => ({ projects: state.projects.map((p) => ((p as any).id === id || (p as any).projectKey === id) ? { ...p, ...project } : p) }))
        try {
           // Sanitize date fields before sending to server to avoid '[object Object]' values
           const sanitizeDate = (d: any) => {
             try {
               if (d == null) return null
               if (typeof d === 'string') {
                 if (d.includes('[object')) return null
                 // accept YYYY-MM-DD
                 if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
                 const dt = new Date(d)
                 if (!isNaN(dt.getTime())) return dt.toISOString().slice(0,10)
                 return null
               }
               if (d instanceof Date) return d.toISOString().slice(0,10)
               if (d && typeof d.toISOString === 'function') return d.toISOString().slice(0,10)
               return String(d).includes('[object') ? null : String(d)
             } catch (e) { return null }
           }

           const payloadToSend = { ...project }
           if ('startDate' in payloadToSend) payloadToSend.startDate = sanitizeDate(payloadToSend.startDate)
           if ('endDate' in payloadToSend) payloadToSend.endDate = sanitizeDate(payloadToSend.endDate)

           const resp = await fetch(`${API_BASE}/api/db/projects/${encodeURIComponent(String(id))}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payloadToSend) })
          if (!resp.ok) {
            set((s) => ({ projects: prev }))
            return null
          }
          const updated = await resp.json().catch(() => null)
          if (!updated) {
            set((s) => ({ projects: prev }))
            return null
          }
          // Normalize DB response: prefer `budget` as `value`, map snake_case to camelCase
          try {
            const fmt = (d: any) => {
              try {
                if (d == null) return ''
                if (typeof d === 'string') return d.slice(0, 10)
                if (d instanceof Date) return d.toISOString().slice(0, 10)
                if (d && typeof d.toISOString === 'function') return d.toISOString().slice(0, 10)
                return String(d)
              } catch (e) { return String(d) }
            }
            if (updated.project_key && !updated.projectKey) updated.projectKey = updated.project_key
            if (typeof updated.budget !== 'undefined') updated.value = Number(updated.budget)
            if (typeof updated.value !== 'undefined') updated.value = Number(updated.value)
            if (typeof updated.start_date !== 'undefined' && !updated.startDate) updated.startDate = fmt(updated.start_date)
            if (typeof updated.end_date !== 'undefined' && !updated.endDate) updated.endDate = fmt(updated.end_date)
            if (typeof updated.startDate !== 'undefined' && updated.startDate && typeof updated.startDate !== 'string') updated.startDate = fmt(updated.startDate)
            if (typeof updated.endDate !== 'undefined' && updated.endDate && typeof updated.endDate !== 'string') updated.endDate = fmt(updated.endDate)
            if (typeof updated.id !== 'undefined') updated.id = String(updated.id)
          } catch (e) {
            // ignore normalization errors
          }

          // normalize returned record and update local store
          set((s) => ({
            projects: s.projects.map((p) => {
              const pid = (p as any).id ? String((p as any).id) : undefined
              const pkey = (p as any).projectKey || (p as any).project_key
              const matchesId = pid && updated.id && pid === String(updated.id)
              const matchesKey = pkey && (String(pkey) === String(updated.projectKey || updated.project_key))
              if (matchesId || matchesKey) return { ...p, ...updated }
              return p
            }),
          }))
          // additionally fetch and update project_accounting to ensure UI shows updated totalPrice and dates
          try {
            const API_BASE = getApiBase()
            const key = updated.projectKey || updated.project_key || updated.id
            if (key) {
              try {
                const acctResp = await fetch(`${API_BASE}/api/db/project_accounting/${encodeURIComponent(String(key))}`)
                if (acctResp.ok) {
                  const acctJson = await acctResp.json().catch(() => null)
                  if (acctJson) {
                    set((s) => ({ projectAccounting: s.projectAccounting.filter(a => a.projectId !== String(key)).concat([acctJson]) }))
                  }
                }
              } catch (e) {
                // ignore account fetch errors
              }
            }
          } catch (e) {}

          // Force-sync authoritative project from API to avoid local-state/date mismatches
          try {
            const API_BASE = getApiBase()
            const res2 = await fetch(`${API_BASE}/api/db/data`)
            if (res2.ok) {
              const data2 = await res2.json().catch(() => null)
              if (data2 && Array.isArray(data2.projects)) {
                const key2 = updated.projectKey || updated.project_key || updated.id
                const found = data2.projects.find((p: any) => String(p.project_key || p.projectKey || p.id) === String(key2))
                if (found) {
                  const norm: any = { ...found }
                  if (norm.project_key && !norm.projectKey) norm.projectKey = norm.project_key
                  norm.startDate = (norm.start_date || norm.startDate) ? String(norm.start_date || norm.startDate).slice(0,10) : ''
                  norm.endDate = (norm.end_date || norm.endDate) ? String(norm.end_date || norm.endDate).slice(0,10) : ''
                  if (typeof norm.id !== 'undefined') norm.id = String(norm.id)
                  set((s) => ({ projects: s.projects.map((p) => {
                    const pkey = (p as any).projectKey || (p as any).project_key || (p as any).id
                    if (pkey && String(pkey) === String(norm.projectKey || norm.project_key || norm.id)) return { ...p, ...norm }
                    return p
                  }) }))
                }
              }
            }
          } catch (e) { /* non-fatal */ }

          return updated
        } catch (err) {
          // rollback
          // eslint-disable-next-line no-console
          console.error('updateProject error', err)
          set((s) => ({ projects: prev }))
          return null
        }
      },
      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
        })),

      projectAccounting: initialProjectAccounting,
      getProjectAccounting: (projectId) => {
        return get().projectAccounting.find((a) => a.projectId === projectId)
      },
      // Update accounting in local store and attempt to persist to backend.
      updateProjectAccounting: (accounting) =>
        set((state) => {
          // Compute labor from confirmed days if workers provided
          let computedLabor = accounting.labor || 0
          if (accounting.workers && accounting.workers.length > 0) {
            computedLabor = accounting.workers.reduce((sumW, w) => {
              const confirmedSum = (w.days || []).filter((d) => d.confirmed).reduce((s, d) => s + d.payment, 0)
              return sumW + confirmedSum
            }, 0)
          }

          // ensure materialsProfit is computed if materialsCharged provided
          const materialsProfit =
            typeof accounting.materialsCharged === "number"
              ? (accounting.materialsCharged || 0) - (accounting.materials || 0)
              : accounting.materialsProfit || 0

          const totalPrice = accounting.totalPrice || 0
          const computedProfit = totalPrice - (computedLabor + (accounting.materials || 0) + (accounting.insurance || 0))

          const acct: ProjectAccounting = {
            ...accounting,
            labor: computedLabor,
            materialsProfit,
            profit: computedProfit,
            totalPrice,
            logs: accounting.logs || [],
          }

          const exists = state.projectAccounting.some((a) => a.projectId === acct.projectId)
          const nextState = exists
            ? { projectAccounting: state.projectAccounting.map((a) => (a.projectId === acct.projectId ? acct : a)) }
            : { projectAccounting: [...state.projectAccounting, acct] }

          // After optimistic local update, try to persist to backend
          ;(async () => {
            try {
              const API_BASE = getApiBase()
              await fetch(`${API_BASE}/api/db/project_accounting`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(acct),
              })
            } catch (err) {
              // persist failed — leave local state (will be synced later)
              // eslint-disable-next-line no-console
              console.warn('Persist project_accounting failed', err)
            }
          })()

          return nextState
        }),
      addWorker: (projectId, worker) =>
        set((state) => ({
          projectAccounting: state.projectAccounting.map((a) =>
            a.projectId === projectId ? { ...a, workers: [...a.workers, worker] } : a,
          ),
        })),
      updateWorker: (projectId, workerId, worker) =>
        set((state) => ({
          projectAccounting: state.projectAccounting.map((a) =>
            a.projectId === projectId
              ? {
                  ...a,
                  workers: a.workers.map((w) =>
                    w.id === workerId
                      ? {
                          ...w,
                          ...worker,
                          totalPayment: worker.days
                            ? worker.days.reduce((sum, day) => sum + day.payment, 0)
                            : w.totalPayment,
                        }
                      : w,
                  ),
                }
              : a,
          ),
        })),
      deleteWorker: (projectId, workerId) =>
        set((state) => ({
          projectAccounting: state.projectAccounting.map((a) =>
            a.projectId === projectId ? { ...a, workers: a.workers.filter((w) => w.id !== workerId) } : a,
          ),
        })),
      addWorkerDay: (projectId, workerId, day) =>
        // Only allow adding a day if worker status is WORKING. Day may be added unconfirmed; admin must approve.
        set((state) => ({
          projectAccounting: state.projectAccounting.map((a) =>
            a.projectId === projectId
              ? {
                  ...a,
                  workers: a.workers.map((w) => {
                    if (w.id === workerId) {
                      if (w.status !== "WORKING") return w
                      const newDay = { ...day, confirmed: !!day.confirmed }
                      const newDays = [...w.days, newDay]
                      return {
                        ...w,
                        days: newDays,
                        totalPayment: newDays.reduce((sum, d) => sum + d.payment, 0),
                      }
                    }
                    return w
                  }),
                }
              : a,
          ),
        })),
      updateWorkerDay: (projectId, workerId, dayId, day) =>
        // Prevent updating days if worker status is PAID (locked)
        set((state) => ({
          projectAccounting: state.projectAccounting.map((a) =>
            a.projectId === projectId
              ? {
                  ...a,
                  workers: a.workers.map((w) => {
                    if (w.id === workerId) {
                      if (w.status === "PAID") return w
                      const newDays = w.days.map((d) => (d.id === dayId ? { ...d, ...day } : d))
                      return {
                        ...w,
                        days: newDays,
                        totalPayment: newDays.reduce((sum, d) => sum + d.payment, 0),
                      }
                    }
                    return w
                  }),
                }
              : a,
          ),
        })),
      deleteWorkerDay: (projectId, workerId, dayId) =>
        // Prevent deleting days if worker status is PAID (locked)
        set((state) => ({
          projectAccounting: state.projectAccounting.map((a) =>
            a.projectId === projectId
              ? {
                  ...a,
                  workers: a.workers.map((w) => {
                    if (w.id === workerId) {
                      if (w.status === "PAID") return w
                      const newDays = w.days.filter((d) => d.id !== dayId)
                      return {
                        ...w,
                        days: newDays,
                        totalPayment: newDays.reduce((sum, d) => sum + d.payment, 0),
                      }
                    }
                    return w
                  }),
                }
              : a,
          ),
        })),
      // Approve (confirm) a worker day. Only an admin should call this in production.
      approveWorkerDay: (projectId: string, workerId: string, dayId: string, approver?: string) =>
        set((state) => ({
          projectAccounting: state.projectAccounting.map((a) =>
            a.projectId === projectId
              ? {
                  ...a,
                  workers: a.workers.map((w) => {
                    if (w.id === workerId) {
                      const newDays = w.days.map((d) => (d.id === dayId ? { ...d, confirmed: true } : d))
                      return {
                        ...w,
                        days: newDays,
                        totalPayment: newDays.reduce((sum, d) => sum + d.payment, 0),
                      }
                    }
                    return w
                  }),
                  logs: [
                    ...(a.logs || []),
                    { id: `log-${Date.now()}`, time: new Date().toISOString(), actor: approver, action: 'approve-day', details: `Worker ${workerId} day ${dayId} approved` },
                  ],
                }
              : a,
          ),
        })),
      // Change worker status (normalized set plus internal ON_COMPLAINT)
      changeWorkerStatus: (
        projectId: string,
        workerId: string,
        status:
          | "AVAILABLE"
          | "WORKING"
          | "PENDING_PAYMENT"
          | "PAID"
          | "RESIGNED"
          | "WAITING_FOR_ASSIGNMENT"
          | "ON_COMPLAINT",
        actor?: string,
      ) =>
        set((state) => ({
          projectAccounting: state.projectAccounting.map((a) =>
            a.projectId === projectId
              ? {
                  ...a,
                  workers: a.workers.map((w) => {
                    if (w.id !== workerId) return w
                    // Enforce rules: cannot set WORKING without a salaryRate
                    if (status === "WORKING" && !(w.salaryRate && w.salaryRate > 0)) return w
                    // When marking PAID, set paidAt timestamp and lock further edits (other methods already check status)
                    if (status === "PAID") {
                      return { ...w, prevStatus: w.status || undefined, status, paidAt: new Date().toISOString() }
                    }
                    // When moving to ON_COMPLAINT, preserve previous status
                    if (status === "ON_COMPLAINT") {
                      return { ...w, prevStatus: w.status || undefined, status }
                    }
                    // When restoring from complaint to another status, clear prevStatus
                    return { ...w, status, prevStatus: status === w.prevStatus ? undefined : w.prevStatus }
                  }),
                  logs: [
                    ...(a.logs || []),
                    { id: `log-${Date.now()}`, time: new Date().toISOString(), actor, action: 'change-worker-status', details: `Worker ${workerId} -> ${status}` },
                  ],
                }
              : a,
          ),
        })),

      complaints: initialComplaints,
      addComplaint: (complaint) =>
        set((state) => {
          const out = { complaints: [...state.complaints, complaint] } as any
          // If the complaint mentions a worker, set their status to ON_COMPLAINT
          if (complaint.mentionedWorker) {
            out.projectAccounting = state.projectAccounting.map((a) => ({
              ...a,
              workers: a.workers.map((w) =>
                w.id === complaint.mentionedWorker ? { ...w, prevStatus: w.status || undefined, status: 'ON_COMPLAINT' } : w,
              ),
            }))
          }
          return out
        }),
      updateComplaint: (id, complaint) =>
        set((state) => {
          const updated = state.complaints.map((c) => (c.id === id ? { ...c, ...complaint } : c))
          const target = updated.find((c) => c.id === id)
          const out: any = { complaints: updated }
          // If complaint status moved to resolved or rejected, restore worker status
          if (target && (target.status === 'resolved' || target.status === 'rejected') && target.mentionedWorker) {
            out.projectAccounting = state.projectAccounting.map((a) => ({
              ...a,
              workers: a.workers.map((w) => {
                if (w.id !== target.mentionedWorker) return w
                // restore previous status if available, otherwise set to AWAITING_ASSIGNMENT
                const restored = w.prevStatus || 'AWAITING_ASSIGNMENT'
                return { ...w, status: restored as any, prevStatus: undefined }
              }),
            }))
          }
          return out
        }),
      deleteComplaint: (id) =>
        set((state) => ({
          complaints: state.complaints.filter((c) => c.id !== id),
        })),
      getUserComplaints: (userId) => {
        return get().complaints.filter((c) => c.createdBy === userId)
      },
      getWorkerComplaints: (workerId) => {
        return get().complaints.filter((c) => c.mentionedWorker === workerId)
      },

      cases: initialCases,
      addCase: (caseItem) =>
        set((state) => ({
          cases: [...state.cases, caseItem],
        })),
      updateCase: (id, caseItem) =>
        set((state) => ({
          cases: state.cases.map((c) => (c.id === id ? { ...c, ...caseItem } : c)),
        })),
      deleteCase: (id) =>
        set((state) => ({
          cases: state.cases.filter((c) => c.id !== id),
        })),

      activities: initialActivities,
      addActivity: (activity) =>
        set((state) => ({
          activities: [...state.activities, activity],
        })),

      workflows: initialWorkflows,
      addWorkflow: (workflow) =>
        set((state) => ({
          workflows: [...state.workflows, workflow],
        })),
      updateWorkflow: (id, workflow) =>
        set((state) => ({
          workflows: state.workflows.map((w) => (w.id === id ? { ...w, ...workflow } : w)),
        })),
      deleteWorkflow: (id) =>
        set((state) => ({
          workflows: state.workflows.filter((w) => w.id !== id),
        })),

      // teamMembers removed — use `useAuthStore().users` for user/worker lists
      navigation: initialNavigation,
      // team member management removed — use auth-store for users

      tasks: initialTasks,
      addTask: (task) =>
        set((state) => ({
          tasks: [...state.tasks, task],
        })),
      updateTask: (id, task) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...task } : t)),
        })),
      deleteTask: (id) =>
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
        })),
    }),
    {
      name: "paint-power-crm-storage",
      // Ensure persisted snapshot is sanitized: convert Date-like values to strings
      partialize: (state) => {
        // Do not persist `projects` or `projectAccounting` to avoid stale local data
        // from overwriting authoritative server values. Persist other lightweight
        // UI state (tasks, notifications etc.) but always load projects from the API.
        const { projects, projectAccounting, ...rest } = state as any

        const safeTasks = (rest.tasks || []).map((t: any) => ({ ...t, dueDate: (t && t.dueDate && String(t.dueDate).includes('[object')) ? '' : (t && t.dueDate ? String(t.dueDate) : t.dueDate) }))

        return {
          ...rest,
          tasks: safeTasks,
        }
      },
      onRehydrateStorage: () => (state) => {
        // After rehydration from localStorage completes, attempt to fetch
        // authoritative data from the MySQL-backed API and overwrite local state.
        ;(async () => {
          try {
            const API_BASE = getApiBase()
            const res = await fetch(`${API_BASE}/api/db/data`)
            if (!res.ok) return
            const data = await res.json()
            if (!data) return

            const formatDateSafe = (d: any) => {
              try {
                if (d == null) return ''
                const s = typeof d === 'string' ? d : (d && typeof d.toString === 'function' ? d.toString() : String(d))
                return s.slice(0, 10)
              } catch (e) { return '' }
            }

            const normalizeProject = (p: any) => {
              try {
                const out = { ...p }
                if (typeof out.budget !== 'undefined' && (typeof out.value === 'undefined' || Number(out.value) === 0)) {
                  out.value = Number(out.budget || 0)
                }
                if (out.project_key && !out.projectKey) out.projectKey = out.project_key
                if (typeof out.start_date !== 'undefined' && !out.startDate) out.startDate = formatDateSafe(out.start_date)
                if (typeof out.end_date !== 'undefined' && !out.endDate) out.endDate = formatDateSafe(out.end_date)
                if (typeof out.id !== 'undefined') out.id = String(out.id)
                return out
              } catch (e) { return p }
            }

            const projects = Array.isArray(data.projects) ? data.projects.map(normalizeProject) : []
            const projectAccounting = Array.isArray(data.project_accounting) ? data.project_accounting.map((a: any) => {
              try {
                const acct = a.accounting && typeof a.accounting === 'string' ? JSON.parse(a.accounting) : a.accounting || {}
                return acct
              } catch (e) { return a }
            }) : (data.projectAccounting || [])

            useDataStore.setState({
              notifications: data.notifications || [],
              leads: data.leads || [],
              contacts: data.contacts || [],
              deals: data.deals || [],
              products: data.products || [],
              projects,
              projectAccounting: projectAccounting || [],
              navigation: data.navigation || [],
              complaints: data.complaints || [],
              cases: data.cases || [],
              activities: data.activities || [],
              workflows: data.workflows || [],
              tasks: data.tasks || [],
            })
          } catch (e) {
            // ignore
          }
        })()
      },
    },
  ),
)

export async function initializeDataStore() {
  try {
    let data = null

    // Try MySQL-backed API first (use API_BASE so Express on :3001 is preferred in dev)
    try {
      const API_BASE = getApiBase()
      const res = await fetch(`${API_BASE}/api/db/data`)
      if (res.ok) data = await res.json()
    } catch (e) {
      // ignore and fallback
      // eslint-disable-next-line no-console
      console.warn('MySQL API fetch failed, falling back to file DB', e)
    }

    // Fallback to db.json file API
    if (!data) {
      try {
        // fall back to the bundled file API on the same origin
        const res2 = await fetch('/api/data')
        if (res2.ok) data = await res2.json()
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('File DB fetch failed', e)
      }
    }

    if (!data) return

    // Normalize projects returned by backend: some DBs store `budget` and `project_key`.
    const formatDateSafe = (d: any) => {
      try {
        if (d == null) return ''
        const s = typeof d === 'string' ? d : (d && typeof d.toString === 'function' ? d.toString() : String(d))
        return s.slice(0, 10)
      } catch (e) { return '' }
    }

    const normalizeProject = (p: any) => {
      try {
        const out = { ...p }
        if (typeof out.budget !== 'undefined' && (typeof out.value === 'undefined' || Number(out.value) === 0)) {
          out.value = Number(out.budget || 0)
        }
        if (out.project_key && !out.projectKey) out.projectKey = out.project_key
        if (typeof out.start_date !== 'undefined' && !out.startDate) out.startDate = formatDateSafe(out.start_date)
        if (typeof out.end_date !== 'undefined' && !out.endDate) out.endDate = formatDateSafe(out.end_date)
        if (typeof out.id !== 'undefined') out.id = String(out.id)
        return out
      } catch (e) { return p }
    }

    const projects = Array.isArray(data.projects) ? data.projects.map(normalizeProject) : []
    // If persisted or returned projects contain malformed date strings (e.g. "[object Object]")
    // try a direct fallback to the local Express API on :3001 which is commonly used in dev.
    const hasBadDates = projects.some((p: any) => typeof p.startDate === 'string' && p.startDate.includes('[object'))
    if (hasBadDates && typeof window !== 'undefined') {
      try {
        const fallbackRes = await fetch((window.location.origin.includes(':3000') ? window.location.origin.replace(':3000', ':3001') : 'http://localhost:3001') + '/api/db/data')
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json()
          if (fallbackData && Array.isArray(fallbackData.projects)) {
            const fallbackProjects = fallbackData.projects.map(normalizeProject)
            // prefer fallback projects which come from the DB
            useDataStore.setState({ projects: fallbackProjects })
          }
          if (fallbackData && Array.isArray(fallbackData.project_accounting)) {
            const pa = fallbackData.project_accounting.map((a: any) => {
              try { return a.accounting ? (typeof a.accounting === 'string' ? JSON.parse(a.accounting) : a.accounting) : a } catch (e) { return a }
            })
            useDataStore.setState({ projectAccounting: pa || [] })
          }
        }
      } catch (e) {
        // ignore fallback errors
      }
    }
    const projectAccounting = Array.isArray(data.project_accounting) ? data.project_accounting.map((a: any) => {
      try {
        const acct = a.accounting && typeof a.accounting === 'string' ? JSON.parse(a.accounting) : a.accounting || {}
        return acct
      } catch (e) { return a }
    }) : (data.projectAccounting || [])

    useDataStore.setState({
      notifications: data.notifications || [],
      leads: data.leads || [],
      contacts: data.contacts || [],
      deals: data.deals || [],
      products: data.products || [],
      projects,
      projectAccounting: projectAccounting || [],
      navigation: data.navigation || [],
      complaints: data.complaints || [],
      cases: data.cases || [],
      activities: data.activities || [],
      workflows: data.workflows || [],
      // teamMembers removed — ignore data.teamMembers from API
      tasks: data.tasks || [],
    })
  } catch (err) {
    // do not break the app if fetch fails
    // eslint-disable-next-line no-console
    console.error('initializeDataStore error', err)
  }
}
