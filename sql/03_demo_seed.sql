-- =====================================================================
-- Paint Power CRM · 03_demo_seed.sql  (OPCIONAL – solo para pruebas)
-- Datos de ejemplo marcados con "[DEMO]". Idempotente: cada INSERT
-- solo se ejecuta si el registro demo no existe.
-- NO lo cargues en producción con datos reales salvo que quieras demo.
-- Para borrar todo lo demo, ver el bloque comentado al final.
-- =====================================================================
SET NAMES utf8mb4;

-- Proyecto demo
INSERT INTO projects (project_key, name, client, type, location, start_date, budget, progress, status)
SELECT 'DEMO-001', '[DEMO] Casa Rivera - Interior', '[DEMO] Familia Rivera', 'interior', 'Orlando, FL', CURDATE() - INTERVAL 20 DAY, 8500.00, 40, 'in-progress'
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE project_key = 'DEMO-001');
SET @p := (SELECT id FROM projects WHERE project_key = 'DEMO-001' LIMIT 1);

-- Empleados
INSERT INTO employees (name, position, pay_type, pay_rate, status, start_date, notes)
SELECT '[DEMO] Carlos Pérez', 'Pintor', 'daily', 180.00, 'active', CURDATE() - INTERVAL 90 DAY, '[DEMO]'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE name = '[DEMO] Carlos Pérez');
INSERT INTO employees (name, position, pay_type, pay_rate, status, start_date, notes)
SELECT '[DEMO] Luis Gómez', 'Ayudante', 'hourly', 18.50, 'active', CURDATE() - INTERVAL 60 DAY, '[DEMO]'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE name = '[DEMO] Luis Gómez');
SET @e1 := (SELECT id FROM employees WHERE name = '[DEMO] Carlos Pérez' LIMIT 1);
SET @e2 := (SELECT id FROM employees WHERE name = '[DEMO] Luis Gómez' LIMIT 1);

-- Días trabajados (tarifa congelada en cada fila)
INSERT INTO employee_attendance (employee_id, work_date, project_id, days, hours, pay_type, rate, amount, notes, legacy_ref)
SELECT @e1, CURDATE() - INTERVAL n DAY, @p, 1, 0, 'daily', 180.00, 180.00, '[DEMO]', CONCAT('demo-e1-', n)
FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) d
WHERE NOT EXISTS (SELECT 1 FROM employee_attendance WHERE legacy_ref = CONCAT('demo-e1-', d.n));
INSERT INTO employee_attendance (employee_id, work_date, project_id, days, hours, pay_type, rate, amount, notes, legacy_ref)
SELECT @e2, CURDATE() - INTERVAL n DAY, @p, 1, 8, 'hourly', 18.50, 148.00, '[DEMO]', CONCAT('demo-e2-', n)
FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3) d
WHERE NOT EXISTS (SELECT 1 FROM employee_attendance WHERE legacy_ref = CONCAT('demo-e2-', d.n));

-- Pago y adelanto
INSERT INTO employee_payments (employee_id, pay_date, type, amount, method, notes)
SELECT @e1, CURDATE() - INTERVAL 1 DAY, 'payment', 500.00, 'cash', '[DEMO] pago semanal'
WHERE NOT EXISTS (SELECT 1 FROM employee_payments WHERE notes = '[DEMO] pago semanal');
INSERT INTO employee_payments (employee_id, pay_date, type, amount, method, notes)
SELECT @e2, CURDATE() - INTERVAL 2 DAY, 'advance', 100.00, 'zelle', '[DEMO] adelanto'
WHERE NOT EXISTS (SELECT 1 FROM employee_payments WHERE notes = '[DEMO] adelanto');

-- Proveedor y materiales
INSERT INTO suppliers (name, contact, phone, payment_terms_days, notes)
SELECT '[DEMO] Sherwin Supply', 'Ana', '555-0100', 30, '[DEMO]'
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE name = '[DEMO] Sherwin Supply');
SET @s := (SELECT id FROM suppliers WHERE name = '[DEMO] Sherwin Supply' LIMIT 1);
INSERT INTO materials (name, sku, category, unit, unit_cost, sale_price, supplier_id, min_stock, active, notes)
SELECT '[DEMO] Pintura interior blanca', 'DEMO-PINT-01', 'Pintura', 'gal', 32.00, 48.00, @s, 5, 1, '[DEMO]'
WHERE NOT EXISTS (SELECT 1 FROM materials WHERE sku = 'DEMO-PINT-01');
INSERT INTO materials (name, sku, category, unit, unit_cost, sale_price, supplier_id, min_stock, active, notes)
SELECT '[DEMO] Cinta de enmascarar', 'DEMO-CINTA-01', 'Insumos', 'rollo', 4.50, 7.00, @s, 10, 1, '[DEMO]'
WHERE NOT EXISTS (SELECT 1 FROM materials WHERE sku = 'DEMO-CINTA-01');
SET @m1 := (SELECT id FROM materials WHERE sku = 'DEMO-PINT-01' LIMIT 1);
SET @m2 := (SELECT id FROM materials WHERE sku = 'DEMO-CINTA-01' LIMIT 1);

INSERT INTO material_purchases (purchase_date, material_id, supplier_id, quantity, unit_cost, total, payment_status, due_date, invoice_ref, notes)
SELECT CURDATE() - INTERVAL 10 DAY, @m1, @s, 20, 32.00, 640.00, 'credit', CURDATE() + INTERVAL 20 DAY, 'DEMO-F-1001', '[DEMO]'
WHERE NOT EXISTS (SELECT 1 FROM material_purchases WHERE invoice_ref = 'DEMO-F-1001');
INSERT INTO material_purchases (purchase_date, material_id, supplier_id, quantity, unit_cost, total, payment_status, payment_method, invoice_ref, notes)
SELECT CURDATE() - INTERVAL 10 DAY, @m2, @s, 30, 4.50, 135.00, 'paid', 'card', 'DEMO-F-1002', '[DEMO]'
WHERE NOT EXISTS (SELECT 1 FROM material_purchases WHERE invoice_ref = 'DEMO-F-1002');
INSERT INTO material_usage (usage_date, material_id, project_id, quantity, unit_cost, total, notes)
SELECT CURDATE() - INTERVAL 5 DAY, @m1, @p, 12, 32.00, 384.00, '[DEMO] consumo'
WHERE NOT EXISTS (SELECT 1 FROM material_usage WHERE notes = '[DEMO] consumo');
INSERT INTO supplier_payments (supplier_id, pay_date, amount, method, reference, notes)
SELECT @s, CURDATE() - INTERVAL 3 DAY, 300.00, 'check', 'CHK-DEMO-1', '[DEMO]'
WHERE NOT EXISTS (SELECT 1 FROM supplier_payments WHERE reference = 'CHK-DEMO-1');

-- Gastos
INSERT INTO expenses (expense_date, category, description, amount, payee, project_id, payment_method, notes)
SELECT CURDATE() - INTERVAL 4 DAY, 'fuel', 'Gasolina camioneta', 85.40, 'Shell', NULL, 'card', '[DEMO] gasolina'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE notes = '[DEMO] gasolina');
INSERT INTO expenses (expense_date, category, description, amount, payee, project_id, payment_method, notes)
SELECT CURDATE() - INTERVAL 6 DAY, 'equipment_rental', 'Andamio 1 semana', 220.00, 'RentAll', @p, 'transfer', '[DEMO] andamio'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE notes = '[DEMO] andamio');

-- Lista de precios (servicio)
INSERT INTO products (name, category, price, unit, stock, description)
SELECT '[DEMO] Pintura interior (m2)', 'Servicio', 12.00, 'm2', 0, '[DEMO]'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = '[DEMO] Pintura interior (m2)');

-- Cliente con crédito, factura con línea y abono parcial
INSERT INTO client_accounts (client_name, credit_limit, payment_terms_days, notes)
SELECT '[DEMO] Familia Rivera', 5000.00, 15, '[DEMO]'
WHERE NOT EXISTS (SELECT 1 FROM client_accounts WHERE client_name = '[DEMO] Familia Rivera');
INSERT INTO invoices (client, project, date, due_date, amount, paid, status)
SELECT '[DEMO] Familia Rivera', '[DEMO] Casa Rivera - Interior', CURDATE() - INTERVAL 40 DAY, CURDATE() - INTERVAL 25 DAY, 3000.00, 1000.00, 'partial'
WHERE NOT EXISTS (SELECT 1 FROM invoices WHERE client = '[DEMO] Familia Rivera');
SET @i := (SELECT id FROM invoices WHERE client = '[DEMO] Familia Rivera' ORDER BY id LIMIT 1);
INSERT INTO invoice_items (invoice_id, item_type, description, quantity, unit_price, total)
SELECT @i, 'custom', 'Pintura interior 250 m2', 250, 12.00, 3000.00
WHERE NOT EXISTS (SELECT 1 FROM invoice_items WHERE invoice_id = @i);
INSERT INTO invoice_payments (invoice_id, pay_date, amount, method, reference, notes)
SELECT @i, CURDATE() - INTERVAL 30 DAY, 1000.00, 'zelle', 'DEMO-ABONO-1', '[DEMO]'
WHERE NOT EXISTS (SELECT 1 FROM invoice_payments WHERE reference = 'DEMO-ABONO-1');

-- Para borrar los datos demo (ejecutar a mano):
-- DELETE FROM invoice_payments WHERE notes='[DEMO]'; DELETE ii FROM invoice_items ii JOIN invoices i ON i.id=ii.invoice_id WHERE i.client LIKE '[DEMO]%';
-- DELETE FROM invoices WHERE client LIKE '[DEMO]%'; DELETE FROM client_accounts WHERE notes='[DEMO]'; DELETE FROM products WHERE description='[DEMO]';
-- DELETE FROM expenses WHERE notes LIKE '[DEMO]%'; DELETE FROM supplier_payments WHERE notes='[DEMO]'; DELETE FROM material_usage WHERE notes LIKE '[DEMO]%';
-- DELETE FROM material_purchases WHERE notes='[DEMO]'; DELETE FROM materials WHERE notes='[DEMO]'; DELETE FROM suppliers WHERE notes='[DEMO]';
-- DELETE FROM employee_payments WHERE notes LIKE '[DEMO]%'; DELETE FROM employee_attendance WHERE notes='[DEMO]'; DELETE FROM employees WHERE notes='[DEMO]';
-- DELETE FROM projects WHERE project_key='DEMO-001';
