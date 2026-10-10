// Stateless signed session cookie: base64url(JSON payload) + "." + base64url(HMAC-SHA256)
// Uses Web Crypto so it works in route handlers and in proxy.ts.
// The same format is implemented for Express in server-lib/session.js.
export const SESSION_COOKIE = "pp_session"
export const SESSION_TTL_SECONDS = 60 * 60 * 12 // 12 h

export interface SessionPayload {
  uid: number
  role: string
  name: string
  email: string
  sv: number // users.session_version at sign time; bumped on logout/password/role/ban -> old cookies die
  iat: number
  exp: number
}

const enc = new TextEncoder()

function b64url(bytes: Uint8Array): string {
  let s = ""
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : ""
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function key(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error("[Paint Power CRM] SESSION_SECRET missing or shorter than 32 chars")
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"])
}

export async function signSession(p: Omit<SessionPayload, "iat" | "exp">, ttl = SESSION_TTL_SECONDS): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const payload: SessionPayload = { ...p, iat: now, exp: now + ttl }
  const body = b64url(enc.encode(JSON.stringify(payload)))
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(), enc.encode(body)))
  return `${body}.${b64url(sig)}`
}

export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  try {
    if (!token || token.length > 4096) return null
    const [body, sig] = token.split(".")
    if (!body || !sig) return null
    const ok = await crypto.subtle.verify("HMAC", await key(), fromB64url(sig) as BufferSource, enc.encode(body))
    if (!ok) return null
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as SessionPayload
    if (!p || typeof p.uid !== "number" || typeof p.sv !== "number" || !p.exp || p.exp < Math.floor(Date.now() / 1000)) return null
    return p
  } catch {
    return null
  }
}

export function sessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  }
}

export function readCookie(header: string | null | undefined, name = SESSION_COOKIE): string | null {
  if (!header) return null
  for (const part of header.split(";")) {
    const i = part.indexOf("=")
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim())
  }
  return null
}
