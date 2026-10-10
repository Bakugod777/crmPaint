import { makeCrud } from "@/lib/crud"
import { q, round2 } from "@/lib/db"

// Days worked per employee. rate is frozen at save time; amount = days*rate (daily) or hours*rate (hourly).
export const { GET, POST, PUT, DELETE } = makeCrud({
  table: "employee_attendance",
  fields: { employee_id: "int", work_date: "date", project_id: "int", days: "qty", hours: "qty", rate: "money", notes: "str", created_by: "int" },
  required: ["employee_id", "work_date"],
  dateField: "work_date",
  filters: ["employee_id", "project_id"],
  selfColumn: "employee_id",
  select: `SELECT t.*, e.name AS employee_name, e.position AS employee_position, p.name AS project_name
           FROM employee_attendance t LEFT JOIN employees e ON e.id = t.employee_id LEFT JOIN projects p ON p.id = t.project_id`,
  orderBy: "t.work_date DESC, e.name ASC",
  beforeSave: async (row, { existing, isNew }) => {
    const empId = row.employee_id ?? existing?.employee_id
    const emp = (await q("SELECT id, pay_type, pay_rate FROM employees WHERE id = ?", [empId]))[0]
    if (!emp) return "Employee not found"
    const payType = isNew || row.employee_id !== undefined ? emp.pay_type : existing.pay_type
    const rate = row.rate ?? (isNew || row.employee_id !== undefined ? emp.pay_rate : existing.rate)
    const days = row.days ?? existing?.days ?? 1
    const hours = row.hours ?? (row.days !== undefined ? round2(days * 8) : existing?.hours ?? round2(days * 8))
    if (days < 0 || hours < 0 || days > 3 || hours > 24) return "Invalid days/hours"
    return { ...row, days, hours, pay_type: payType, rate: round2(rate), amount: round2(payType === "hourly" ? hours * rate : days * rate) }
  },
})
