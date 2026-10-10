import { makeCrud } from "@/lib/crud"
import { exec, q, round2 } from "@/lib/db"

// Purchases add stock. If body.consume_to_project is true and project_id is set,
// a matching usage row is created (material bought directly for that job).
export const { GET, POST, PUT, DELETE } = makeCrud({
  table: "material_purchases",
  fields: { purchase_date: "date", material_id: "int", supplier_id: "int", project_id: "int", quantity: "qty", unit_cost: "money", payment_status: "str", payment_method: "str", due_date: "date", invoice_ref: "str", notes: "str", created_by: "int" },
  required: ["purchase_date", "material_id", "quantity"],
  enums: { payment_status: ["paid", "credit"] },
  dateField: "purchase_date",
  filters: ["material_id", "supplier_id", "project_id", "payment_status"],
  select: `SELECT t.*, m.name AS material_name, m.unit, s.name AS supplier_name, p.name AS project_name,
             (SELECT COUNT(*) FROM material_usage u WHERE u.purchase_id = t.id) AS auto_consumed
           FROM material_purchases t LEFT JOIN materials m ON m.id = t.material_id
           LEFT JOIN suppliers s ON s.id = t.supplier_id LEFT JOIN projects p ON p.id = t.project_id`,
  orderBy: "t.purchase_date DESC, t.id DESC",
  beforeSave: async (row, { existing }) => {
    const mid = row.material_id ?? existing?.material_id
    const m = (await q("SELECT id, unit_cost, supplier_id FROM materials WHERE id = ?", [mid]))[0]
    if (!m) return "Material not found"
    const qty = row.quantity ?? existing?.quantity
    if (!(qty > 0)) return "Quantity must be > 0"
    const unit = row.unit_cost ?? existing?.unit_cost ?? m.unit_cost
    if (!existing && row.supplier_id == null && m.supplier_id) row.supplier_id = m.supplier_id
    return { ...row, unit_cost: round2(unit), total: round2(qty * unit) }
  },
  afterSave: async (id, row, { isNew, body }) => {
    if (isNew && body?.consume_to_project && row.project_id) {
      await exec(`INSERT INTO material_usage (usage_date, material_id, project_id, quantity, unit_cost, total, purchase_id, notes, created_by)
                  VALUES (?, ?, ?, ?, ?, ?, ?, 'Consumo directo de la compra', ?)`,
        [row.purchase_date, row.material_id, row.project_id, row.quantity, row.unit_cost, row.total, id, row.created_by || null])
    } else if (!isNew) {
      // keep auto-generated usage in sync with the purchase
      await exec("UPDATE material_usage SET usage_date = ?, material_id = ?, project_id = COALESCE(?, project_id), quantity = ?, unit_cost = ?, total = ? WHERE purchase_id = ?",
        [row.purchase_date, row.material_id, row.project_id, row.quantity, row.unit_cost, row.total, id])
    }
  },
  afterDelete: async (id) => { await exec("DELETE FROM material_usage WHERE purchase_id = ?", [id]) },
})
