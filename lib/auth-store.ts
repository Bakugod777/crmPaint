"use client"

import { create } from "zustand"
// avoid top-level import of useDataStore to prevent circular module initialization
import { persist } from "zustand/middleware"

// Roles: admin (todo), contador (finanzas/CRM, sin gestión de usuarios),
// empleado / worker / user (solo sus propios datos).
export type UserRole = "user" | "worker" | "admin" | "contador" | "empleado"

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
  company?: string
  phone?: string
  assignedProjects?: string[] // For workers
  createdBy?: string // Track who created this user
  createdAt: string
}

interface AuthStore {
  user: AuthUser | null
  isAuthenticated: boolean
  users: AuthUser[] // All users in the system (admin only, loaded from server)
  login: (email: string, password: string) => Promise<boolean>
  register: (data: RegisterData) => Promise<boolean>
  logout: () => void
  verifySession: () => Promise<boolean>
  createWorker: (data: CreateWorkerData) => Promise<boolean>
  createAdmin: (data: CreateAdminData) => Promise<boolean>
  createUserWithRole: (data: CreateAdminData & { role: UserRole }) => Promise<boolean>
  updateUser: (id: string, data: Partial<AuthUser>) => Promise<boolean>
  deleteUser: (id: string) => void
  getAllUsers: () => AuthUser[]
  loadUsers: () => Promise<void>
  getWorkers: () => AuthUser[]
  getAdmins: () => AuthUser[]
  submitApplication: (app: { userId: string; name: string; email: string; skills?: string; availability?: string; message?: string; resume?: string }) => Promise<boolean>
  getApplications: () => Promise<any[]>
  reviewApplication: (id: number, status: 'UNDER_REVIEW'|'APPROVED'|'REJECTED', adminResponse?: string) => Promise<boolean>
  resign: (userId: string, reason?: string) => Promise<boolean>
}

export interface RegisterData {
  name: string
  email: string
  password: string
  company?: string
  phone?: string
}

export interface CreateWorkerData {
  name: string
  email: string
  password: string
  phone?: string
  assignedProjects?: string[]
}

export interface CreateAdminData {
  name: string
  email: string
  password: string
  company?: string
  phone?: string
}

// All auth/API calls go to the same origin so the httpOnly session cookie is sent.
const getApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_BASE) return process.env.NEXT_PUBLIC_API_BASE
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

const mapUser = (r: any): AuthUser => ({
  id: String(r.id),
  name: r.name || '',
  email: r.email || '',
  role: (r.role || 'user') as UserRole,
  phone: r.phone || undefined,
  createdAt: r.createdAt || r.created_at || new Date().toISOString(),
})

const jsonPost = (url: string, body: any, method = 'POST') =>
  fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      users: [],

      // Server-side authentication only. The server sets an httpOnly signed session cookie.
      login: async (email: string, password: string) => {
        try {
          const resp = await jsonPost(`${getApiBase()}/api/auth/login`, { email, password })
          if (!resp.ok) return false
          const u = await resp.json()
          set({ user: mapUser(u), isAuthenticated: true })
          return true
        } catch (err) {
          return false
        }
      },

      register: async (data: RegisterData) => {
        try {
          const resp = await jsonPost(`${getApiBase()}/api/auth/register`, data)
          if (!resp.ok) return false
          const u = await resp.json()
          set({ user: { ...mapUser(u), company: data.company }, isAuthenticated: true })
          return true
        } catch (err) {
          return false
        }
      },

      logout: () => {
        set({ user: null, isAuthenticated: false, users: [] })
        try {
          fetch(`${getApiBase()}/api/auth/logout`, { method: 'POST', credentials: 'same-origin' }).catch(() => {})
        } catch (e) {}
      },

      // Confirms the cookie session is still valid; clears local state if not.
      verifySession: async () => {
        try {
          const resp = await fetch(`${getApiBase()}/api/auth/me`, { credentials: 'same-origin', cache: 'no-store' })
          if (!resp.ok) {
            set({ user: null, isAuthenticated: false, users: [] })
            return false
          }
          const u = await resp.json()
          set({ user: mapUser(u), isAuthenticated: true })
          return true
        } catch (e) {
          return get().isAuthenticated
        }
      },

      createUserWithRole: async (data) => {
        const currentUser = get().user
        if (!currentUser || currentUser.role !== 'admin') return false
        try {
          const resp = await jsonPost(`${getApiBase()}/api/db/users`, {
            name: data.name, email: data.email, password: data.password, role: data.role, phone: data.phone,
          })
          if (!resp.ok) {
            if (resp.status === 409) await get().loadUsers()
            return false
          }
          const created = await resp.json()
          set((state) => ({ users: [...state.users.filter((u) => u.id !== String(created.id)), { ...mapUser(created), createdBy: currentUser.id }] }))
          return true
        } catch (err) {
          return false
        }
      },

      createWorker: async (data: CreateWorkerData) => get().createUserWithRole({ ...data, role: 'worker' }),

      createAdmin: async (data: CreateAdminData) => get().createUserWithRole({ ...data, role: 'admin' }),

      updateUser: async (id: string, data: Partial<AuthUser>) => {
        const prev = get().users
        set((state) => ({
          users: state.users.map((u) => (u.id === id ? { ...u, ...data } : u)),
          user: state.user?.id === id ? { ...state.user, ...data } : state.user,
        }))
        try {
          const resp = await jsonPost(`${getApiBase()}/api/db/users/${encodeURIComponent(id)}`, data, 'PUT')
          if (!resp.ok) { set({ users: prev }); return false }
          return true
        } catch (e) {
          set({ users: prev })
          return false
        }
      },

      deleteUser: async (id: string) => {
        const currentUser = get().user
        if (!currentUser || currentUser.role !== 'admin') return
        try {
          const resp = await fetch(`${getApiBase()}/api/db/users/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' })
          if (!resp.ok) return
        } catch (err) {
          return
        }
        set((state) => ({ users: state.users.filter((u) => u.id !== id) }))
      },

      getAllUsers: () => get().users,

      loadUsers: async () => {
        try {
          const resp = await fetch(`${getApiBase()}/api/db/users`, { credentials: 'same-origin' })
          if (!resp.ok) return
          const rows = await resp.json()
          if (!Array.isArray(rows)) return
          set({ users: rows.map(mapUser) })
        } catch (err) {
          // ignore network errors
        }
      },

      getWorkers: () => get().users.filter((u) => u.role === "worker" || u.role === "empleado"),

      getAdmins: () => get().users.filter((u) => u.role === "admin"),

      submitApplication: async (app) => {
        try {
          const resp = await jsonPost(`${getApiBase()}/api/db/apply`, app)
          return resp.ok
        } catch (err) {
          return false
        }
      },

      getApplications: async () => {
        try {
          const resp = await fetch(`${getApiBase()}/api/db/applications`, { credentials: 'same-origin' })
          if (!resp.ok) return []
          return await resp.json()
        } catch (err) {
          return []
        }
      },

      reviewApplication: async (id, status, adminResponse) => {
        try {
          const resp = await jsonPost(`${getApiBase()}/api/db/applications/${id}/review`, { status, adminResponse }, 'PUT')
          if (!resp.ok) return false
          try { await get().loadUsers() } catch (e) {}
          return true
        } catch (err) {
          return false
        }
      },

      // Worker resignation (changes role to user but keeps account)
      resign: async (userId, reason) => {
        try {
          const resp = await jsonPost(`${getApiBase()}/api/db/users/${userId}/resign`, { reason })
          if (!resp.ok) return false
          set((s) => ({ users: s.users.map(u => u.id === String(userId) ? { ...u, role: 'user' } : u), user: s.user && s.user.id === String(userId) ? { ...s.user, role: 'user' } : s.user }))
          return true
        } catch (err) {
          return false
        }
      },
    }),
    {
      name: "paint-power-auth",
      // Only cache the current user's profile for UI; the real session is the httpOnly cookie.
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }) as any,
    },
  ),
)
