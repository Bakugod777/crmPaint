import { makeCrud } from "@/lib/crud"
import { q, round2 } from "@/lib/db"
import { avgCost } from "@/lib/acct"

// Consumption of materials per project, valued at weighted average cost.
export const { GET, POST, PUT, DELETE } = makeCrud({
  table: "material_usage",
  fields: { usage_date: "date", material_id: "int", project_id: "int", quantity: "qty", unit_cost: "money", employee_id: "int", notes: "str", created_by: "int" },
  required: ["usage_date", "material_id", "quantity"],
  dateField: "usage_date",
  filters: ["material_id", "project_id"],
  select: `SELECT t.*, m.name AS material_name, m.unit, p.name AS project_name, e.name AS employee_name
           FROM material_usage t LEFT JOIN materials m ON m.id = t.material_id
           LEFT JOIN projects p ON p.id = t.project_id LEFT JOIN employees e ON e.id = t.employee_id`,
  orderBy: "t.usage_date DESC, t.id DESC",
  beforeSave: async (row, { existing }) => {
    const mid = row.material_id ?? existing?.material_id
    const m = (await q("SELECT id FROM materials WHERE id = ?", [mid]))[0]
    if (!m) return "Material not found"
    const qty = row.quantity ?? existing?.quantity
    if (!(qty > 0)) return "Quantity must be > 0"
    const unit = row.unit_cost ?? (existing && row.material_id === undefined ? existing.unit_cost : await avgCost(mid))
    return { ...row, unit_cost: round2(unit), total: round2(qty * unit) }
  },
})
