import mysql from "mysql2/promise"
import dbConfig from "@/lib/db-config"

// Shared connection pool (cached across hot reloads / route modules).
// dateStrings: DATE columns come back as 'YYYY-MM-DD' (no timezone shift)
// decimalNumbers: DECIMAL columns come back as JS numbers.
const g = globalThis as any

export function getPool(): mysql.Pool {
  if (!g.__ppPool) {
    g.__ppPool = mysql.createPool({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      waitForConnections: true,
      connectionLimit: 10,
      dateStrings: true,
      decimalNumbers: true,
    })
  }
  return g.__ppPool
}

export async function q<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await getPool().query(sql, params)
  return rows as T[]
}

export async function exec(sql: string, params: any[] = []): Promise<{ insertId: number; affectedRows: number }> {
  const [res] = await getPool().query(sql, params)
  return res as any
}

export const round2 = (n: any) => Math.round((Number(n) || 0) * 100) / 100

export function isDate(s: any): boolean {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s)
}
