import { NextResponse } from "next/server"
import { guard, isResponse } from "@/lib/api-guard"
import { q, round2, isDate } from "@/lib/db"
import { localToday } from "@/lib/acct"

// General journal: every dated money movement in one chronological list.
// cash=1 rows move money (running cash balance); cash=0 rows are accruals (invoice issued,
// labor earned, material consumed, purchase on credit) shown for completeness.
export async function GET(request: Request) {
  const __auth = await guard(request); if (isResponse(__auth)) return __auth
  try {
    const url = new URL(request.url)
    const today = localToday()
    const to = isDate(url.searchParams.get("to")) ? url.searchParams.get("to")! : today
    const from = isDate(url.searchParams.get("from")) ? url.searchParams.get("from")! : to.slice(0, 8) + "01"
    const R = [from, to]
    const rows = await q(`
      SELECT * FROM (
        SELECT i.date AS d, 'invoice' AS kind, i.id AS ref, i.client AS party, i.project AS project, CONCAT('Factura #', i.id) AS descr, i.amount AS income, 0 AS expense, 0 AS cash FROM invoices i WHERE i.date BETWEEN ? AND ? AND i.status <> 'cancelled'
        UNION ALL SELECT p.pay_date, 'invoice_payment', p.id, i.client, i.project, CONCAT('Abono factura #', p.invoice_id, IFNULL(CONCAT(' (', p.method, ')'), '')), p.amount, 0, 1 FROM invoice_payments p LEFT JOIN invoices i ON i.id = p.invoice_id WHERE p.pay_date BETWEEN ? AND ?
        UNION ALL SELECT x.expense_date, 'expense', x.id, x.payee, pr.name, CONCAT(x.category, IFNULL(CONCAT(': ', x.description), '')), 0, x.amount, 1 FROM expenses x LEFT JOIN projects pr ON pr.id = x.project_id WHERE x.expense_date BETWEEN ? AND ?
        UNION ALL SELECT mp.purchase_date, IF(mp.payment_status='paid','purchase','purchase_credit'), mp.id, s.name, pr.name, CONCAT('Compra ', m.name, ' x', mp.quantity), 0, mp.total, IF(mp.payment_status='paid',1,0) FROM material_purchases mp LEFT JOIN materials m ON m.id = mp.material_id LEFT JOIN suppliers s ON s.id = mp.supplier_id LEFT JOIN projects pr ON pr.id = mp.project_id WHERE mp.purchase_date BETWEEN ? AND ?
        UNION ALL SELECT sp.pay_date, 'supplier_payment', sp.id, s.name, NULL, CONCAT('Pago a proveedor', IFNULL(CONCAT(' ', sp.reference), '')), 0, sp.amount, 1 FROM supplier_payments sp LEFT JOIN suppliers s ON s.id = sp.supplier_id WHERE sp.pay_date BETWEEN ? AND ?
        UNION ALL SELECT ep.pay_date, CONCAT('employee_', ep.type), ep.id, e.name, NULL, CONCAT(ep.type, IFNULL(CONCAT(' - ', ep.notes), '')), 0, ep.amount, IF(ep.type IN ('payment','advance'),1,0) FROM employee_payments ep LEFT JOIN employees e ON e.id = ep.employee_id WHERE ep.pay_date BETWEEN ? AND ?
        UNION ALL SELECT a.work_date, 'labor', a.id, e.name, pr.name, CONCAT('Día trabajado ', a.days, 'd / ', a.hours, 'h'), 0, a.amount, 0 FROM employee_attendance a LEFT JOIN employees e ON e.id = a.employee_id LEFT JOIN projects pr ON pr.id = a.project_id WHERE a.work_date BETWEEN ? AND ?
        UNION ALL SELECT u.usage_date, 'material_usage', u.id, NULL, pr.name, CONCAT('Consumo ', m.name, ' x', u.quantity), 0, u.total, 0 FROM material_usage u LEFT JOIN materials m ON m.id = u.material_id LEFT JOIN projects pr ON pr.id = u.project_id WHERE u.usage_date BETWEEN ? AND ?
      ) j ORDER BY d ASC, kind ASC, ref ASC LIMIT 10000`, [...R, ...R, ...R, ...R, ...R, ...R, ...R, ...R])
    let bal = 0
    const entries = rows.map((r: any) => {
      const income = round2(r.income), expense = round2(r.expense)
      if (Number(r.cash) === 1) bal = round2(bal + income - expense)
      return { date: r.d, kind: r.kind, ref: r.ref, party: r.party, project: r.project, description: r.descr, income, expense, cash: Number(r.cash) === 1, cashBalance: bal }
    })
    return NextResponse.json({ ok: true, from, to, entries })
  } catch (err) {
    console.error("[accounting ledger]", err)
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }
}
