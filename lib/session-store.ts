// Server-side session validation against MySQL (Node runtime: route handlers + proxy.ts).
// A cookie is only valid while its `sv` equals users.session_version and the user is not banned.
import { q, exec } from "@/lib/db"
import type { SessionPayload } from "@/lib/session"

export interface SessionUserRow { id: number; name: string; email: string; role: string; banned: number; session_version: number }

export async function loadSessionUser(sess: SessionPayload | null): Promise<SessionUserRow | null> {
  if (!sess) return null
  const rows = await q("SELECT id, name, email, role, banned, session_version FROM users WHERE id = ? LIMIT 1", [sess.uid])
  const row = rows[0]
  if (!row || row.banned) return null
  if (Number(row.session_version) !== Number(sess.sv)) return null
  return row
}

/** Invalidates every existing cookie of that user (all devices). */
export async function bumpSessionVersion(userId: number) {
  await exec("UPDATE users SET session_version = session_version + 1 WHERE id = ?", [userId])
}
