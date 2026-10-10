import { NextResponse } from "next/server"
import { guard, isResponse } from "@/lib/api-guard"
import { q, round2, isDate } from "@/lib/db"
import { localToday, daysBetween } from "@/lib/acct"

// Company accounting summary for a date range (default: current month).
//  P&L (accrual): revenue = invoices issued; costs = materials consumed + labor earned (attendance + bonuses) + expenses
//  Cash flow: in = invoice payments; out = expenses + purchases paid in cash + supplier payments + employee payments/advances
//  Balances as of `to`: receivables with aging, payables, payroll owed.
export async function GET(request: Request) {
  const __auth = await guard(request); if (isResponse(__auth)) return __auth
  try {
    const url = new URL(request.url)
    const today = localToday()
    const to = isDate(url.searchParams.get("to")) ? url.searchParams.get("to")! : today
    const from = isDate(url.searchParams.get("from")) ? url.searchParams.get("from")! : to.slice(0, 8) + "01"
    const R = [from, to]
    const one = async (sql: string, p: any[] = R) => Number((await q(sql, p))[0]?.v || 0)

    // ---------- P&L ----------
    const revenue = await one("SELECT COALESCE(SUM(amount),0) v FROM invoices WHERE date BETWEEN ? AND ? AND status <> 'cancelled'")
    const materials = await one("SELECT COALESCE(SUM(total),0) v FROM material_usage WHERE usage_date BETWEEN ? AND ?")
    const laborAtt = await one("SELECT COALESCE(SUM(amount),0) v FROM employee_attendance WHERE work_date BETWEEN ? AND ?")
    const bonuses = await one("SELECT COALESCE(SUM(amount),0) v FROM employee_payments WHERE type='bonus' AND pay_date BETWEEN ? AND ?")
    const deductions = await one("SELECT COALESCE(SUM(amount),0) v FROM employee_payments WHERE type='deduction' AND pay_date BETWEEN ? AND ?")
    const labor = round2(laborAtt + bonuses - deductions)
    const expRows = await q("SELECT category, COALESCE(SUM(amount),0) total FROM expenses WHERE expense_date BETWEEN ? AND ? GROUP BY category ORDER BY total DESC", R)
    const expenses = round2(expRows.reduce((s: number, r: any) => s + Number(r.total), 0))
    const costs = round2(materials + labor + expenses)
    const net = round2(revenue - costs)

    // ---------- Cash ----------
    const cashIn = await one("SELECT COALESCE(SUM(amount),0) v FROM invoice_payments WHERE pay_date BETWEEN ? AND ?")
    const outExpenses = expenses
    const outPurchases = await one("SELECT COALESCE(SUM(total),0) v FROM material_purchases WHERE payment_status='paid' AND purchase_date BETWEEN ? AND ?")
    const outSuppliers = await one("SELECT COALESCE(SUM(amount),0) v FROM supplier_payments WHERE pay_date BETWEEN ? AND ?")
    const outPayroll = await one("SELECT COALESCE(SUM(amount),0) v FROM employee_payments WHERE type IN ('payment','advance') AND pay_date BETWEEN ? AND ?")
    const cashOut = round2(outExpenses + outPurchases + outSuppliers + outPayroll)

    // ---------- Receivables (as of `to`) with aging ----------
    const invs = await q(
      `SELECT i.id, i.client, i.project, i.date, i.due_date, i.amount, i.paid,
              (SELECT COUNT(*) FROM invoice_payments p WHERE p.invoice_id = i.id) AS npay,
              (SELECT COALESCE(SUM(amount),0) FROM invoice_payments p WHERE p.invoice_id = i.id AND p.pay_date <= ?) AS paid_to
       FROM invoices i WHERE i.date <= ? AND i.status <> 'cancelled'`, [to, to])
    const accounts = await q("SELECT client_name, credit_limit, payment_terms_days FROM client_accounts")
    const acctBy: Record<string, any> = {}
    for (const a of accounts) acctBy[a.client_name] = a
    const clients: Record<string, any> = {}
    const aging = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90p: 0 }
    const openInvoices: any[] = []
    for (const i of invs) {
      const paid = Number(i.npay) > 0 ? Number(i.paid_to) : Number(i.paid)
      const bal = round2(Number(i.amount) - paid)
      const name = i.client || "(sin cliente)"
      const c = (clients[name] ||= { client: name, invoiced: 0, paid: 0, balance: 0, current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90p: 0, invoices: 0, oldest: null })
      c.invoiced += Number(i.amount); c.paid += paid; c.invoices++
      if (bal > 0.004) {
        const terms = acctBy[name]?.payment_terms_days ?? 30
        const due = i.due_date || addDays(i.date, terms)
        const late = daysBetween(due, to)
        const bucket = late <= 0 ? "current" : late <= 30 ? "d1_30" : late <= 60 ? "d31_60" : late <= 90 ? "d61_90" : "d90p"
        c[bucket] += bal; (aging as any)[bucket] += bal; c.balance += bal
        if (!c.oldest || i.date < c.oldest) c.oldest = i.date
        openInvoices.push({ id: i.id, client: name, project: i.project, date: i.date, due, amount: Number(i.amount), paid: round2(paid), balance: bal, daysLate: Math.max(0, late), bucket })
      }
    }
    for (const name of Object.keys(acctBy)) clients[name] ||= { client: name, invoiced: 0, paid: 0, balance: 0, current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90p: 0, invoices: 0, oldest: null }
    const clientList = Object.values(clients).map((c: any) => {
      const lim = Number(acctBy[c.client]?.credit_limit || 0)
      const o: any = {}
      for (const k of Object.keys(c)) o[k] = typeof c[k] === "number" && k !== "invoices" ? round2(c[k]) : c[k]
      return { ...o, creditLimit: lim, availableCredit: lim > 0 ? round2(lim - c.balance) : null, overLimit: lim > 0 && c.balance > lim, termsDays: acctBy[c.client]?.payment_terms_days ?? 30 }
    }).sort((a: any, b: any) => b.balance - a.balance)
    for (const k of Object.keys(aging)) (aging as any)[k] = round2((aging as any)[k])
    const receivable = round2(Object.values(aging).reduce((s, v) => s + v, 0))

    // ---------- Payables (suppliers, as of `to`) ----------
    const sup = await q(
      `SELECT s.id, s.name,
         COALESCE((SELECT SUM(total) FROM material_purchases p WHERE p.supplier_id = s.id AND p.payment_status='credit' AND p.purchase_date <= ?),0) AS credit_purchases,
         COALESCE((SELECT SUM(amount) FROM supplier_payments sp WHERE sp.supplier_id = s.id AND sp.pay_date <= ?),0) AS payments,
         COALESCE((SELECT SUM(total) FROM material_purchases p WHERE p.supplier_id = s.id AND p.purchase_date BETWEEN ? AND ?),0) AS purchased_period,
         (SELECT MIN(due_date) FROM material_purchases p WHERE p.supplier_id = s.id AND p.payment_status='credit' AND p.due_date IS NOT NULL) AS next_due
       FROM suppliers s ORDER BY s.name`, [to, to, from, to])
    const suppliers = sup.map((s: any) => ({ ...s, balance: round2(Number(s.credit_purchases) - Number(s.payments)) }))
    const payable = round2(suppliers.reduce((t: number, s: any) => t + Math.max(0, s.balance), 0))

    // ---------- Payroll per employee ----------
    const emp = await q(
      `SELECT e.id, e.name, e.position, e.pay_type, e.pay_rate, e.status,
         COALESCE(a.days,0) days, COALESCE(a.hours,0) hours, COALESCE(a.amount,0) earned, COALESCE(a.n,0) entries,
         COALESCE(pp.payment,0) paid, COALESCE(pp.advance,0) advance, COALESCE(pp.bonus,0) bonus, COALESCE(pp.deduction,0) deduction,
         COALESCE(at.amount,0) + COALESCE(pt.bonus,0) - COALESCE(pt.payment,0) - COALESCE(pt.advance,0) - COALESCE(pt.deduction,0) AS owed_total
       FROM employees e
       LEFT JOIN (SELECT employee_id, SUM(days) days, SUM(hours) hours, SUM(amount) amount, COUNT(*) n FROM employee_attendance WHERE work_date BETWEEN ? AND ? GROUP BY employee_id) a ON a.employee_id = e.id
       LEFT JOIN (SELECT employee_id, SUM(CASE WHEN type='payment' THEN amount ELSE 0 END) payment, SUM(CASE WHEN type='advance' THEN amount ELSE 0 END) advance,
                         SUM(CASE WHEN type='bonus' THEN amount ELSE 0 END) bonus, SUM(CASE WHEN type='deduction' THEN amount ELSE 0 END) deduction
                  FROM employee_payments WHERE pay_date BETWEEN ? AND ? GROUP BY employee_id) pp ON pp.employee_id = e.id
       LEFT JOIN (SELECT employee_id, SUM(amount) amount FROM employee_attendance WHERE work_date <= ? GROUP BY employee_id) at ON at.employee_id = e.id
       LEFT JOIN (SELECT employee_id, SUM(CASE WHEN type='payment' THEN amount ELSE 0 END) payment, SUM(CASE WHEN type='advance' THEN amount ELSE 0 END) advance,
                         SUM(CASE WHEN type='bonus' THEN amount ELSE 0 END) bonus, SUM(CASE WHEN type='deduction' THEN amount ELSE 0 END) deduction
                  FROM employee_payments WHERE pay_date <= ? GROUP BY employee_id) pt ON pt.employee_id = e.id
       ORDER BY e.status, e.name`, [from, to, from, to, to, to])
    const employees = emp.map((e: any) => {
      const o: any = { ...e }
      for (const k of ["days", "hours", "earned", "paid", "advance", "bonus", "deduction", "owed_total", "pay_rate"]) o[k] = round2(e[k])
      o.period_net = round2(o.earned + o.bonus - o.deduction - o.paid - o.advance)
      return o
    })
    const payrollOwed = round2(employees.reduce((t: number, e: any) => t + Math.max(0, e.owed_total), 0))

    // ---------- Projects profitability (range) ----------
    const projs = await q(
      `SELECT p.id, p.project_key, p.name, p.client, p.status, p.budget, p.start_date, p.end_date,
         COALESCE((SELECT SUM(amount) FROM invoices i WHERE (i.project = p.name OR i.project = p.project_key) AND i.date BETWEEN ? AND ? AND i.status <> 'cancelled'),0) AS invoiced,
         COALESCE((SELECT SUM(ip.amount) FROM invoice_payments ip JOIN invoices i ON i.id = ip.invoice_id WHERE (i.project = p.name OR i.project = p.project_key) AND ip.pay_date BETWEEN ? AND ?),0) AS collected,
         COALESCE((SELECT SUM(total) FROM material_usage u WHERE u.project_id = p.id AND u.usage_date BETWEEN ? AND ?),0) AS materials,
         COALESCE((SELECT SUM(amount) FROM employee_attendance a WHERE a.project_id = p.id AND a.work_date BETWEEN ? AND ?),0) AS labor,
         COALESCE((SELECT SUM(days) FROM employee_attendance a WHERE a.project_id = p.id AND a.work_date BETWEEN ? AND ?),0) AS labor_days,
         COALESCE((SELECT SUM(amount) FROM expenses x WHERE x.project_id = p.id AND x.expense_date BETWEEN ? AND ?),0) AS expenses
       FROM projects p ORDER BY p.id DESC`, [from, to, from, to, from, to, from, to, from, to, from, to])
    const projects = projs.map((p: any) => {
      const cost = round2(Number(p.materials) + Number(p.labor) + Number(p.expenses))
      const profit = round2(Number(p.invoiced) - cost)
      return { ...p, budget: round2(p.budget), cost, profit, margin: Number(p.invoiced) > 0 ? round2((profit / Number(p.invoiced)) * 100) : null }
    }).filter((p: any) => p.invoiced || p.cost || p.collected || p.status === "IN_PROGRESS")

    // ---------- Monthly series ----------
    const series: Record<string, any> = {}
    const add = (rows: any[], key: string) => { for (const r of rows) { (series[r.m] ||= { month: r.m, revenue: 0, costs: 0, cashIn: 0, cashOut: 0 })[key] += Number(r.v) } }
    add(await q("SELECT DATE_FORMAT(date,'%Y-%m') m, SUM(amount) v FROM invoices WHERE date BETWEEN ? AND ? AND status <> 'cancelled' GROUP BY m", R), "revenue")
    add(await q("SELECT DATE_FORMAT(usage_date,'%Y-%m') m, SUM(total) v FROM material_usage WHERE usage_date BETWEEN ? AND ? GROUP BY m", R), "costs")
    add(await q("SELECT DATE_FORMAT(work_date,'%Y-%m') m, SUM(amount) v FROM employee_attendance WHERE work_date BETWEEN ? AND ? GROUP BY m", R), "costs")
    add(await q("SELECT DATE_FORMAT(expense_date,'%Y-%m') m, SUM(amount) v FROM expenses WHERE expense_date BETWEEN ? AND ? GROUP BY m", R), "costs")
    add(await q("SELECT DATE_FORMAT(pay_date,'%Y-%m') m, SUM(CASE WHEN type='bonus' THEN amount WHEN type='deduction' THEN -amount ELSE 0 END) v FROM employee_payments WHERE pay_date BETWEEN ? AND ? GROUP BY m", R), "costs")
    add(await q("SELECT DATE_FORMAT(pay_date,'%Y-%m') m, SUM(amount) v FROM invoice_payments WHERE pay_date BETWEEN ? AND ? GROUP BY m", R), "cashIn")
    add(await q(`SELECT m, SUM(v) v FROM (
        SELECT DATE_FORMAT(expense_date,'%Y-%m') m, amount v FROM expenses WHERE expense_date BETWEEN ? AND ?
        UNION ALL SELECT DATE_FORMAT(purchase_date,'%Y-%m'), total FROM material_purchases WHERE payment_status='paid' AND purchase_date BETWEEN ? AND ?
        UNION ALL SELECT DATE_FORMAT(pay_date,'%Y-%m'), amount FROM supplier_payments WHERE pay_date BETWEEN ? AND ?
        UNION ALL SELECT DATE_FORMAT(pay_date,'%Y-%m'), amount FROM employee_payments WHERE type IN ('payment','advance') AND pay_date BETWEEN ? AND ?
      ) x GROUP BY m`, [...R, ...R, ...R, ...R]), "cashOut")
    const monthly = Object.values(series).sort((a: any, b: any) => a.month.localeCompare(b.month)).map((s: any) => ({ ...s, revenue: round2(s.revenue), costs: round2(s.costs), cashIn: round2(s.cashIn), cashOut: round2(s.cashOut), profit: round2(s.revenue - s.costs) }))

    // ---------- Inventory ----------
    const inv = (await q(`SELECT COALESCE(SUM(GREATEST(stock,0) * avg_cost),0) v, SUM(stock <= min_stock AND active = 1) low FROM (
        SELECT m.min_stock, m.active, COALESCE(pu.qty,0) - COALESCE(us.qty,0) stock,
               CASE WHEN COALESCE(pu.qty,0) > 0 THEN pu.total / pu.qty ELSE m.unit_cost END avg_cost
        FROM materials m
        LEFT JOIN (SELECT material_id, SUM(quantity) qty, SUM(total) total FROM material_purchases GROUP BY material_id) pu ON pu.material_id = m.id
        LEFT JOIN (SELECT material_id, SUM(quantity) qty FROM material_usage GROUP BY material_id) us ON us.material_id = m.id) z`))[0]

    return NextResponse.json({
      ok: true, from, to,
      pnl: { revenue: round2(revenue), materials: round2(materials), labor, laborAttendance: round2(laborAtt), bonuses: round2(bonuses), deductions: round2(deductions), expenses, expensesByCategory: expRows.map((r: any) => ({ category: r.category, total: round2(r.total) })), costs, net, margin: revenue > 0 ? round2((net / revenue) * 100) : null },
      cash: { in: round2(cashIn), out: cashOut, net: round2(cashIn - cashOut), outExpenses, outPurchases: round2(outPurchases), outSuppliers: round2(outSuppliers), outPayroll: round2(outPayroll) },
      receivables: { total: receivable, aging, clients: clientList, openInvoices: openInvoices.sort((a, b) => b.daysLate - a.daysLate), topDebtors: clientList.filter((c: any) => c.balance > 0).slice(0, 5) },
      payables: { total: payable, suppliers },
      payroll: { owed: payrollOwed, employees },
      projects,
      monthly,
      inventory: { value: round2(inv?.v || 0), lowStock: Number(inv?.low || 0) },
    })
  } catch (err) {
    console.error("[accounting summary]", err)
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }
}

function addDays(d: string, n: number) {
  const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + Number(n || 0))
  return t.toISOString().slice(0, 10)
}
