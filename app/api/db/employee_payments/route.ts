import { makeCrud } from "@/lib/crud"

// Payments / advances / bonuses / deductions. Balance owed = attendance + bonus - payment - advance - deduction
export const { GET, POST, PUT, DELETE } = makeCrud({
  table: "employee_payments",
  fields: { employee_id: "int", pay_date: "date", type: "str", amount: "money", method: "str", period_start: "date", period_end: "date", project_id: "int", notes: "str", created_by: "int" },
  required: ["employee_id", "pay_date", "amount"],
  enums: { type: ["payment", "advance", "bonus", "deduction"] },
  dateField: "pay_date",
  filters: ["employee_id", "type"],
  selfColumn: "employee_id",
  select: `SELECT t.*, e.name AS employee_name FROM employee_payments t LEFT JOIN employees e ON e.id = t.employee_id`,
  orderBy: "t.pay_date DESC, t.id DESC",
  beforeSave: async (row) => (row.amount !== undefined && row.amount <= 0 ? "Amount must be > 0" : row),
})
