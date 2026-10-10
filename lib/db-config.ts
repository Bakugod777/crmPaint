// MySQL connection settings come ONLY from environment variables.
// There is intentionally no default password: MYSQL_PASSWORD is required.
function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`[Paint Power CRM] Missing required env var ${name} (see .env.example)`)
  return v
}

export const dbConfig = {
  get host() { return process.env.MYSQL_HOST || "127.0.0.1" },
  get port() { return Number(process.env.MYSQL_PORT) || 3306 },
  get user() { return process.env.MYSQL_USER || "root" },
  get password() { return required("MYSQL_PASSWORD") },
  get database() { return process.env.MYSQL_DATABASE || "paint_power_crm" },
}

export default dbConfig
