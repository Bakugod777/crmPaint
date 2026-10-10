"use client"
import { formatUSD } from "@/lib/money"

import { useCallback, useEffect, useState } from "react"

// ---- dates (local, no UTC shift) ----
export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
export function monthStartStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}
export function addDaysStr(s: string, n: number) {
  const d = new Date(s + "T12:00:00")
  d.setDate(d.getDate() + n)
  return todayStr(d)
}
export function fmtDate(s: string | null | undefined, locale: string) {
  if (!s) return ""
  const d = new Date(String(s).slice(0, 10) + "T12:00:00")
  if (isNaN(d.getTime())) return String(s)
  return d.toLocaleDateString(locale === "es" ? "es-US" : "en-US", { year: "numeric", month: "short", day: "2-digit" })
}

// ---- money (USD) ----
// One format everywhere (en-US USD "$3,140.00"); `locale` kept for call compatibility only.
export function fmtMoney(n: any, _locale = "es") {
  return formatUSD(n)
}
export function fmtNum(n: any, digits = 2) {
  const v = Number(n) || 0
  return v.toLocaleString("en-US", { maximumFractionDigits: digits })
}

// ---- API (same origin, cookie session). 401 -> back to login ----
export async function api<T = any>(path: string, opts: { method?: string; body?: any; params?: Record<string, any> } = {}): Promise<T> {
  const qs = opts.params
    ? "?" + Object.entries(opts.params).filter(([, v]) => v !== undefined && v !== null && v !== "" && v !== "all").map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&")
    : ""
  const resp = await fetch(`/api/db/${path}${qs}`, {
    method: opts.method || "GET",
    credentials: "same-origin",
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  })
  if (resp.status === 401 && typeof window !== "undefined") {
    try { localStorage.removeItem("paint-power-auth") } catch {}
    window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname)
    throw new Error("Not authenticated")
  }
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error((data as any)?.error || `HTTP ${resp.status}`)
  return data as T
}

export function useResource<T = any>(path: string, params: Record<string, any> = {}) {
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const key = JSON.stringify(params)
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const d: any = await api(path, { params })
      setRows(d.rows || d.invoices || [])
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key])
  useEffect(() => { reload() }, [reload])
  const create = async (body: any) => { const r = await api(path, { method: "POST", body }); await reload(); return r }
  const update = async (body: any) => { const r = await api(path, { method: "PUT", body }); await reload(); return r }
  const remove = async (id: any) => { const r = await api(path, { method: "DELETE", params: { id } }); await reload(); return r }
  return { rows, loading, error, reload, create, update, remove, setRows }
}

// ---- CSV export ----
export function downloadCSV(filename: string, rows: any[], columns?: { key: string; label: string }[]) {
  if (!rows.length) return
  const cols = columns || Object.keys(rows[0]).map((k) => ({ key: k, label: k }))
  const esc = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v)
    const safe = /^[=+\-@]/.test(s) && isNaN(Number(s)) ? "'" + s : s // avoid CSV formula injection
    return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }
  const csv = [cols.map((c) => esc(c.label)).join(","), ...rows.map((r) => cols.map((c) => esc(r[c.key])).join(","))].join("\n")
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export const EXPENSE_CATEGORIES = ["fuel", "vehicle", "tools", "equipment_rental", "subcontractor", "insurance", "permits", "office", "marketing", "utilities", "meals", "other"]
export const PAYMENT_METHODS = ["cash", "transfer", "zelle", "check", "card", "other"]

// Projects for selects (existing /api/db/projects returns a plain array)
export function useProjectsList() {
  const [projects, setProjects] = useState<{ id: number; name: string; client?: string; status?: string }[]>([])
  useEffect(() => {
    fetch("/api/db/projects", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => setProjects(Array.isArray(rows) ? rows.map((p: any) => ({ id: Number(p.id), name: p.name || `#${p.id}`, client: p.client || "", status: p.status })) : []))
      .catch(() => setProjects([]))
  }, [])
  return projects
}
