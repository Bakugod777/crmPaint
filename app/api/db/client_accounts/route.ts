import { makeCrud } from "@/lib/crud"

export const { GET, POST, PUT, DELETE } = makeCrud({
  table: "client_accounts",
  fields: { client_name: "str", credit_limit: "money", payment_terms_days: "int", phone: "str", email: "str", notes: "text" },
  required: ["client_name"],
  orderBy: "t.client_name ASC",
})
