// CommonJS twin of lib/session.ts + lib/permissions.ts for the Express server (apps.js).
// Same cookie format: base64url(JSON) + "." + base64url(HMAC-SHA256(SESSION_SECRET)).
const crypto = require('crypto');

const SESSION_COOKIE = 'pp_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const STAFF_ROLES = ['admin', 'contador', 'accountant'];

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET missing or shorter than 32 chars');
  return s;
}

function signSession(p, ttl = SESSION_TTL_SECONDS) {
  const now = Math.floor(Date.now() / 1000);
  const body = b64url(JSON.stringify({ ...p, iat: now, exp: now + ttl }));
  const sig = b64url(crypto.createHmac('sha256', secret()).update(body).digest());
  return `${body}.${sig}`;
}

function verifySession(token) {
  try {
    if (!token || token.length > 4096) return null;
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expected = crypto.createHmac('sha256', secret()).update(body).digest();
    const given = fromB64url(sig);
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
    const p = JSON.parse(fromB64url(body).toString('utf8'));
    if (!p || typeof p.uid !== 'number' || typeof p.sv !== 'number' || !p.exp || p.exp < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch (e) { return null; }
}

function readCookie(header, name = SESSION_COOKIE) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

const normalizeRole = (r) => { r = String(r || '').toLowerCase(); return r === 'accountant' ? 'contador' : (r || 'user'); };
const isStaff = (r) => STAFF_ROLES.includes(normalizeRole(r));

function requiredAccess(pathname, method) {
  const m = String(method).toUpperCase();
  const p = pathname.replace(/\/+$/, '');
  if (!p.startsWith('/api/db')) return 'public';
  if (/^\/api\/db\/users\/[^/]+\/resign$/.test(p) && m === 'POST') return 'any';
  if (p === '/api/db/users' || p.startsWith('/api/db/users/')) return 'admin';
  if (p === '/api/db/applications' || p.startsWith('/api/db/applications/')) return 'admin';
  if (p === '/api/db/apply' && m === 'POST') return 'any';
  if (p === '/api/db/me') return 'any';
  if (p === '/api/db/data' && m === 'GET') return 'any';
  if (['/api/db/attendance', '/api/db/employee_payments', '/api/db/employees'].includes(p) && m === 'GET') return 'any';
  return 'staff';
}

function roleAllows(access, role) {
  if (access === 'public' || access === 'any') return true;
  const r = normalizeRole(role);
  if (access === 'admin') return r === 'admin';
  return isStaff(r);
}

function cookieHeader(token, maxAge = SESSION_TTL_SECONDS) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

// DB check: user exists, not banned, and cookie sv === users.session_version.
async function loadSessionUser(pool, sess) {
  if (!sess) return null;
  const [rows] = await pool.query('SELECT id, name, email, role, banned, session_version FROM users WHERE id = ? LIMIT 1', [sess.uid]);
  const u = rows && rows[0];
  if (!u || u.banned || Number(u.session_version) !== Number(sess.sv)) return null;
  return u;
}

const bumpSessionVersion = (pool, id) => pool.query('UPDATE users SET session_version = session_version + 1 WHERE id = ?', [id]);

// Express middleware for /api/db/*: 401 without session, 403 wrong role. Re-reads user from DB.
function apiGuard(pool) {
  return async (req, res, next) => {
    const sess = verifySession(readCookie(req.headers.cookie));
    if (!sess) return res.status(401).json({ error: 'Not authenticated' });
    try {
      const u = await loadSessionUser(pool, sess);
      if (!u) return res.status(401).json({ error: 'Session no longer valid' });
      const role = normalizeRole(u.role);
      const access = requiredAccess(req.baseUrl + req.path, req.method);
      if (!roleAllows(access, role)) return res.status(403).json({ error: 'Forbidden for role ' + role });
      req.user = { id: Number(u.id), role, name: u.name, email: u.email, staff: isStaff(role) };
      next();
    } catch (e) {
      res.status(500).json({ error: 'DB error' });
    }
  };
}

module.exports = { SESSION_COOKIE, loadSessionUser, bumpSessionVersion, signSession, verifySession, readCookie, normalizeRole, isStaff, requiredAccess, roleAllows, cookieHeader, apiGuard };
