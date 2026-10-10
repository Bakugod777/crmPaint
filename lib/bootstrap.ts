import bcrypt from "bcrypt"
import { q, exec } from "@/lib/db"

export async function ensureFirstAdmin() {
  const email = (process.env.ADMIN_EMAIL || "admin@paintpower.local").trim().toLowerCase()
  const name = process.env.ADMIN_NAME || "Administrador"
  const password = process.env.ADMIN_PASSWORD as string
  await exec(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE, name VARCHAR(255) DEFAULT '',
    password VARCHAR(255) DEFAULT '', role VARCHAR(20) DEFAULT 'user', banned BOOLEAN NOT NULL DEFAULT 0,
    reset_token VARCHAR(255) NULL, reset_token_expires DATETIME NULL, address TEXT NULL, phone VARCHAR(20) NULL,
    session_version INT NOT NULL DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`)
  // existing DBs: add users.session_version if missing (MySQL 5.7 / MariaDB safe)
  const col = await q("SELECT COUNT(*) n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'session_version'")
  if (!Number(col[0]?.n)) {
    await exec("ALTER TABLE users ADD COLUMN session_version INT NOT NULL DEFAULT 0")
    console.log("[Paint Power CRM] users.session_version agregado")
  }
  const rows = await q("SELECT id, role FROM users WHERE email = ?", [email])
  if (!rows.length) {
    await exec("INSERT INTO users (email, name, password, role) VALUES (?, ?, ?, 'admin')", [email, name, await bcrypt.hash(password, 10)])
    console.log(`[Paint Power CRM] Admin inicial creado: ${email}`)
  } else if (process.env.ADMIN_RESET_PASSWORD === "1") {
    await exec("UPDATE users SET password = ?, role = 'admin', banned = 0, session_version = session_version + 1 WHERE email = ?", [await bcrypt.hash(password, 10), email])
    console.log(`[Paint Power CRM] Contraseña del admin ${email} restablecida (quite ADMIN_RESET_PASSWORD).`)
  }
}
