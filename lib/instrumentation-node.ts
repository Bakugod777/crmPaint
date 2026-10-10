// 1) Refuse to start if required env vars are missing.
// 2) Create the first admin from ADMIN_EMAIL / ADMIN_PASSWORD if it does not exist.
//    (ADMIN_RESET_PASSWORD=1 for one restart resets that admin's password.)
import { missingEnv } from "./env"

const missing = missingEnv()
if (missing.length) {
  console.error(
    `\n[Paint Power CRM] NO SE PUEDE INICIAR. Variables de entorno faltantes o inválidas: ${missing.join(", ")}\n` +
      `Configúrelas en .env (ver .env.example) o en el panel del hosting y reinicie.\n`,
  )
  process.exit(1)
}

import("./bootstrap")
  .then((m) => m.ensureFirstAdmin())
  .catch((e: any) => console.error("[Paint Power CRM] admin bootstrap failed:", e?.message || e))

export {}
