// Startup check shared by server.js and apps.js (TypeScript twin: lib/env.ts).
// Refuses missing values AND the placeholders shipped in .env.example / old defaults.
const REQUIRED = ['MYSQL_PASSWORD', 'SESSION_SECRET', 'ADMIN_PASSWORD'];
const PLACEHOLDERS = new Set([
  'admin123', 'admin', 'administrator', 'changeme', 'change_me', 'change-me', 'changeit', 'change',
  'password', 'password1', 'password123', 'passw0rd', 'secret', 'secret123', 'root', 'toor', 'mysql',
  '123456', '12345678', '123456789', 'qwerty', 'paintpower', 'paint_power', 'default', 'example',
  'test', 'test123', 'placeholder', 'your_password', 'yourpassword', 'your-password', 'your_secret',
  'your-secret', 'xxx', 'xxxx', 'todo', 'contraseña', 'contrasena', 'clave',
]);

function isPlaceholder(v) {
  const l = String(v).trim().toLowerCase();
  return l.startsWith('cambiar') || l.startsWith('changeme') || l.startsWith('change_me') || PLACEHOLDERS.has(l);
}

function envProblems(env = process.env) {
  const out = [];
  for (const k of REQUIRED) {
    const v = String(env[k] == null ? '' : env[k]).trim();
    if (!v) out.push(`${k} (falta)`);
    else if (isPlaceholder(v)) out.push(`${k} (tiene un valor de ejemplo o por defecto; ponga uno real)`);
  }
  const s = String(env.SESSION_SECRET || '').trim();
  if (s && !isPlaceholder(s) && s.length < 32) out.push('SESSION_SECRET (mínimo 32 caracteres)');
  return out;
}

function assertEnvOrExit(label = 'Paint Power CRM') {
  const p = envProblems();
  if (p.length) {
    console.error(`\n[${label}] NO SE PUEDE INICIAR. Variables de entorno faltantes o inválidas: ${p.join(', ')}\n` +
      'Configúrelas en .env (ver .env.example) o en el panel del hosting y reinicie.\n');
    process.exit(1);
  }
}

module.exports = { REQUIRED, PLACEHOLDERS, isPlaceholder, envProblems, assertEnvOrExit };
