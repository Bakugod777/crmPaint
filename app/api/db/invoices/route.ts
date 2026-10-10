import { NextResponse } from "next/server"
import { guard, isResponse } from "@/lib/api-guard"
import { q, exec, round2, isDate } from "@/lib/db"
import { recomputeInvoice, localToday } from "@/lib/acct"

// Invoices (accounts receivable). Money as DECIMAL; dates as YYYY-MM-DD strings.
// Optional line items (invoice_items) from the price list; amount = sum(items) when items are sent.

type Item = { item_type?: string; ref_id?: number | null; description: string; quantity: number; unit_price: number }

function cleanItems(items: any): Item[] | null {
  if (!Array.isArray(items)) return null
  return items
    .filter((i) => i && (i.description || i.ref_id))
    .slice(0, 200)
    .map((i) => ({
      item_type: ["product", "material", "tax", "custom"].includes(i.item_type) ? i.item_type : "custom",
      ref_id: i.ref_id ? Number(i.ref_id) : null,
      description: String(i.description || "").slice(0, 255),
      quantity: Math.round((Number(i.quantity) || 0) * 1000) / 1000,
      unit_price: round2(i.unit_price),
    }))
}

async function saveItems(invoiceId: number, items: Item[]) {
  await exec("DELETE FROM invoice_items WHERE invoice_id = ?", [invoiceId])
  let sum = 0
  for (const it of items) {
    const total = round2(it.quantity * it.unit_price)
    sum += total
    await exec("INSERT INTO invoice_items (invoice_id, item_type, ref_id, description, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [invoiceId, it.item_type, it.ref_id, it.description, it.quantity, it.unit_price, total])
  }
  return round2(sum)
}

export async function GET(request: Request) {
  const __auth = await guard(request); if (isResponse(__auth)) return __auth
  try {
    const url = new URL(request.url)
    const where: string[] = []; const p: any[] = []
    const from = url.searchParams.get("from"), to = url.searchParams.get("to"), client = url.searchParams.get("client"), id = url.searchParams.get("id")
    if (id) { where.push("i.id = ?"); p.push(Number(id)) }
    if (from && isDate(from)) { where.push("i.date >= ?"); p.push(from) }
    if (to && isDate(to)) { where.push("i.date <= ?"); p.push(to) }
    if (client) { where.push("i.client = ?"); p.push(client) }
    const rows = await q(
      `SELECT i.id, i.client, i.project, i.date, i.due_date AS dueDate, i.amount, i.paid, i.status,
              (SELECT COUNT(*) FROM invoice_items it WHERE it.invoice_id = i.id) AS itemCount,
              (SELECT MAX(pay_date) FROM invoice_payments ip WHERE ip.invoice_id = i.id) AS lastPayment
       FROM invoices i ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY i.date DESC, i.id DESC LIMIT 5000`, p)
    const today = localToday()
    const out = rows.map((r: any) => {
      const balance = round2(Number(r.amount) - Number(r.paid))
      const overdue = balance > 0 && r.dueDate && r.dueDate < today
      return { ...r, amount: Number(r.amount), paid: Number(r.paid), balance, status: r.status === "paid" || balance <= 0 && Number(r.amount) > 0 ? "paid" : overdue ? "overdue" : r.status }
    })
    if (id) {
      const items = await q("SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id", [Number(id)])
      const payments = await q("SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY pay_date, id", [Number(id)])
      return NextResponse.json({ ok: true, invoices: out, items, payments })
    }
    return NextResponse.json({ ok: true, invoices: out })
  } catch (err) {
    console.error("[invoices GET]", err)
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const __auth = await guard(request); if (isResponse(__auth)) return __auth
  try {
    const b: any = await request.json()
    const date = isDate(b.date) ? b.date : localToday()
    const dueDate = isDate(b.dueDate) ? b.dueDate : null
    const items = cleanItems(b.items)
    const r = await exec("INSERT INTO invoices (client, project, date, due_date, amount, paid, status) VALUES (?, ?, ?, ?, ?, 0, 'pending')",
      [String(b.client || "").slice(0, 255), String(b.project || "").slice(0, 255), date, dueDate, round2(b.amount)])
    if (items && items.length) {
      const sum = await saveItems(r.insertId, items)
      await exec("UPDATE invoices SET amount = ? WHERE id = ?", [sum, r.insertId])
    }
    await recomputeInvoice(r.insertId)
    return NextResponse.json({ ok: true, id: r.insertId }, { status: 201 })
  } catch (err) {
    console.error("[invoices POST]", err)
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const __auth = await guard(request); if (isResponse(__auth)) return __auth
  try {
    const b: any = await request.json()
    const id = Number(b.id)
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
    const sets: string[] = []; const p: any[] = []
    if (b.client !== undefined) { sets.push("client = ?"); p.push(String(b.client).slice(0, 255)) }
    if (b.project !== undefined) { sets.push("project = ?"); p.push(String(b.project).slice(0, 255)) }
    if (b.date !== undefined && isDate(b.date)) { sets.push("date = ?"); p.push(b.date) }
    if (b.dueDate !== undefined) { sets.push("due_date = ?"); p.push(isDate(b.dueDate) ? b.dueDate : null) }
    if (b.amount !== undefined) { sets.push("amount = ?"); p.push(round2(b.amount)) }
    // legacy: manual status / paid edits are still accepted when no payment rows exist
    if (b.status !== undefined && ["pending", "partial", "paid", "overdue", "cancelled"].includes(b.status)) { sets.push("status = ?"); p.push(b.status) }
    if (sets.length) await exec(`UPDATE invoices SET ${sets.join(", ")} WHERE id = ?`, [...p, id])
    const items = cleanItems(b.items)
    if (items) {
      const sum = await saveItems(id, items)
      if (items.length) await exec("UPDATE invoices SET amount = ? WHERE id = ?", [sum, id])
    }
    const pc = (await q("SELECT COUNT(*) n FROM invoice_payments WHERE invoice_id = ?", [id]))[0]
    if (Number(pc.n) > 0 || b.amount !== undefined || items) {
      if (b.status !== "cancelled") await recomputeInvoice(id)
    } else if (b.paid !== undefined) {
      await exec("UPDATE invoices SET paid = ? WHERE id = ?", [round2(b.paid), id])
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[invoices PUT]", err)
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const __auth = await guard(request); if (isResponse(__auth)) return __auth
  try {
    const url = new URL(request.url)
    const id = Number(url.searchParams.get("id"))
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
    const pc = (await q("SELECT COUNT(*) n FROM invoice_payments WHERE invoice_id = ?", [id]))[0]
    if (Number(pc.n) > 0 && url.searchParams.get("force") !== "1")
      return NextResponse.json({ error: "Invoice has payments" }, { status: 409 })
    await exec("DELETE FROM invoice_payments WHERE invoice_id = ?", [id])
    await exec("DELETE FROM invoice_items WHERE invoice_id = ?", [id])
    await exec("DELETE FROM invoices WHERE id = ?", [id])
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[invoices DELETE]", err)
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }
}
