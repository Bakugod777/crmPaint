// Required environment variables. The server refuses to start if MYSQL_PASSWORD, SESSION_SECRET or
// ADMIN_PASSWORD are missing, start with "CAMBIAR" or equal a known default/placeholder.
// Single source of truth: server-lib/env-check.js (also used by server.js and apps.js). It is loaded
// at runtime instead of being bundled, so the deny-list of default passwords never ends up in .next.
import { createRequire } from "module"
import path from "path"

export function missingEnv(): string[] {
  try {
    const load = createRequire(path.join(process.cwd(), "package.json"))
    return load("./server-lib/env-check.js").envProblems(process.env)
  } catch (e: any) {
    return [`(no se pudo cargar server-lib/env-check.js: ${e?.message || e})`]
  }
}
