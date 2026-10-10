# Paint Power CRM: módulo contable + seguridad (guía de despliegue)

Esta versión agrega **login con sesión real en el servidor**, permisos por rol y el módulo contable:
empleados, días trabajados, nómina, materiales e inventario, proveedores y cuentas por pagar, gastos,
lista de precios, facturas con abonos parciales, cartera por cliente con antigüedad, libro diario,
estado de resultados y reportes. Todas las pantallas tienen filtro de fechas.

> ⚠️ **Importante (seguridad):** la versión anterior traía la contraseña del admin (`admin123`) escrita
> en el código y **publicada en los archivos JavaScript del sitio**. Cualquiera podía entrar y además
> las rutas `/api/db/*` no pedían login. Después de desplegar esta versión **cambie la contraseña del
> admin y la de MySQL** si alguna vez fueron `admin123` o la que estaba en `config/db-config.js`.

---

## 1. Antes de empezar: respaldo

```bash
mysqldump -u USUARIO -p --single-transaction --routines paint_power_crm > respaldo-$(date +%F).sql
```
Guarde también una copia de la carpeta actual del sitio (incluido `data/db.json` si existe).

## 2. Variables de entorno (OBLIGATORIAS)

Copie `.env.example` como `.env` en la raíz del proyecto (o defínalas en Plesk → Node.js →
*Variables de entorno*) y ponga valores reales. **La app NO arranca** (`server.js`, `next start` y `apps.js`)
si `MYSQL_PASSWORD`, `SESSION_SECRET` o `ADMIN_PASSWORD` faltan, **empiezan por `CAMBIAR`** (los valores de
ejemplo de `.env.example`) o son valores por defecto conocidos (`admin123`, `changeme`, `password`, ...):
muestra `NO SE PUEDE INICIAR. Variables de entorno faltantes o inválidas: ...` y se detiene.

| Variable | Obligatoria | Para qué |
|---|---|---|
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_DATABASE` | no (tienen valor por defecto) | Conexión a MySQL/MariaDB |
| `MYSQL_PASSWORD` | **sí** | Contraseña de MySQL. Ya no hay contraseña por defecto. |
| `SESSION_SECRET` | **sí**, mínimo 32 caracteres | Firma la cookie de sesión. Si la cambia, todos deben volver a entrar. |
| `ADMIN_EMAIL` | recomendado | Email del primer administrador |
| `ADMIN_PASSWORD` | **sí** | Contraseña del primer administrador (solo se usa para crearlo) |
| `ADMIN_NAME` | no | Nombre visible del admin |
| `ADMIN_RESET_PASSWORD` | no (`0`) | Pon `1` **un solo reinicio** si olvidaste la clave del admin; luego vuelve a `0` |
| `ALLOW_PUBLIC_REGISTER` | no (`0`) | `0` = registro público **cerrado** (recomendado): `/register` redirige al login y la API responde 403. `1` = abierto, siempre crea el rol más bajo (`user`) |
| `MYSQL_ROOT_PASSWORD` | solo docker-compose local | |

Generar un `SESSION_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```
Nunca suba `.env` a git ni lo comparta. El zip **no** incluye `.env`.

## 3. Base de datos

El SQL crea **toda la base desde cero** (tablas existentes + nuevas) y es **idempotente**:
solo usa `CREATE TABLE IF NOT EXISTS`, así que es seguro sobre la base actual (no borra ni modifica datos).

```bash
npm ci                         # instala dependencias (si no están)
npm run db:import              # ejecuta sql/01_schema_base.sql y sql/02_contabilidad.sql
# opcional, solo pruebas:  npm run db:import -- --demo   (carga sql/03_demo_seed.sql con datos "[DEMO]")
```
También puede ejecutar los archivos a mano en phpMyAdmin, en este orden: `sql/01_schema_base.sql`,
`sql/02_contabilidad.sql` (y opcionalmente `sql/03_demo_seed.sql`).

Todo el dinero nuevo se guarda en columnas `DECIMAL(14,2)` (no en JSON).
En bases existentes, `sql/01` agrega la columna `users.session_version` solo si falta (compatible con
MySQL 5.7 y MariaDB); la app también la agrega sola al arrancar. Tras actualizar, todos deben volver a entrar una vez.

### Migrar la nómina vieja por proyecto (opcional)
La versión anterior guardaba trabajadores y días por proyecto dentro de un JSON. Para pasarlos a las
tablas nuevas (`employees`, `employee_attendance`, `project_finance`):
```bash
npm run db:migrate-legacy -- --dry   # muestra qué haría, sin escribir
npm run db:migrate-legacy            # migra (se puede repetir, no duplica)
```

## 4. Compilar y reiniciar

```bash
npm ci
npm run build          # next build
```
En Plesk el archivo de arranque es `server.js` (igual que antes). Reinicie la app desde Plesk.
`apps.js` (API Express antigua) ya **no es necesario** si todo corre en el mismo dominio; si lo usa,
también exige las mismas variables y usa la misma sesión y permisos.

Requisito: el sitio debe servirse por **HTTPS** (la cookie de sesión es `Secure`, `HttpOnly`, `SameSite=Lax`).

## 5. Primer administrador

1. Al arrancar, si no existe un usuario con `ADMIN_EMAIL`, se crea con `ADMIN_PASSWORD` y rol `admin`.
   Si ya existe, **no se toca** su contraseña (antes se reseteaba en cada arranque).
2. Entre en `/login` con ese email y contraseña.
3. Si la base ya tenía el admin viejo (`admin@paintpower.com`), cámbiele la contraseña desde
   **Usuarios** o bórrelo, y deje solo el nuevo.
4. ¿Olvidó la clave? Ponga `ADMIN_RESET_PASSWORD=1`, reinicie, entre, y vuelva a `0`.

## 6. Roles y permisos

| Rol | Puede |
|---|---|
| `admin` | Todo, incluida la gestión de usuarios y solicitudes |
| `contador` | Contabilidad, nómina, materiales, gastos, facturas, reportes y CRM. **No** gestiona usuarios |
| `empleado` (también `worker` / `user`) | Solo **sus** días trabajados y pagos (*Mi trabajo*), y sus proyectos asignados |

- Sin sesión: las APIs responden **401** y las páginas redirigen a `/login`.
- Rol sin permiso: **403** (las páginas redirigen a `/my-work` o `/`).
- El rol se verifica contra la base en cada petición.
- **Cierre de sesión inmediato:** cada usuario tiene `session_version`. Al cerrar sesión, cambiar su
  contraseña, cambiar su rol, banearlo o restablecer la clave del admin, el número sube y **todas** sus
  cookies anteriores (en cualquier dispositivo) dejan de servir al instante. Cerrar sesión en un equipo
  cierra también los demás de ese usuario.
- **Registro público cerrado por defecto** (`ALLOW_PUBLIC_REGISTER=0`): el admin crea las cuentas desde **Usuarios**.

**Crear un contador o empleado:** Usuarios → crear trabajador (o admin) → luego cambie su rol con el selector de rol de la lista (admin, contador, empleado…).
**Vincular un empleado con su usuario:** Empleados → editar → campo *Usuario del sistema (ID)* con el ID
del usuario. Así ese empleado ve sus días y pagos en *Mi trabajo*.

## 7. Cómo se calcula

- **Día trabajado:** monto = días × tarifa diaria, o horas × tarifa por hora. La tarifa queda guardada en
  cada día; cambiarla después no altera lo ya registrado.
- **Saldo de nómina:** devengado + bonos − deducciones − pagos − adelantos.
- **Inventario:** stock = compras − consumos; costo promedio ponderado. El consumo se carga al proyecto.
- **Compras a crédito** suman a cuentas por pagar; los pagos a proveedor las bajan.
- **Facturas:** los abonos se registran aparte (`invoice_payments`); el estado (pendiente / parcial /
  pagada / vencida) y el saldo se recalculan solos. La antigüedad se mide desde la fecha de vencimiento.
- **Estado de resultados (devengado):** ingresos facturados − materiales consumidos − mano de obra − gastos.
- **Caja:** cobros − (gastos + compras de contado + pagos a proveedores + pagos de nómina).
- Moneda: USD.

## 8. Verificación rápida después de desplegar

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://SU-DOMINIO/api/db/users    # debe dar 401
curl -s -o /dev/null -w "%{http_code}\n" https://SU-DOMINIO/accounting      # debe dar 307 (a /login)
```
Busque que la clave vieja no esté en el sitio compilado: `grep -rl admin123 .next/` no debe devolver nada.

## 9. Volver atrás

Restaure la carpeta anterior y reinicie. Las tablas nuevas no molestan a la versión vieja. Si hace falta,
restaure el respaldo con `mysql -u USUARIO -p paint_power_crm < respaldo-AAAA-MM-DD.sql`.
