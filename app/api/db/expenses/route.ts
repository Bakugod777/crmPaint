import { makeCrud } from "@/lib/crud"


export const { GET, POST, PUT, DELETE } = makeCrud({
  table: "expenses",
  fields: { expense_date: "date", category: "str", description: "str", amount: "money", payee: "str", project_id: "int", payment_method: "str", receipt_ref: "str", notes: "str", created_by: "int" },
  required: ["expense_date", "amount"],
  dateField: "expense_date",
  filters: ["category", "project_id"],
  select: `SELECT t.*, p.name AS project_name FROM expenses t LEFT JOIN projects p ON p.id = t.project_id`,
  orderBy: "t.expense_date DESC, t.id DESC",
  beforeSave: async (row) => (row.amount !== undefined && row.amount <= 0 ? "Amount must be > 0" : row),
})
