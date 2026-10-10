#!/usr/bin/env node
// Crea / actualiza la base de datos ejecutando sql/01_schema_base.sql y sql/02_contabilidad.sql.
// Idempotente (CREATE TABLE IF NOT EXISTS): seguro sobre una base existente.
//   npm run db:import            -> esquema base + módulo contable
//   npm run db:import -- --demo  -> además carga datos de demostración (sql/03_demo_seed.sql)
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

(async () => {
  if (!process.env.MYSQL_PASSWORD) {
    console.error('Falta MYSQL_PASSWORD (configure .env, ver .env.example)');
    process.exit(1);
  }
  const database = process.env.MYSQL_DATABASE || 'paint_power_crm';
  if (!/^[A-Za-z0-9_]+$/.test(database)) { console.error('MYSQL_DATABASE inválido'); process.exit(1); }
  const files = ['01_schema_base.sql', '02_contabilidad.sql'];
  if (process.argv.includes('--demo')) files.push('03_demo_seed.sql');
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD,
    multipleStatements: true,
  });
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } catch (e) {
    console.warn('Aviso: no se pudo crear la base (puede que ya exista o falten permisos):', e.message);
  }
  await conn.query(`USE \`${database}\``);
  for (const f of files) {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', f), 'utf8');
    process.stdout.write(`Ejecutando sql/${f} ... `);
    await conn.query(sql);
    console.log('OK');
  }
  const [t] = await conn.query('SHOW TABLES');
  console.log(`Listo. Tablas en ${database}: ${t.length}`);
  await conn.end();
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
