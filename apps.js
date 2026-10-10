// Lightweight Express server adapted for this project
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
// Refuse to start without required secrets (no insecure defaults)
require('./server-lib/env-check').assertEnvOrExit('Paint Power CRM API');
const sessionLib = require('./server-lib/session');
const express = require('express');
const fs = require('fs');
const mysql = require('mysql2/promise');
const geoip = require('geoip-lite');
const moment = require('moment-timezone');

function convertBigIntToNumber(obj) {
  if (typeof obj === 'bigint') return Number(obj);
  if (Array.isArray(obj)) return obj.map(convertBigIntToNumber);
  if (obj !== null && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = convertBigIntToNumber(v);
    return out;
  }
  return obj;
}

function getUserTimezone(req) {
  let ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.ip || null;
  if (ip && ip.includes('::ffff:')) ip = ip.split('::ffff:')[1];
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) return 'America/New_York';
  try {
    const geo = geoip.lookup(ip);
    if (geo && geo.country === 'US') return 'America/New_York';
  } catch (e) { /* ignore */ }
  return 'America/New_York';
}

function formatDateForUS(date, timezone = 'America/New_York') {
  if (!date) return '';
  try { return moment(date).tz(timezone).format('MM/DD/YYYY hh:mm A z'); }
  catch (e) { return moment(date).tz('America/New_York').format('MM/DD/YYYY hh:mm A z'); }
}

function formatDateISO(date) {
  if (!date) return ''
  try {
    // If it's already a string in YYYY-MM-DD form, return as-is
    if (typeof date === 'string') {
      const s = date.trim()
      const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
      if (m) return m[1]
      const dt = new Date(s)
      if (!isNaN(dt.getTime())) return dt.toISOString().slice(0,10)
      return s
    }
    // If it's a Date object, extract local date components to avoid timezone shifts
    if (date instanceof Date) {
      const y = date.getFullYear()
      const mo = String(date.getMonth() + 1).padStart(2, '0')
      const da = String(date.getDate()).padStart(2, '0')
      return `${y}-${mo}-${da}`
    }
    // Some drivers return objects with toISOString()
    if (date && typeof date.toISOString === 'function') {
      const dt = new Date(date.toISOString())
      if (!isNaN(dt.getTime())) {
        const y = dt.getFullYear()
        const mo = String(dt.getMonth() + 1).padStart(2, '0')
        const da = String(dt.getDate()).padStart(2, '0')
        return `${y}-${mo}-${da}`
      }
    }
    // Fallback to moment formatting (without forcing UTC)
    try { return moment(date).format('YYYY-MM-DD') } catch (e) { /* fallthrough */ }
    return String(date).slice(0,10)
  } catch (e) {
    try { return new Date(date).toISOString().slice(0,10) } catch (er) { return '' }
  }
}

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Simple CORS middleware to allow frontend (Next dev) to call this API
app.use((req, res, next) => {
  const allowed = process.env.CORS_ORIGIN || '';
  if (allowed) { res.header('Access-Control-Allow-Origin', allowed); res.header('Access-Control-Allow-Credentials', 'true'); res.header('Vary', 'Origin'); }
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  // Allow credentials if needed (adjust in production)
  // res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || 'paint_power_crm',
  waitForConnections: true,
  connectionLimit: 10,
});

async function queryRows(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return convertBigIntToNumber(rows);
}

// Ensure minimal tables used by the project exist (non-destructive)
async function ensureSuscriptedsTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS suscripteds (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
}

ensureSuscriptedsTable().catch(err => console.error('ensureSuscriptedsTable failed:', err.message));

// Ensure users table exists and create/update admin user on every start
const bcrypt = require('bcrypt');
async function ensureUsersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      name VARCHAR(255) DEFAULT '',
      password VARCHAR(255) DEFAULT '',
      role VARCHAR(20) DEFAULT 'user',
      banned BOOLEAN NOT NULL DEFAULT 0,
      reset_token VARCHAR(255) NULL,
      reset_token_expires DATETIME NULL,
      address TEXT NULL,
      phone VARCHAR(20) NULL,
      session_version INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);
}

async function ensureAdminUser() {
  const email = process.env.ADMIN_EMAIL || 'admin@paintpower.local';
  const name = process.env.ADMIN_NAME || 'Administrador';
  const password = process.env.ADMIN_PASSWORD;
  try {
    await ensureUsersTable();
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    const passwordHash = await bcrypt.hash(password, 10);
    if (rows && rows.length > 0) {
      if (process.env.ADMIN_RESET_PASSWORD !== '1') return;
      await pool.query('UPDATE users SET password = ?, role = ? , name = ?, banned = 0, session_version = session_version + 1 WHERE email = ?', [passwordHash, 'admin', name, email]);
      console.log(`Admin user updated: ${email}`); 
    } else {
      await pool.query('INSERT INTO users (email, name, password, role) VALUES (?, ?, ?, ?)', [email, name, passwordHash, 'admin']);
      console.log(`Admin user created: ${email}`);
    }
  } catch (err) {
    console.error('ensureAdminUser failed:', err.message);
  }
}

// Run ensureAdminUser at startup so admin is present every run
ensureAdminUser().catch((e) => console.error('ensureAdminUser error:', e.message));

// Ensure columns exist (for older DBs migrated without new columns)
async function ensureUsersColumns() {
  try {
    // For older MySQL versions, check information_schema and add columns conditionally
    const dbName = process.env.MYSQL_DATABASE || 'paint_power_crm';
    const colsToEnsure = [
      { name: 'phone', def: 'VARCHAR(20) NULL' },
      { name: 'reset_token', def: 'VARCHAR(255) NULL' },
      { name: 'reset_token_expires', def: 'DATETIME NULL' },
      { name: 'address', def: 'TEXT NULL' },
      { name: 'banned', def: 'BOOLEAN NOT NULL DEFAULT 0' },
      { name: 'session_version', def: 'INT NOT NULL DEFAULT 0' },
    ];

    for (const c of colsToEnsure) {
      const [rows] = await pool.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = ?`,
        [dbName, c.name]
      );
      if (!rows || rows.length === 0) {
        await pool.query(`ALTER TABLE users ADD COLUMN ${c.name} ${c.def}`);
        console.log(`Added column users.${c.name}`);
      }
    }
  } catch (err) {
    console.warn('ensureUsersColumns warning:', err && err.message ? err.message : err);
  }
}

ensureUsersColumns().catch((e) => console.warn('ensureUsersColumns error:', e && e.message ? e.message : e));

// ---- Session auth: every /api/db/* route requires a valid signed cookie (401) and an allowed role (403)
app.use('/api/db', sessionLib.apiGuard(pool));

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });
    const rows = await queryRows('SELECT id, email, name, password, role, phone, banned, session_version, created_at AS createdAt FROM users WHERE email = ?', [String(email).trim()]);
    const u = rows && rows[0];
    const ok = u && !u.banned && u.password ? await bcrypt.compare(String(password), u.password) : false;
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const role = sessionLib.normalizeRole(u.role);
    res.setHeader('Set-Cookie', sessionLib.cookieHeader(sessionLib.signSession({ uid: Number(u.id), role, name: u.name || '', email: u.email, sv: Number(u.session_version) || 0 })));
    return res.json({ id: u.id, email: u.email, name: u.name, role, phone: u.phone, createdAt: u.createdAt });
  } catch (err) {
    console.error('/api/auth/login error', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const u = await sessionLib.loadSessionUser(pool, sessionLib.verifySession(sessionLib.readCookie(req.headers.cookie)));
    if (u) await sessionLib.bumpSessionVersion(pool, u.id); // copied cookies stop working
  } catch (e) { console.error('/api/auth/logout bump failed', e && e.message); }
  res.setHeader('Set-Cookie', sessionLib.cookieHeader('', 0));
  res.json({ ok: true });
});

app.get('/api/auth/me', async (req, res) => {
  const sess = sessionLib.verifySession(sessionLib.readCookie(req.headers.cookie));
  if (!sess) return res.status(401).json({ error: 'Not authenticated' });
  const u = await sessionLib.loadSessionUser(pool, sess).catch(() => null);
  if (!u) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ id: u.id, email: u.email, name: u.name, role: sessionLib.normalizeRole(u.role) });
});

// GET aggregated data used by frontend (notifications, leads, contacts, team_members, tasks, project_accounting)
app.get('/api/db/data', async (req, res) => {
  try {
    if (!req.user || !req.user.staff) {
      return res.json({ notifications: [], leads: [], contacts: [], tasks: [], project_accounting: [], projects: [] });
    }
    const [notifications, leads, contacts, tasks, project_accounting, projects] = await Promise.all([
        queryRows('SELECT * FROM notifications'),
        queryRows('SELECT * FROM leads'),
        queryRows('SELECT * FROM contacts'),
        queryRows('SELECT * FROM tasks'),
        queryRows('SELECT * FROM project_accounting'),
        queryRows('SELECT * FROM projects'),
      ]);

      // Normalize project dates: return raw YYYY-MM-DD strings as stored in DB
      const projectsNorm = (projects || []).map(p => ({
        ...p,
        start_date: (p && typeof p.start_date !== 'undefined' && p.start_date !== null) ? formatDateISO(p.start_date) : '',
        end_date: (p && typeof p.end_date !== 'undefined' && p.end_date !== null) ? formatDateISO(p.end_date) : '',
      }))

      // Note: team_members removed — frontend uses `users` now
      res.json({ notifications, leads, contacts, tasks, project_accounting, projects: projectsNorm });
  } catch (err) {
    console.error('/api/db/data error', err.message);
    res.status(500).json({ error: 'DB error', details: err.message });
  }
});

// Contacts CRUD (used by client-side persistence)
app.post('/api/db/contacts', async (req, res) => {
  try {
    const { id, name, email, phone, company, position, status, lastContact } = req.body || {}
    const insertId = id || `c-${Date.now()}`
    await pool.query('REPLACE INTO contacts (id, name, email, phone, company, position, status, lastContact) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [insertId, name || null, email || null, phone || null, company || null, position || null, status || 'active', lastContact || null])
    res.status(201).json({ id: insertId })
  } catch (err) {
    console.error('/api/db/contacts POST error', err && err.message ? err.message : err)
    res.status(500).json({ error: 'DB error', details: err && err.message })
  }
})

app.put('/api/db/contacts', async (req, res) => {
  try {
    const { id, ...updates } = req.body || {}
    if (!id) return res.status(400).json({ error: 'Missing id' })
    const allowed = ['name', 'email', 'phone', 'company', 'position', 'status', 'lastContact']
    const sets = []
    const params = []
    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(updates, k)) {
        sets.push(`${k} = ?`)
        params.push(updates[k])
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'No updates provided' })
    params.push(id)
    const sql = `UPDATE contacts SET ${sets.join(', ')} WHERE id = ?`
    await pool.query(sql, params)
    res.json({ success: true })
  } catch (err) {
    console.error('/api/db/contacts PUT error', err && err.message ? err.message : err)
    res.status(500).json({ error: 'DB error', details: err && err.message })
  }
})


app.delete('/api/db/contacts', async (req, res) => {
  try {
    const id = req.query.id || (req.body && req.body.id)
    console.log(`/api/db/contacts DELETE called, id=${id}, ip=${req.ip || req.headers['x-forwarded-for'] || ''}`)
    if (!id) return res.status(400).json({ error: 'Missing id' })
    await pool.query('DELETE FROM contacts WHERE id = ?', [id])
    res.json({ success: true })
  } catch (err) {
    console.error('/api/db/contacts DELETE error', err && err.message ? err.message : err)
    res.status(500).json({ error: 'DB error', details: err && err.message })
  }
})

// Users CRUD endpoints for frontend persistence
app.get('/api/db/users', async (req, res) => {
  try {
    const rows = await queryRows('SELECT id, email, name, role, phone, created_at AS createdAt FROM users')
    res.json(rows)
  } catch (err) {
    console.error('/api/db/users GET error', err.message)
    res.status(500).json({ error: 'DB error', details: err.message })
  }
})

app.post('/api/db/users', async (req, res) => {
  try {
    const { name, email, password, role, phone, company, createdBy } = req.body
    if (!email || !password || !role) return res.status(400).json({ error: 'Missing fields' })

    const [exists] = await pool.query('SELECT id FROM users WHERE email = ?', [email])
    if (exists && exists.length > 0) return res.status(409).json({ error: 'Email exists' })

    const passwordHash = await bcrypt.hash(password, 10)
    const [result] = await pool.query('INSERT INTO users (email, name, password, role, phone, created_at) VALUES (?, ?, ?, ?, ?, NOW())', [email, name || '', passwordHash, role, phone || null])
    const insertId = result.insertId || null
    const rows = await queryRows('SELECT id, email, name, role, phone, created_at AS createdAt FROM users WHERE id = ?', [insertId])
    // team_members persistence removed; frontend reads users now
    res.status(201).json(rows[0] || null)
  } catch (err) {
    console.error('/api/db/users POST error', err.message)
    res.status(500).json({ error: 'DB error', details: err.message })
  }
})

// /api/db/login removed: use POST /api/auth/login (sets the session cookie)

app.delete('/api/db/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'Invalid id' })
    await pool.query('DELETE FROM users WHERE id = ?', [id])
    res.json({ success: true })
  } catch (err) {
    console.error('/api/db/users DELETE error', err.message)
    res.status(500).json({ error: 'DB error', details: err.message })
  }
})

// Upsert project accounting JSON
app.post('/api/db/project_accounting', async (req, res) => {
  try {
    const accounting = req.body
    if (!accounting || !accounting.projectId) return res.status(400).json({ error: 'Missing projectId' })
    const json = JSON.stringify(accounting)
    await pool.query('REPLACE INTO project_accounting (projectId, accounting) VALUES (?, ?)', [accounting.projectId, json])
    res.status(201).json({ success: true })
  } catch (err) {
    console.error('/api/db/project_accounting POST error', err && err.message ? err.message : err)
    res.status(500).json({ error: 'DB error', details: err && err.message })
  }
})

app.delete('/api/db/project_accounting/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId
    if (!projectId) return res.status(400).json({ error: 'Missing projectId' })
    await pool.query('DELETE FROM project_accounting WHERE projectId = ?', [projectId])
    res.json({ success: true })
  } catch (err) {
    console.error('/api/db/project_accounting DELETE error', err && err.message ? err.message : err)
    res.status(500).json({ error: 'DB error', details: err && err.message })
  }
})

// GET project accounting JSON by projectId
app.get('/api/db/project_accounting/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId
    if (!projectId) return res.status(400).json({ error: 'Missing projectId' })
    const [rows] = await pool.query('SELECT accounting FROM project_accounting WHERE projectId = ?', [projectId])
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Not found' })
    // rows[0].accounting may already be parsed depending on driver
    const acct = rows[0].accounting
    res.json(typeof acct === 'string' ? JSON.parse(acct) : acct)
  } catch (err) {
    console.error('/api/db/project_accounting GET error', err && err.message ? err.message : err)
    res.status(500).json({ error: 'DB error', details: err && err.message })
  }
})

// Projects endpoints: create, assign worker, start, complete, pay
app.post('/api/db/projects', async (req, res) => {
  try {
    const body = req.body || {}
    const providedKey = body.projectKey ? String(body.projectKey).trim() : ''
    const projectKey = providedKey || `p-${Date.now()}`
    const name = body.name ? String(body.name).trim() : ''
    if (!name) return res.status(400).json({ error: 'Missing fields' })

    // Read existing columns for projects table so we only use available columns
    const dbName = process.env.MYSQL_DATABASE || 'paint_power_crm'
    const [cols] = await pool.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'projects'", [dbName])
    const colNames = (cols && cols.map) ? (cols.map((r) => String(r.COLUMN_NAME).toLowerCase())) : []

    // If project_key column missing, try to add it (best-effort)
    if (!colNames.includes('project_key')) {
      try {
        await pool.query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_key VARCHAR(255) NULL UNIQUE")
        const [cols2] = await pool.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'projects'", [dbName])
        colNames.splice(0, colNames.length, ...(cols2.map((r) => String(r.COLUMN_NAME).toLowerCase())))
      } catch (e) {
        console.warn('/api/db/projects POST warn: failed to add project_key', String(e))
      }
    }

    // ensure uniqueness when possible
    if (colNames.includes('project_key')) {
      const [exists] = await pool.query('SELECT id FROM projects WHERE project_key = ?', [projectKey])
      if (exists && exists.length > 0) return res.status(409).json({ error: 'projectKey exists' })
    }

    const insertCols = []
    const insertVals = []
    const placeholders = []
    const push = (col, val) => { insertCols.push(col); insertVals.push(val); placeholders.push('?') }

    if (colNames.includes('project_key')) push('project_key', projectKey)
    if (colNames.includes('name')) push('name', name)
    if (colNames.includes('start_date')) push('start_date', body.startDate || null)
    if (colNames.includes('end_date') && typeof body.endDate !== 'undefined') push('end_date', body.endDate || null)
    if (colNames.includes('client') && body.client) push('client', body.client)
    if (colNames.includes('location') && body.location) push('location', body.location)
    if (colNames.includes('type') && body.type) push('type', body.type)
    if (colNames.includes('status') && body.status) push('status', body.status)

    // numeric amount mapping: budget/value/amount
    const incomingAmount = (typeof body.budget !== 'undefined' && body.budget !== null) ? body.budget : (body.value ?? body.amount ?? null)
    const numericAmount = incomingAmount !== null && incomingAmount !== undefined ? Number(incomingAmount) : null
    if (numericAmount !== null) {
      if (colNames.includes('budget')) push('budget', numericAmount)
      else if (colNames.includes('value')) push('value', numericAmount)
      else if (colNames.includes('amount')) push('amount', numericAmount)
    }

    // some schemas have expected_duration_days
    if (colNames.includes('expected_duration_days')) push('expected_duration_days', body.expectedDurationDays || null)

    if (insertCols.length === 0) return res.status(400).json({ error: 'No writable columns found in projects table' })

    const sql = `INSERT INTO projects (${insertCols.join(',')}) VALUES (${placeholders.join(',')})`
    const [ins] = await pool.query(sql, insertVals)
    const id = ins && ins.insertId ? ins.insertId : null

    // Initialize project_accounting if table exists
    try {
      const accounting = { projectId: projectKey, totalPrice: 0, labor: 0, materials: 0, insurance: 0, profit: 0, workers: [], logs: [] }
      await pool.query('REPLACE INTO project_accounting (projectId, accounting) VALUES (?, ?)', [projectKey, JSON.stringify(accounting)])
    } catch (e) {
      console.warn('/api/db/projects POST warn: project_accounting init failed', String(e))
    }

    const rows = id ? await queryRows('SELECT * FROM projects WHERE id = ?', [id]) : []
    res.status(201).json(rows[0] || { id: id, project_key: projectKey, name })
  } catch (err) {
    console.error('/api/db/projects POST error', err && err.stack ? err.stack : (err && err.message ? err.message : err))
    res.status(500).json({ error: 'DB', details: String(err && err.message ? err.message : err) })
  }
})

// Update project by project_key or id (dynamic columns)
app.put('/api/db/projects/:projectKey', async (req, res) => {
  let conn
  try {
    const projectKey = req.params.projectKey
    const body = req.body || {}
    console.log('[projects][PUT] called with', { projectKey, body })
    if (!projectKey) return res.status(400).json({ error: 'Missing projectKey' })

    const dbName = process.env.MYSQL_DATABASE || 'paint_power_crm'
    const [cols] = await pool.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'projects'", [dbName])
    const colNames = (cols && cols.map) ? (cols.map((r) => String(r.COLUMN_NAME).toLowerCase())) : []

    const sets = []
    const vals = []
    const push = (col, val) => { sets.push(`${col} = ?`); vals.push(val) }

    if (colNames.includes('name') && typeof body.name !== 'undefined') push('name', body.name)
    if (colNames.includes('client') && typeof body.client !== 'undefined') push('client', body.client)
    if (colNames.includes('type') && typeof body.type !== 'undefined') push('type', body.type)
    if (colNames.includes('assignee') && typeof body.assignee !== 'undefined') push('assignee', body.assignee)
    if (colNames.includes('assigned_to') && typeof body.assignee !== 'undefined') push('assigned_to', body.assignee)
    const sanitizeDate = (d) => {
      try {
        if (d == null) return null
        // Accept YYYY-MM-DD strings as-is
        if (typeof d === 'string') {
          const s = d.trim()
          if (!s) return null
          const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
          if (m) return m[0]
          return null
        }
        // If a Date-like object is provided, derive the local date components
        if (d instanceof Date || (d && typeof d.toISOString === 'function')) {
          const dt = d instanceof Date ? d : new Date(d.toISOString())
          if (!isNaN(dt.getTime())) {
            const y = dt.getFullYear()
            const mo = String(dt.getMonth() + 1).padStart(2, '0')
            const da = String(dt.getDate()).padStart(2, '0')
            return `${y}-${mo}-${da}`
          }
        }
        return null
      } catch (e) { return null }
    }

    if (colNames.includes('start_date') && typeof body.startDate !== 'undefined') {
      const sd = sanitizeDate(body.startDate)
      if (sd) push('start_date', sd)
    }
    if (colNames.includes('end_date') && typeof body.endDate !== 'undefined') {
      const ed = sanitizeDate(body.endDate)
      if (ed) push('end_date', ed)
    }
    if (colNames.includes('status') && typeof body.status !== 'undefined') push('status', body.status)
    if (colNames.includes('location') && typeof body.location !== 'undefined') push('location', body.location)

    const incomingAmount = (typeof body.budget !== 'undefined' && body.budget !== null) ? body.budget : (body.value ?? body.amount ?? null)
    const numericAmount = incomingAmount !== null && incomingAmount !== undefined ? Number(incomingAmount) : null
    if (numericAmount !== null) {
      if (colNames.includes('budget')) push('budget', numericAmount)
      else if (colNames.includes('value')) push('value', numericAmount)
      else if (colNames.includes('amount')) push('amount', numericAmount)
    }

    if (sets.length === 0) return res.status(400).json({ error: 'No updatable columns found' })

    let where = 'project_key = ?'
    let whereVal = projectKey
    if (!colNames.includes('project_key')) {
      if (/^\d+$/.test(String(projectKey))) {
        where = 'id = ?'
        whereVal = Number(projectKey)
      } else {
        where = 'id = ?'
        whereVal = Number(projectKey) || projectKey
      }
    }

    const sql = `UPDATE projects SET ${sets.join(', ')} WHERE ${where}`
    await pool.query(sql, [...vals, whereVal])

    const [rows] = await pool.query('SELECT * FROM projects WHERE project_key = ? OR id = ? LIMIT 1', [projectKey, projectKey])
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Project not found after update' })
    return res.json(rows[0])
  } catch (err) {
    console.error('/api/db/projects PUT error', err && err.stack ? err.stack : (err && err.message ? err.message : err))
    return res.status(500).json({ error: String(err && err.message ? err.message : err) })
  }
})

app.post('/api/db/projects/:projectKey/assign', async (req, res) => {
  try {
    const { projectKey } = req.params
    const { userId, role } = req.body
    const salaryRate = req.body.salaryRate !== undefined ? Number(req.body.salaryRate) : undefined
    const salaryType = req.body.salaryType || null
    const [projRows] = await pool.query('SELECT id FROM projects WHERE project_key = ?', [projectKey])
    if (!projRows || projRows.length === 0) return res.status(404).json({ error: 'Project not found' })
    const projectId = projRows[0].id
    // Ensure the assigned worker exists in the users table (team_members are project staff/managers and should not be assignable as workers)
    const [userRows] = await pool.query('SELECT id FROM users WHERE id = ?', [userId])
    if (!userRows || userRows.length === 0) {
      return res.status(400).json({ error: 'Assignable worker must be a user account' })
    }
    // Insert into project_workers; try numeric insert first, fallback to string insert
    try {
      await pool.query('INSERT INTO project_workers (project_id, user_id, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role)', [projectId, userId, role || 'worker'])
      if (salaryRate !== undefined || salaryType !== null) {
        try {
          await pool.query('UPDATE project_workers SET salary_rate = ?, salary_type = ? WHERE project_id = ? AND user_id = ?', [salaryRate || 0, salaryType, projectId, userId])
        } catch (e) { /* ignore */ }
      }
    } catch (e) {
      try {
        await pool.query('INSERT INTO project_workers (project_id, user_id, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role)', [projectId, String(userId), role || 'worker'])
      } catch (err) {
        console.warn('/api/db/projects assign warn: project_workers insert failed', String(err))
      }
    }

    // Also update the projects table assignee/assigned_to to reflect current assignment (best-effort)
    try {
      await pool.query('UPDATE projects SET assignee = ?, assigned_to = ? WHERE id = ?', [userId, userId, projectId])
    } catch (e) {
      console.warn('/api/db/projects assign warn: update projects.assignee skipped or failed', String(e))
    }
    const [acctRows] = await pool.query('SELECT accounting FROM project_accounting WHERE projectId = ?', [projectKey])
    if (acctRows && acctRows.length > 0) {
      const acct = typeof acctRows[0].accounting === 'string' ? JSON.parse(acctRows[0].accounting) : acctRows[0].accounting
      acct.workers = acct.workers || []
      const uid = String(userId)
      const computePayment = (rate, type, days = 30) => {
        const st = (type || '').toString().toLowerCase()
        if (typeof rate === 'number' && rate > 0) {
          if (st === 'monthly' || st === 'fixed') return rate
          if (st === 'weekly') return rate * Math.max(1, Math.ceil(days / 7))
          if (st === 'daily') return rate * days
        }
        return 0
      }

      if (!acct.workers.some((w) => String(w.id) === uid)) {
        acct.workers.push({ id: uid, name: '', days: [], totalPayment: computePayment(salaryRate || 0, salaryType), status: 'WORKING', salaryRate: salaryRate || 0, salaryType: salaryType, role })
      } else {
        acct.workers = acct.workers.map((w) => (String(w.id) === uid ? { ...w, status: 'WORKING', salaryRate: salaryRate !== undefined ? salaryRate : w.salaryRate || 0, salaryType: salaryType || w.salaryType, totalPayment: computePayment(salaryRate !== undefined ? salaryRate : w.salaryRate, salaryType || w.salaryType) } : w))
      }
      await pool.query('REPLACE INTO project_accounting (projectId, accounting) VALUES (?, ?)', [projectKey, JSON.stringify(acct)])
    }
    res.json({ success: true })
  } catch (err) {
    console.error('/api/db/projects assign error', err && err.message ? err.message : err)
    res.status(500).json({ error: 'DB' })
  }
})

app.put('/api/db/projects/:projectKey/start', async (req, res) => {
  try {
    const { projectKey } = req.params
    const startDate = req.body.startDate || new Date().toISOString().slice(0, 10)
    await pool.query('UPDATE projects SET status = ?, start_date = ? WHERE project_key = ?', ['IN_PROGRESS', startDate, projectKey])
    const [acctRows] = await pool.query('SELECT accounting FROM project_accounting WHERE projectId = ?', [projectKey])
    if (acctRows && acctRows.length > 0) {
      const acct = typeof acctRows[0].accounting === 'string' ? JSON.parse(acctRows[0].accounting) : acctRows[0].accounting
      acct.workers = (acct.workers || []).map((w) => ({ ...w, status: 'WORKING' }))
      acct.logs = acct.logs || []
      acct.logs.push({ id: `log-${Date.now()}`, time: new Date().toISOString(), action: 'project-start' })
      await pool.query('REPLACE INTO project_accounting (projectId, accounting) VALUES (?, ?)', [projectKey, JSON.stringify(acct)])
    }
    res.json({ success: true })
  } catch (err) {
    console.error('/api/db/projects start error', err && err.message ? err.message : err)
    res.status(500).json({ error: 'DB' })
  }
})

app.put('/api/db/projects/:projectKey/complete', async (req, res) => {
  try {
    const { projectKey } = req.params
    const endDate = req.body.endDate || new Date().toISOString().slice(0, 10)
    await pool.query('UPDATE projects SET status = ?, end_date = ? WHERE project_key = ?', ['COMPLETED', endDate, projectKey])
    const [acctRows] = await pool.query('SELECT accounting FROM project_accounting WHERE projectId = ?', [projectKey])
    if (acctRows && acctRows.length > 0) {
      const acct = typeof acctRows[0].accounting === 'string' ? JSON.parse(acctRows[0].accounting) : acctRows[0].accounting
      acct.workers = (acct.workers || []).map((w) => ({ ...w, status: 'PENDING_PAYMENT' }))
      acct.logs = acct.logs || []
      acct.logs.push({ id: `log-${Date.now()}`, time: new Date().toISOString(), action: 'project-complete' })
      await pool.query('REPLACE INTO project_accounting (projectId, accounting) VALUES (?, ?)', [projectKey, JSON.stringify(acct)])
    }
    res.json({ success: true })
  } catch (err) {
    console.error('/api/db/projects complete error', err && err.message ? err.message : err)
    res.status(500).json({ error: 'DB' })
  }
})

app.post('/api/db/projects/:projectKey/pay', async (req, res) => {
  try {
    const { projectKey } = req.params
    const { userId, amount } = req.body
    if (!userId) return res.status(400).json({ error: 'Missing userId' })
    const [projRows] = await pool.query('SELECT id FROM projects WHERE project_key = ?', [projectKey])
    if (!projRows || projRows.length === 0) return res.status(404).json({ error: 'Project not found' })
    const projectId = projRows[0].id
    await pool.query('UPDATE project_workers SET status = ?, paid_at = NOW() WHERE project_id = ? AND user_id = ?', ['PAID', projectId, userId])
    const [acctRows] = await pool.query('SELECT accounting FROM project_accounting WHERE projectId = ?', [projectKey])
    if (acctRows && acctRows.length > 0) {
      const acct = typeof acctRows[0].accounting === 'string' ? JSON.parse(acctRows[0].accounting) : acctRows[0].accounting
      acct.workers = (acct.workers || []).map((w) => (String(w.id) === String(userId) ? { ...w, status: 'PAID', paidAt: new Date().toISOString() } : w))
      acct.logs = acct.logs || []
      acct.logs.push({ id: `log-${Date.now()}`, time: new Date().toISOString(), action: 'pay-worker', details: `user ${userId} amount ${amount || 0}` })
      await pool.query('REPLACE INTO project_accounting (projectId, accounting) VALUES (?, ?)', [projectKey, JSON.stringify(acct)])
    }
    const [acctCheckRows] = await pool.query('SELECT accounting FROM project_accounting WHERE projectId = ?', [projectKey])
    if (acctCheckRows && acctCheckRows.length > 0) {
      const acct = typeof acctCheckRows[0].accounting === 'string' ? JSON.parse(acctCheckRows[0].accounting) : acctCheckRows[0].accounting
      const allPaid = (acct.workers || []).every((w) => w.status === 'PAID')
      if (allPaid) {
        await pool.query('UPDATE projects SET status = ? WHERE project_key = ?', ['CLOSED', projectKey])
      }
    }
    res.json({ success: true })
  } catch (err) {
    console.error('/api/db/projects pay error', err && err.message ? err.message : err)
    res.status(500).json({ error: 'DB' })
  }
})

// Simple lead capture endpoint
const emailCache = new Map();
const CACHE_EXPIRY = 60000;
app.post('/api/lead', async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Invalid email' });
  const now = Date.now();
  if (emailCache.has(email) && now - emailCache.get(email) < CACHE_EXPIRY) return res.json({ success: true, message: 'Duplicate' });
  emailCache.set(email, now);
  try { console.log('Lead received:', email); res.json({ success: true }); } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Subscribe endpoint that inserts into suscripteds
app.post('/api/subscribe', async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') return res.status(400).json({ error: 'Email required' });
  try {
    const exists = await queryRows('SELECT id FROM suscripteds WHERE email = ?', [email]);
    if (exists.length > 0) return res.status(409).json({ error: 'Already subscribed' });
    await pool.query('INSERT INTO suscripteds (email) VALUES (?)', [email]);
    res.status(201).json({ message: 'Subscribed' });
  } catch (err) {
    console.error('subscribe error', err.message);
    res.status(500).json({ error: 'DB error' });
  }
});

// ------------------------
// Job applications / resignations
// ------------------------

// Submit job application (user)
app.post('/api/db/apply', async (req, res) => {
  try {
    const { name, email, skills, availability, message, resume } = req.body
    const userId = req.user.id
    if (!userId || !name || !email) return res.status(400).json({ error: 'Missing fields' })
    // Insert into job_applications table
    await pool.query('INSERT INTO job_applications (user_id, name, email, skills, availability, message, resume, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())', [userId, name, email, skills || null, availability || null, message || null, resume || null, 'SUBMITTED'])
    res.status(201).json({ success: true })
  } catch (err) {
    console.error('/api/db/apply error', err && err.message ? err.message : err)
    res.status(500).json({ error: 'DB' })
  }
})

// List all applications (admin)
app.get('/api/db/applications', async (req, res) => {
  try {
    const rows = await queryRows('SELECT id, user_id AS userId, name, email, skills, availability, message, resume, status, admin_response AS adminResponse, created_at AS createdAt, updated_at AS updatedAt FROM job_applications ORDER BY created_at DESC')
    res.json(rows)
  } catch (err) {
    console.error('/api/db/applications GET error', err && err.message ? err.message : err)
    res.status(500).json({ error: 'DB' })
  }
})

// Get single application
app.get('/api/db/applications/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'Invalid id' })
    const rows = await queryRows('SELECT * FROM job_applications WHERE id = ?', [id])
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) {
    console.error('/api/db/applications/:id GET error', err && err.message ? err.message : err)
    res.status(500).json({ error: 'DB' })
  }
})

// Review application (approve/reject) - admin action
app.put('/api/db/applications/:id/review', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { status, adminResponse } = req.body
    if (!id || !status) return res.status(400).json({ error: 'Missing fields' })
    const allowed = ['UNDER_REVIEW','APPROVED','REJECTED']
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' })
    await pool.query('UPDATE job_applications SET status = ?, admin_response = ?, updated_at = NOW() WHERE id = ?', [status, adminResponse || null, id])

    if (status === 'APPROVED') {
      // promote user to worker role and set worker record waiting for assignment
      const [rows] = await pool.query('SELECT user_id FROM job_applications WHERE id = ?', [id])
      const userId = rows && rows[0] && rows[0].user_id ? rows[0].user_id : null
      if (userId) {
        await pool.query('UPDATE users SET role = ?, session_version = session_version + 1 WHERE id = ?', ['worker', userId])
        // create project_workers entry without project to mark WAITING_FOR_ASSIGNMENT if table supports it
        try {
          await pool.query('INSERT INTO project_workers (project_id, user_id, role, status, assigned_at) VALUES (?, ?, ?, ?, NOW())', [0, userId, 'worker', 'WAITING_FOR_ASSIGNMENT'])
        } catch (e) {
          // ignore if FK fails or project_workers schema doesn't accept project_id = 0
        }
      }
    }

    res.json({ success: true })
  } catch (err) {
    console.error('/api/db/applications review error', err && err.message ? err.message : err)
    res.status(500).json({ error: 'DB' })
  }
})

// Worker resignation endpoint - changes role to user and logs transition
app.post('/api/db/users/:id/resign', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { reason, effectiveDate } = req.body || {}
    if (!id) return res.status(400).json({ error: 'Invalid id' })
    if (id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })
    // change role to user but do not delete account
    await pool.query('UPDATE users SET role = ?, session_version = session_version + 1 WHERE id = ? AND role <> ?', ['user', id, 'admin'])
    // optional: mark project_workers rows as RESIGNED
    try {
      await pool.query('UPDATE project_workers SET status = ?, paid_at = COALESCE(paid_at, NOW()) WHERE user_id = ? AND status != ?', ['RESIGNED', id, 'PAID'])
    } catch (e) {
      // ignore
    }
    // insert into role_transitions audit if exists
    try {
      await pool.query('INSERT INTO role_transitions (user_id, from_role, to_role, reason, created_at) VALUES (?, ?, ?, ?, NOW())', [id, 'worker', 'user', reason || null])
    } catch (e) {
      // ignore if table missing
    }
    if (id === req.user.id) {
      const [r] = await pool.query('SELECT id, email, name, role, session_version FROM users WHERE id = ?', [id])
      if (r && r[0]) res.setHeader('Set-Cookie', sessionLib.cookieHeader(sessionLib.signSession({ uid: Number(r[0].id), role: sessionLib.normalizeRole(r[0].role), name: r[0].name || '', email: r[0].email, sv: Number(r[0].session_version) || 0 })))
    }
    res.json({ success: true })
  } catch (err) {
    console.error('/api/db/users/:id/resign error', err && err.message ? err.message : err)
    res.status(500).json({ error: 'DB' })
  }
})

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  try {
    const conn = await pool.getConnection();
    conn.release();
    console.log(`Express server listening on http://localhost:${PORT}`);
    console.log('MySQL connection successful:', `host=${process.env.MYSQL_HOST || '127.0.0.1'} port=${process.env.MYSQL_PORT || 3306} database=${process.env.MYSQL_DATABASE || 'paint_power_crm'} user=${process.env.MYSQL_USER || 'root'}`);
  } catch (err) {
    console.error('DB connection failed at startup:', err.message);
  }
});
