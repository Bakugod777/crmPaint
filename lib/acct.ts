import { q, exec, round2 } from "@/lib/db"

// Weighted average purchase cost of a material; falls back to catalog unit_cost.
export async function avgCost(materialId: number): Promise<number> {
  const r = (await q("SELECT SUM(total) t, SUM(quantity) qn FROM material_purchases WHERE material_id = ?", [materialId]))[0]
  if (r && Number(r.qn) > 0) return round2(Number(r.t) / Number(r.qn))
  const m = (await q("SELECT unit_cost FROM materials WHERE id = ?", [materialId]))[0]
  return round2(m?.unit_cost || 0)
}

// Recompute invoices.paid / status from invoice_payments.
// If an invoice had a legacy manual "paid" amount and no payment rows yet, that amount is
// first preserved as an opening payment row so history is not lost.
export async function ensureLegacyOpening(invoiceId: number, userId?: number) {
  const inv = (await q("SELECT id, date, paid FROM invoices WHERE id = ?", [invoiceId]))[0]
  if (!inv) return
  const c = (await q("SELECT COUNT(*) n FROM invoice_payments WHERE invoice_id = ?", [invoiceId]))[0]
  if (Number(c.n) === 0 && Number(inv.paid) > 0) {
    await exec("INSERT INTO invoice_payments (invoice_id, pay_date, amount, method, notes, created_by) VALUES (?, ?, ?, 'legacy', 'Saldo pagado antes del módulo de abonos', ?)",
      [invoiceId, inv.date || new Date().toISOString().slice(0, 10), round2(inv.paid), userId || null])
  }
}

export async function recomputeInvoice(invoiceId: number) {
  const inv = (await q("SELECT id, amount, due_date, status FROM invoices WHERE id = ?", [invoiceId]))[0]
  if (!inv) return
  const s = (await q("SELECT COALESCE(SUM(amount),0) p FROM invoice_payments WHERE invoice_id = ?", [invoiceId]))[0]
  const paid = round2(s.p)
  const amount = round2(inv.amount)
  const today = localToday()
  let status = "pending"
  if (amount > 0 && paid >= amount) status = "paid"
  else if (paid > 0) status = "partial"
  if (status !== "paid" && inv.due_date && inv.due_date < today) status = "overdue"
  await exec("UPDATE invoices SET paid = ?, status = ? WHERE id = ?", [paid, status, invoiceId])
}

export function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function daysBetween(a: string, b: string): number {
  return Math.floor((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000)
}
