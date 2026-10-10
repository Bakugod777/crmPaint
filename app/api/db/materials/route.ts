import { makeCrud } from "@/lib/crud"
import { q } from "@/lib/db"

// Catalog with computed stock (purchases - usage), average cost and inventory value.
export const { GET, POST, PUT, DELETE } = makeCrud({
  table: "materials",
  fields: { name: "str", sku: "str", category: "str", unit: "str", unit_cost: "money", sale_price: "money", supplier_id: "int", min_stock: "qty", active: "bool", notes: "text" },
  required: ["name"],
  filters: ["supplier_id", "category", "active"],
  select: `SELECT t.*, s.name AS supplier_name,
             COALESCE(pu.qty,0) AS purchased_qty, COALESCE(us.qty,0) AS used_qty,
             COALESCE(pu.qty,0) - COALESCE(us.qty,0) AS stock,
             CASE WHEN COALESCE(pu.qty,0) > 0 THEN ROUND(pu.total / pu.qty, 2) ELSE t.unit_cost END AS avg_cost
           FROM materials t
           LEFT JOIN suppliers s ON s.id = t.supplier_id
           LEFT JOIN (SELECT material_id, SUM(quantity) qty, SUM(total) total FROM material_purchases GROUP BY material_id) pu ON pu.material_id = t.id
           LEFT JOIN (SELECT material_id, SUM(quantity) qty FROM material_usage GROUP BY material_id) us ON us.material_id = t.id`,
  orderBy: "t.name ASC",
  beforeDelete: async (id) => {
    const r = (await q("SELECT (SELECT COUNT(*) FROM material_purchases WHERE material_id = ?) + (SELECT COUNT(*) FROM material_usage WHERE material_id = ?) n", [id, id]))[0]
    if (Number(r.n) > 0) return "Material has movements; set inactive instead"
  },
})
