-- =====================================================================
-- Paint Power CRM - Módulo CONTABLE (2026-10-04)
-- Empleados, días trabajados, nómina, materiales/inventario, compras,
-- consumo por proyecto, proveedores (cuentas por pagar), gastos,
-- pagos de facturas (abonos), renglones de factura, crédito de clientes,
-- finanzas por proyecto normalizadas (antes en JSON).
--
-- Idempotente y NO destructivo: solo CREATE TABLE IF NOT EXISTS.
-- No altera ni borra tablas existentes. Todo el dinero en DECIMAL(14,2).
-- =====================================================================
SET NAMES utf8mb4;

-- ---------- Empleados ----------
CREATE TABLE IF NOT EXISTS employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  position VARCHAR(100) NULL,               -- pintor, ayudante, supervisor...
  phone VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  document_id VARCHAR(50) NULL,
  pay_type VARCHAR(10) NOT NULL DEFAULT 'daily',   -- daily | hourly
  pay_rate DECIMAL(14,2) NOT NULL DEFAULT 0,
  status VARCHAR(10) NOT NULL DEFAULT 'active',    -- active | inactive
  start_date DATE NULL,
  end_date DATE NULL,
  user_id INT NULL,                          -- enlace opcional a users (login de empleado)
  notes TEXT NULL,
  legacy_ref VARCHAR(255) NULL,              -- origen si vino del JSON legado
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_emp_status (status),
  KEY idx_emp_user (user_id),
  UNIQUE KEY uq_emp_legacy (legacy_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Días trabajados (asistencia) ----------
-- amount = days * rate (diario) o hours * rate (por hora); rate se congela al registrar.
CREATE TABLE IF NOT EXISTS employee_attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  work_date DATE NOT NULL,
  project_id INT NULL,
  days DECIMAL(5,2) NOT NULL DEFAULT 1,
  hours DECIMAL(5,2) NOT NULL DEFAULT 8,
  pay_type VARCHAR(10) NOT NULL DEFAULT 'daily',
  rate DECIMAL(14,2) NOT NULL DEFAULT 0,
  amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes VARCHAR(500) NULL,
  legacy_ref VARCHAR(255) NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_att_emp_date (employee_id, work_date),
  KEY idx_att_date (work_date),
  KEY idx_att_project (project_id),
  UNIQUE KEY uq_att_legacy (legacy_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Pagos / adelantos / bonos / descuentos a empleados ----------
-- saldo = sum(asistencia) + bonos - pagos - adelantos - descuentos
CREATE TABLE IF NOT EXISTS employee_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  pay_date DATE NOT NULL,
  type VARCHAR(12) NOT NULL DEFAULT 'payment',   -- payment | advance | bonus | deduction
  amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  method VARCHAR(30) NULL,                       -- cash | transfer | check | zelle ...
  period_start DATE NULL,
  period_end DATE NULL,
  project_id INT NULL,
  notes VARCHAR(500) NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_emppay_emp_date (employee_id, pay_date),
  KEY idx_emppay_date (pay_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Proveedores ----------
CREATE TABLE IF NOT EXISTS suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  payment_terms_days INT NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_supplier_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Catálogo de materiales ----------
CREATE TABLE IF NOT EXISTS materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) NULL,
  category VARCHAR(100) NULL,               -- pintura, primer, cinta, rodillos...
  unit VARCHAR(30) NOT NULL DEFAULT 'unit', -- gal, cubeta, rollo, unidad...
  unit_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  sale_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  supplier_id INT NULL,
  min_stock DECIMAL(14,2) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_mat_supplier (supplier_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Compras de materiales (entradas a inventario) ----------
-- payment_status: paid (pagado de contado) | credit (a crédito, cuenta por pagar)
CREATE TABLE IF NOT EXISTS material_purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_date DATE NOT NULL,
  material_id INT NOT NULL,
  supplier_id INT NULL,
  project_id INT NULL,
  quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  total DECIMAL(14,2) NOT NULL DEFAULT 0,
  payment_status VARCHAR(10) NOT NULL DEFAULT 'paid',
  payment_method VARCHAR(30) NULL,
  due_date DATE NULL,
  invoice_ref VARCHAR(100) NULL,
  notes VARCHAR(500) NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_mp_date (purchase_date),
  KEY idx_mp_material (material_id),
  KEY idx_mp_supplier (supplier_id),
  KEY idx_mp_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Consumo de materiales por proyecto (salidas) ----------
CREATE TABLE IF NOT EXISTS material_usage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usage_date DATE NOT NULL,
  material_id INT NOT NULL,
  project_id INT NULL,
  quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(14,2) NOT NULL DEFAULT 0,  -- costo promedio al momento del consumo
  total DECIMAL(14,2) NOT NULL DEFAULT 0,
  purchase_id INT NULL,                         -- si se generó automáticamente desde una compra
  employee_id INT NULL,
  notes VARCHAR(500) NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_mu_date (usage_date),
  KEY idx_mu_material (material_id),
  KEY idx_mu_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Pagos a proveedores (abonos a cuentas por pagar) ----------
CREATE TABLE IF NOT EXISTS supplier_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_id INT NOT NULL,
  pay_date DATE NOT NULL,
  amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  method VARCHAR(30) NULL,
  reference VARCHAR(100) NULL,
  notes VARCHAR(500) NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_sp_supplier (supplier_id),
  KEY idx_sp_date (pay_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Gastos generales ----------
CREATE TABLE IF NOT EXISTS expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  expense_date DATE NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'other',
  description VARCHAR(255) NULL,
  amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  payee VARCHAR(255) NULL,
  project_id INT NULL,
  payment_method VARCHAR(30) NULL,
  receipt_ref VARCHAR(255) NULL,
  notes VARCHAR(500) NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_exp_date (expense_date),
  KEY idx_exp_cat (category),
  KEY idx_exp_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Abonos / pagos de facturas (cuentas por cobrar) ----------
-- invoices.paid y invoices.status se recalculan desde aquí.
CREATE TABLE IF NOT EXISTS invoice_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  pay_date DATE NOT NULL,
  amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  method VARCHAR(30) NULL,
  reference VARCHAR(100) NULL,
  notes VARCHAR(500) NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ip_invoice (invoice_id),
  KEY idx_ip_date (pay_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Renglones de factura (desde la lista de precios) ----------
CREATE TABLE IF NOT EXISTS invoice_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  item_type VARCHAR(10) NOT NULL DEFAULT 'custom',  -- product | material | tax | custom
  ref_id INT NULL,
  description VARCHAR(255) NOT NULL DEFAULT '',
  quantity DECIMAL(14,3) NOT NULL DEFAULT 1,
  unit_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  total DECIMAL(14,2) NOT NULL DEFAULT 0,
  KEY idx_ii_invoice (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Cuenta de crédito por cliente ----------
-- invoices.client es texto libre; se enlaza por nombre exacto.
CREATE TABLE IF NOT EXISTS client_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_name VARCHAR(255) NOT NULL,
  credit_limit DECIMAL(14,2) NOT NULL DEFAULT 0,
  payment_terms_days INT NOT NULL DEFAULT 30,
  phone VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_client_name (client_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Finanzas por proyecto (normaliza el JSON de project_accounting) ----------
CREATE TABLE IF NOT EXISTS project_finance (
  project_key VARCHAR(255) NOT NULL PRIMARY KEY,
  total_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  labor DECIMAL(14,2) NOT NULL DEFAULT 0,
  materials DECIMAL(14,2) NOT NULL DEFAULT 0,
  materials_charged DECIMAL(14,2) NOT NULL DEFAULT 0,
  insurance DECIMAL(14,2) NOT NULL DEFAULT 0,
  profit DECIMAL(14,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
