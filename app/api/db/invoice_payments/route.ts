import { makeCrud } from "@/lib/crud"
import { q } from "@/lib/db"
import { ensureLegacyOpening, recomputeInvoice } from "@/lib/acct"

// Partial payments (abonos). invoices.paid/status are recomputed after every change.
export const { GET, POST, PUT, DELETE } = makeCrud({
  table: "invoice_payments",
  fields: { invoice_id: "int", pay_date: "date", amount: "money", method: "str", reference: "str", notes: "str", created_by: "int" },
  required: ["invoice_id", "pay_date", "amount"],
  dateField: "pay_date",
  filters: ["invoice_id"],
  select: `SELECT t.*, i.client, i.project FROM invoice_payments t LEFT JOIN invoices i ON i.id = t.invoice_id`,
  orderBy: "t.pay_date DESC, t.id DESC",
  beforeSave: async (row, { existing, user }) => {
    if (row.amount !== undefined && row.amount <= 0) return "Amount must be > 0"
    const invId = row.invoice_id ?? existing?.invoice_id
    const inv = (await q("SELECT id FROM invoices WHERE id = ?", [invId]))[0]
    if (!inv) return "Invoice not found"
    if (!existing) await ensureLegacyOpening(invId, user.id)
    return row
  },
  afterSave: async (_id, row) => { await recomputeInvoice(row.invoice_id) },
  afterDelete: async (_id, existing) => { await recomputeInvoice(existing.invoice_id) },
})
