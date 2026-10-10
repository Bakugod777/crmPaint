import { NextResponse } from "next/server"
import { q, exec, round2, isDate } from "@/lib/db"
import { guard, isResponse, type ApiUser } from "@/lib/api-guard"

export type FieldType = "str" | "text" | "int" | "money" | "qty" | "date" | "bool"

export interface CrudConfig {
  table: string
  fields: Record<string, FieldType>
  required?: string[]
  dateField?: string // used for ?from=&to= filters
  filters?: string[] // query params allowed as equality filters (same name as column)
  select?: string // custom SELECT ... FROM table t LEFT JOIN ... (must alias main table as t)
  orderBy?: string
  selfColumn?: string // non-staff callers only see rows where this column = their employee id
  enums?: Record<string, string[]>
  beforeSave?: (row: Record<string, any>, ctx: { user: ApiUser; existing?: any; isNew: boolean }) => Promise<Record<string, any> | string>
  afterSave?: (id: number, row: Record<string, any>, ctx: { user: ApiUser; isNew: boolean; body: any }) => Promise<void>
  beforeDelete?: (id: number, existing: any) => Promise<string | void>
  afterDelete?: (id: number, existing: any) => Promise<void>
}

export function coerce(type: FieldType, v: any): any {
  if (v === undefined) return undefined
  if (v === null || v === "") return type === "str" || type === "text" ? (v === "" ? "" : null) : null
  switch (type) {
    case "str": return String(v).slice(0, 255)
    case "text": return String(v).slice(0, 5000)
    case "int": { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null }
    case "money": return round2(v)
    case "qty": return Math.round((Number(v) || 0) * 1000) / 1000
    case "date": return isDate(String(v).slice(0, 10)) ? String(v).slice(0, 10) : null
    case "bool": return v === true || v === 1 || v === "1" || v === "true" ? 1 : 0
  }
}

function pick(cfg: CrudConfig, body: any, isNew: boolean): Record<string, any> | string {
  const row: Record<string, any> = {}
  for (const [k, t] of Object.entries(cfg.fields)) {
    if (body && Object.prototype.hasOwnProperty.call(body, k)) {
      const v = coerce(t, body[k])
      if (t === "date" && body[k] && v === null) return `Invalid date for ${k} (YYYY-MM-DD)`
      if (cfg.enums?.[k] && v != null && !cfg.enums[k].includes(String(v))) return `Invalid value for ${k}`
      row[k] = v
    }
  }
  if (isNew) for (const r of cfg.required || []) if (row[r] === undefined || row[r] === null || row[r] === "") return `Missing field ${r}`
  return row
}

const bad = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status })

export function makeCrud(cfg: CrudConfig) {
  const base = cfg.select || `SELECT t.* FROM ${cfg.table} t`

  async function list(request: Request, user: ApiUser) {
    const url = new URL(request.url)
    const where: string[] = []
    const params: any[] = []
    const id = url.searchParams.get("id")
    if (id) { where.push("t.id = ?"); params.push(Number(id)) }
    const from = url.searchParams.get("from"), to = url.searchParams.get("to")
    if (cfg.dateField && from && isDate(from)) { where.push(`t.${cfg.dateField} >= ?`); params.push(from) }
    if (cfg.dateField && to && isDate(to)) { where.push(`t.${cfg.dateField} <= ?`); params.push(to) }
    for (const f of cfg.filters || []) {
      const v = url.searchParams.get(f)
      if (v !== null && v !== "") { where.push(`t.${f} = ?`); params.push(v) }
    }
    if (cfg.selfColumn && !user.staff) { where.push(`t.${cfg.selfColumn} = ?`); params.push(user.employeeId ?? -1) }
    const sql = `${base}${where.length ? " WHERE " + where.join(" AND ") : ""} ORDER BY ${cfg.orderBy || "t.id DESC"} LIMIT 5000`
    return NextResponse.json({ ok: true, rows: await q(sql, params) })
  }

  async function insertOne(body: any, user: ApiUser): Promise<number | string> {
    let row = pick(cfg, body, true)
    if (typeof row === "string") return row
    if (cfg.beforeSave) { row = await cfg.beforeSave(row, { user, isNew: true }); if (typeof row === "string") return row }
    if ("created_by" in cfg.fields || false) row.created_by = user.id
    const cols = Object.keys(row)
    if (!cols.length) return "Empty record"
    const r = await exec(`INSERT INTO ${cfg.table} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`, cols.map((c) => row[c]))
    if (cfg.afterSave) await cfg.afterSave(r.insertId, row, { user, isNew: true, body })
    return r.insertId
  }

  const GET = async (request: Request) => {
    const user = await guard(request); if (isResponse(user)) return user
    try { return await list(request, user) } catch (e) { console.error(`[${cfg.table} GET]`, e); return bad("DB error", 500) }
  }

  const POST = async (request: Request) => {
    const user = await guard(request); if (isResponse(user)) return user
    try {
      const body = await request.json().catch(() => null)
      if (!body) return bad("Invalid JSON")
      const entries = Array.isArray(body.entries) ? body.entries : [body]
      if (entries.length > 500) return bad("Too many entries")
      const ids: number[] = []
      for (const e of entries) {
        const r = await insertOne(e, user)
        if (typeof r === "string") return bad(r + (ids.length ? ` (after ${ids.length} saved)` : ""))
        ids.push(r)
      }
      return NextResponse.json({ ok: true, id: ids[0], ids }, { status: 201 })
    } catch (e) { console.error(`[${cfg.table} POST]`, e); return bad("DB error", 500) }
  }

  const PUT = async (request: Request) => {
    const user = await guard(request); if (isResponse(user)) return user
    try {
      const body = await request.json().catch(() => null)
      const id = Number(body?.id)
      if (!id) return bad("Missing id")
      const existing = (await q(`SELECT * FROM ${cfg.table} WHERE id = ?`, [id]))[0]
      if (!existing) return bad("Not found", 404)
      let row = pick(cfg, body, false)
      if (typeof row === "string") return bad(row)
      if (cfg.beforeSave) { row = await cfg.beforeSave(row, { user, existing, isNew: false }); if (typeof row === "string") return bad(row) }
      delete row.created_by
      const cols = Object.keys(row)
      if (cols.length) await exec(`UPDATE ${cfg.table} SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`, [...cols.map((c) => row[c]), id])
      if (cfg.afterSave) await cfg.afterSave(id, { ...existing, ...row }, { user, isNew: false, body })
      return NextResponse.json({ ok: true, id })
    } catch (e) { console.error(`[${cfg.table} PUT]`, e); return bad("DB error", 500) }
  }

  const DELETE = async (request: Request) => {
    const user = await guard(request); if (isResponse(user)) return user
    try {
      const id = Number(new URL(request.url).searchParams.get("id"))
      if (!id) return bad("Missing id")
      const existing = (await q(`SELECT * FROM ${cfg.table} WHERE id = ?`, [id]))[0]
      if (!existing) return bad("Not found", 404)
      if (cfg.beforeDelete) { const m = await cfg.beforeDelete(id, existing); if (m) return bad(m, 409) }
      await exec(`DELETE FROM ${cfg.table} WHERE id = ?`, [id])
      if (cfg.afterDelete) await cfg.afterDelete(id, existing)
      return NextResponse.json({ ok: true })
    } catch (e) { console.error(`[${cfg.table} DELETE]`, e); return bad("DB error", 500) }
  }

  return { GET, POST, PUT, DELETE }
}
