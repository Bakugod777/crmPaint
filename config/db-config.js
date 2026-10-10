// Legacy config (not imported by the app). Reads ONLY environment variables; no default password.
module.exports = {
  dbConfig: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || 'paint_power_crm',
  },
}
