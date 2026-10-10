import { makeCrud } from "@/lib/crud"
import { q } from "@/lib/db"

export const { GET, POST, PUT, DELETE } = makeCrud({
  table: "suppliers",
  fields: { name: "str", contact: "str", phone: "str", email: "str", payment_terms_days: "int", notes: "text" },
  required: ["name"],
  orderBy: "t.name ASC",
  beforeDelete: async (id) => {
    const r = (await q("SELECT (SELECT COUNT(*) FROM material_purchases WHERE supplier_id = ?) + (SELECT COUNT(*) FROM supplier_payments WHERE supplier_id = ?) n", [id, id]))[0]
    if (Number(r.n) > 0) return "Supplier has purchases/payments"
  },
})
