-- =====================================================================
-- Paint Power CRM - Esquema BASE (tablas que ya usaba el código)
-- Reconstruido a partir de las consultas en app/api/db/* y apps.js
-- (el zip original no traía data/mysql/init.sql ni scripts/import-db.js).
--
-- Idempotente: solo CREATE TABLE IF NOT EXISTS. En una base existente
-- NO modifica ni borra nada; en una base vacía crea todo desde cero.
-- MySQL 8+ / MariaDB 10.5+
-- =====================================================================
SET NAMES utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bases existentes: agrega users.session_version si falta (compatible MySQL 5.7 / MariaDB, sin IF NOT EXISTS).
-- Se incrementa al cerrar sesión, cambiar contraseña/rol o banear: invalida las cookies anteriores.
SET @pp_col := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'session_version');
SET @pp_sql := IF(@pp_col = 0, 'ALTER TABLE users ADD COLUMN session_version INT NOT NULL DEFAULT 0', 'DO 0');
PREPARE pp_stmt FROM @pp_sql;
EXECUTE pp_stmt;
DEALLOCATE PREPARE pp_stmt;

CREATE TABLE IF NOT EXISTS suscripteds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL DEFAULT '',
  description TEXT NULL,
  time VARCHAR(64) NULL,
  unread TINYINT(1) NOT NULL DEFAULT 1,
  type VARCHAR(32) NULL,
  user_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL DEFAULT '',
  company VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(64) NULL,
  status VARCHAR(32) NULL DEFAULT 'new',
  source VARCHAR(100) NULL,
  value DECIMAL(14,2) NOT NULL DEFAULT 0,
  assignedTo VARCHAR(255) NULL,
  createdAt DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS leads_audit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lead_id INT NOT NULL,
  edited_by VARCHAR(255) NULL,
  edited_at DATETIME NULL,
  changes TEXT NULL,
  KEY idx_leads_audit_lead (lead_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS contacts (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL DEFAULT '',
  email VARCHAR(255) NULL,
  phone VARCHAR(64) NULL,
  company VARCHAR(255) NULL,
  position VARCHAR(255) NULL,
  status VARCHAR(32) NULL DEFAULT 'active',
  lastContact VARCHAR(32) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS deals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL DEFAULT '',
  client VARCHAR(255) NULL,
  value DECIMAL(14,2) NOT NULL DEFAULT 0,
  stage VARCHAR(32) NULL DEFAULT 'lead',
  probability INT NULL DEFAULT 0,
  close_date DATE NULL,
  assigned_to VARCHAR(255) NULL,
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL DEFAULT '',
  category VARCHAR(100) NULL,
  price DECIMAL(14,2) NOT NULL DEFAULT 0,
  unit VARCHAR(50) NULL,
  stock DECIMAL(14,2) NOT NULL DEFAULT 0,
  description TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_key VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  client VARCHAR(255) NULL,
  type VARCHAR(50) NULL,
  location VARCHAR(255) NULL,
  assignee VARCHAR(255) NULL,
  assigned_to VARCHAR(255) NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  expected_duration_days INT NULL,
  budget DECIMAL(14,2) NULL,
  progress INT NOT NULL DEFAULT 0,
  status VARCHAR(50) DEFAULT 'PLANNED',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS project_workers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  role VARCHAR(50) NULL DEFAULT 'worker',
  status VARCHAR(50) NULL,
  salary_rate DECIMAL(14,2) NULL,
  salary_type VARCHAR(20) NULL,
  assigned_at DATETIME NULL,
  paid_at DATETIME NULL,
  UNIQUE KEY uq_project_worker (project_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Legado: contabilidad por proyecto en JSON. Los montos nuevos se guardan
-- normalizados en project_finance (DECIMAL) - ver 02_contabilidad.sql.
CREATE TABLE IF NOT EXISTS project_accounting (
  projectId VARCHAR(255) NOT NULL PRIMARY KEY,
  accounting LONGTEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client VARCHAR(255) NULL,
  project VARCHAR(255) NULL,
  date DATE NULL,
  due_date DATE NULL,
  amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  paid DECIMAL(14,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS quotes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client VARCHAR(255) NULL,
  project VARCHAR(255) NULL,
  date DATE NULL,
  valid_until DATE NULL,
  amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS activities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(20) NULL DEFAULT 'task',
  title VARCHAR(255) NOT NULL DEFAULT '',
  client VARCHAR(255) NULL,
  date DATETIME NULL,
  duration VARCHAR(50) NULL,
  status VARCHAR(20) NULL,
  assigned_to VARCHAR(255) NULL,
  description TEXT NULL,
  starred TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL DEFAULT '',
  assignee VARCHAR(255) NULL,
  priority VARCHAR(10) NULL,
  status VARCHAR(20) NULL,
  dueDate DATE NULL,
  client VARCHAR(255) NULL,
  project VARCHAR(255) NULL,
  description TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  caseNumber VARCHAR(50) NULL,
  client VARCHAR(255) NULL,
  subject VARCHAR(255) NULL,
  priority VARCHAR(10) NULL,
  status VARCHAR(20) NULL DEFAULT 'open',
  assignedTo VARCHAR(255) NULL,
  createdDate DATE NULL,
  lastUpdate DATE NULL,
  description TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS job_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  skills TEXT NULL,
  availability VARCHAR(255) NULL,
  message TEXT NULL,
  resume MEDIUMTEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',
  admin_response TEXT NULL,
  created_at DATETIME NULL,
  updated_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS role_transitions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  from_role VARCHAR(20) NULL,
  to_role VARCHAR(20) NULL,
  reason TEXT NULL,
  created_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
