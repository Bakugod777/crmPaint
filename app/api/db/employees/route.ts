import { makeCrud } from "@/lib/crud"
import { q } from "@/lib/db"

// Employees. Non-staff callers (empleado) only get their own record (selfColumn on t.id).
export const { GET, POST, PUT, DELETE } = makeCrud({
  table: "employees",
  fields: { name: "str", position: "str", phone: "str", email: "str", document_id: "str", pay_type: "str", pay_rate: "money", status: "str", start_date: "date", end_date: "date", user_id: "int", notes: "text" },
  required: ["name"],
  enums: { pay_type: ["daily", "hourly"], status: ["active", "inactive"] },
  filters: ["status"],
  selfColumn: "id",
  dateField: "start_date",
  orderBy: "t.status ASC, t.name ASC",
  beforeDelete: async (id) => {
    const r = (await q("SELECT (SELECT COUNT(*) FROM employee_attendance WHERE employee_id = ?) + (SELECT COUNT(*) FROM employee_payments WHERE employee_id = ?) n", [id, id]))[0]
    if (Number(r.n) > 0) return "Employee has attendance/payments; set status to inactive instead"
  },
})
