#!/usr/bin/env node
// Normaliza la contabilidad legada guardada como JSON en project_accounting.accounting:
//  - montos del proyecto  -> project_finance (DECIMAL(14,2))
//  - trabajadores         -> employees (por nombre; legacy_ref evita duplicados)
//  - días de trabajo      -> employee_attendance (legacy_ref evita duplicados)
// Idempotente: se puede ejecutar varias veces. No borra ni modifica el JSON original.
//   npm run db:migrate-legacy            (aplica)
//   npm run db:migrate-legacy -- --dry   (solo muestra lo que haría)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const DRY = process.argv.includes('--dry');
const n2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

(async () => {
  if (!process.env.MYSQL_PASSWORD) { console.error('Falta MYSQL_PASSWORD'); process.exit(1); }
  const db = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1', port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root', password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || 'paint_power_crm', dateStrings: true,
  });
  const [rows] = await db.query('SELECT projectId, accounting FROM project_accounting');
  let pf = 0, emps = 0, days = 0;
  for (const r of rows) {
    let a; try { a = typeof r.accounting === 'string' ? JSON.parse(r.accounting) : r.accounting; } catch { continue; }
    if (!a) continue;
    const key = String(r.projectId);
    const [[proj]] = await db.query('SELECT id, start_date FROM projects WHERE project_key = ? OR id = ? LIMIT 1', [key, key]);
    if (!DRY) await db.query(
      `INSERT INTO project_finance (project_key,total_price,labor,materials,materials_charged,insurance,profit) VALUES (?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE total_price=VALUES(total_price),labor=VALUES(labor),materials=VALUES(materials),materials_charged=VALUES(materials_charged),insurance=VALUES(insurance),profit=VALUES(profit)`,
      [key, n2(a.totalPrice), n2(a.labor), n2(a.materials), n2(a.materialsCharged), n2(a.insurance), n2(a.profit)]);
    pf++;
    for (const w of a.workers || []) {
      const name = String(w.name || `Trabajador ${w.id}`).trim();
      const empRef = `legacy-user-${w.id}`;
      const payType = w.salaryType === 'hourly' ? 'hourly' : 'daily';
      let empId;
      const uid = /^\d+$/.test(String(w.id)) ? Number(w.id) : -1;
      const [[ex]] = await db.query('SELECT id FROM employees WHERE legacy_ref = ? OR user_id = ? LIMIT 1', [empRef, uid]);
      if (ex) empId = ex.id;
      else if (!DRY) {
        const [ins] = await db.query('INSERT INTO employees (name, pay_type, pay_rate, status, user_id, legacy_ref, notes) VALUES (?,?,?,?,?,?,?)',
          [name, payType, n2(w.salaryRate), 'active', /^\d+$/.test(String(w.id)) ? Number(w.id) : null, empRef, 'Importado de project_accounting (JSON)']);
        empId = ins.insertId; emps++;
      } else emps++;
      let i = 0;
      for (const d of w.days || []) {
        i++;
        const ref = `legacy-${key}-${w.id}-${d.id || i}`;
        // legacy days have only a weekday name; use the project start date (or today) as the date
        const date = (proj && proj.start_date) || new Date().toISOString().slice(0, 10);
        const hours = Number(d.hours) || 8;
        const amount = n2(d.payment);
        if (!DRY && empId) await db.query(
          `INSERT IGNORE INTO employee_attendance (employee_id, work_date, project_id, days, hours, pay_type, rate, amount, notes, legacy_ref)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [empId, date, proj ? proj.id : null, payType === 'daily' ? 1 : 0, hours, payType, n2(w.salaryRate), amount, `Legado: ${d.dayOfWeek || ''}${d.confirmed ? ' (confirmado)' : ''}`, ref]);
        days++;
      }
    }
  }
  console.log(`${DRY ? '[DRY] ' : ''}project_finance: ${pf}, empleados nuevos: ${emps}, días: ${days}`);
  await db.end();
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
