import { NextResponse } from "next/server"
import { guard, isResponse } from "@/lib/api-guard"
import { q, round2 } from "@/lib/db"

// The caller's own employee record + attendance/payment totals (for empleado role).
export async function GET(request: Request) {
  const u = await guard(request, "any"); if (isResponse(u)) return u
  let empId = u.employeeId
  if (empId == null) { const e = await q("SELECT id FROM employees WHERE user_id = ? LIMIT 1", [u.id]); empId = e[0]?.id ?? null }
  if (empId == null) return NextResponse.json({ ok: true, user: { id: u.id, name: u.name, role: u.role }, employee: null })
  const employee = (await q("SELECT id, name, position, pay_type, pay_rate, status, start_date FROM employees WHERE id = ?", [empId]))[0]
  const a = (await q("SELECT COUNT(*) n, COALESCE(SUM(days),0) d, COALESCE(SUM(hours),0) h, COALESCE(SUM(amount),0) amt FROM employee_attendance WHERE employee_id = ?", [empId]))[0]
  const p = (await q("SELECT type, COALESCE(SUM(amount),0) s FROM employee_payments WHERE employee_id = ? GROUP BY type", [empId]))
  const by: any = { payment: 0, advance: 0, bonus: 0, deduction: 0 }
  for (const r of p) by[r.type] = Number(r.s)
  const earned = round2(Number(a.amt) + by.bonus)
  const owed = round2(earned - by.payment - by.advance - by.deduction)
  return NextResponse.json({ ok: true, user: { id: u.id, name: u.name, role: u.role }, employee, totals: { entries: Number(a.n), days: Number(a.d), hours: Number(a.h), earned, ...by, owed } })
}
