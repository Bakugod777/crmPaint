import { makeCrud } from "@/lib/crud"

export const { GET, POST, PUT, DELETE } = makeCrud({
  table: "supplier_payments",
  fields: { supplier_id: "int", pay_date: "date", amount: "money", method: "str", reference: "str", notes: "str", created_by: "int" },
  required: ["supplier_id", "pay_date", "amount"],
  dateField: "pay_date",
  filters: ["supplier_id"],
  select: `SELECT t.*, s.name AS supplier_name FROM supplier_payments t LEFT JOIN suppliers s ON s.id = t.supplier_id`,
  orderBy: "t.pay_date DESC, t.id DESC",
  beforeSave: async (row) => (row.amount !== undefined && row.amount <= 0 ? "Amount must be > 0" : row),
})
