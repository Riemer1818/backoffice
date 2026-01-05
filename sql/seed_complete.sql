-- ============================================
-- COMPLETE SEED DATA FROM BACKUP
-- All companies, projects, time entries, invoices, and expenses
-- ============================================

BEGIN;

-- Clear existing data
TRUNCATE companies, contacts, projects, time_entries, invoices, invoice_items, invoice_time_entries, incoming_invoices CASCADE;

-- ============================================
-- COMPANIES
-- ============================================

INSERT INTO companies (id, type, name, main_contact_person, email, phone, street_address, postal_code, city, country, btw_number, kvk_number, notes, is_active, created_at, updated_at)
VALUES
  -- Real clients
  (1, 'client', 'Joosten Investments B.V.', 'Ian Joosten', 'ian.joosten@gmail.com', '+31641588640', 'Prinsengracht 343 D', '1016 HK', 'Amsterdam', 'Netherlands', 'NL861929627B01', NULL, NULL, true, '2025-12-09 13:08:48.208891', '2025-12-11 14:00:41.789888'),
  (2, 'client', 'Moods AI B.V. i.o.', 'Jaime Essed', NULL, NULL, 'Sarphatistraat 141C', '1018GD', 'Amsterdam', 'Netherlands', NULL, NULL, 'Note vanuit Jaime: belangrijk dat er "i.o." op de factuur staat zoals hierboven. De notaris verwerkt de oprichting pas in januari voor de nieuwe B.V.', true, '2025-12-10 21:33:50.619485', '2025-12-18 17:03:39.280459'),

  -- Internal company for personal projects
  (999, 'client', 'Internal / Personal Projects', NULL, NULL, NULL, NULL, NULL, NULL, 'Netherlands', NULL, NULL, NULL, true, NOW(), NOW()),

  -- Suppliers (from expenses)
  (1000, 'supplier', 'KVK Kamer van Koophandel', NULL, NULL, NULL, NULL, NULL, NULL, 'Netherlands', NULL, NULL, NULL, true, NOW(), NOW()),
  (1001, 'supplier', 'Odido (voorheen T-Mobile)', NULL, 'klantenservice@odido.nl', '0800-0092', NULL, NULL, NULL, 'Netherlands', NULL, NULL, NULL, true, NOW(), NOW()),
  (1002, 'supplier', 'Hostnet B.V.', NULL, 'support@hostnet.nl', '088-0046786', NULL, NULL, NULL, 'Netherlands', 'NL815283808B01', '30148107', NULL, true, NOW(), NOW()),
  (1003, 'supplier', 'Microsoft Corporation', NULL, 'support@microsoft.com', NULL, NULL, NULL, NULL, 'Netherlands', NULL, NULL, NULL, true, NOW(), NOW()),
  (1004, 'supplier', 'Google Cloud EMEA Limited', NULL, 'cloud-support@google.com', NULL, NULL, NULL, NULL, 'Netherlands', NULL, NULL, NULL, true, NOW(), NOW()),
  (1005, 'supplier', 'Amazon Web Services EMEA SARL', NULL, 'aws-billing@amazon.com', NULL, NULL, NULL, NULL, 'Netherlands', NULL, NULL, NULL, true, NOW(), NOW());

SELECT setval('companies_id_seq', 1005);

-- ============================================
-- PROJECTS
-- ============================================

INSERT INTO projects (id, name, client_id, description, hourly_rate, status, start_date, end_date, tax_rate_id, currency, created_at, updated_at)
VALUES
  (1, 'Joosten Investments Schilderen', 1, 'schilderwerk work for Ian Joosten', 32.00, 'active', '2023-12-27', NULL, 2, 'EUR', '2025-12-09 13:08:48.211298', '2025-12-10 11:04:07.730097'),
  (3, 'moodsAI-MVP', 2, NULL, 75.00, 'active', '2025-11-25', NULL, 1, 'EUR', '2025-12-10 21:33:56.129126', '2025-12-10 21:35:16.568925'),
  (4, 'participatie-ai', 999, NULL, 0.00, 'active', '2025-11-04', NULL, 3, 'EUR', '2025-12-15 13:23:49.53992', '2025-12-15 13:23:49.53992'),
  (5, 'winwin', 999, NULL, 0.00, 'active', '2025-11-04', NULL, 3, 'EUR', '2025-12-15 13:25:45.073391', '2025-12-15 13:26:11.081588'),
  (6, 'riemer FYI', 999, NULL, 0.00, 'active', '2025-11-05', NULL, 3, 'EUR', '2025-12-24 14:55:38.879496', '2025-12-24 14:55:38.879496');

SELECT setval('projects_id_seq', 6);

-- ============================================
-- TIME ENTRIES
-- ============================================

INSERT INTO time_entries (id, project_id, contact_id, date, start_time, end_time, total_hours, chargeable_hours, location, objective, notes, is_invoiced, created_at, updated_at)
VALUES
  -- Joosten project (invoiced)
  (1, 1, NULL, '2025-11-22', '2025-11-22 09:30:00+00', '2025-11-22 16:00:00+00', 6.50, 6.50, 'remote site', 'Other', 'Dag 2 werk | Previous objective: Schilderen', true, '2025-12-09 13:08:48.21365', '2025-12-10 15:15:24.856964'),
  (2, 1, NULL, '2025-11-21', '2025-11-21 10:00:00+00', '2025-11-21 16:15:00+00', 6.25, 6.25, 'remote site', 'Other', 'Dag 1 werk | Previous objective: Schilderen', true, '2025-12-09 13:08:48.215971', '2025-12-10 15:15:36.406449'),
  (3, 1, NULL, '2025-11-29', '2025-11-29 17:30:00+00', '2025-11-29 22:30:00+00', 5.00, 5.00, 'remote site', 'Other', 'Dag 3 werk | Previous objective: Schilderen', true, '2025-12-09 13:08:48.217052', '2025-12-10 20:50:20.605799'),

  -- Moods project (invoiced)
  (4, 3, NULL, '2025-11-26', '2025-11-26 13:30:00+00', '2025-11-26 14:20:00+00', 0.83, 0.00, 'thuis', 'Other', 'stephan will send me - inlog voor moodsai.ai - plaatsen die mijn speciale aandacht vragen binnen het portaal- het begin van wat user epics. | Previous objective: meet stephan and start talking about the scope', true, '2025-12-10 21:34:33.552672', '2025-12-10 21:34:33.552672'),
  (5, 3, NULL, '2025-11-28', '2025-11-28 11:30:00+00', '2025-11-28 13:45:00+00', 2.25, 2.25, 'thuis', 'Other', 'Bekeken van het materiaal wat mij is gesteurd. de verschillende scoops gecatagoriseerd in AI en niet AI.', true, '2025-12-10 21:34:33.552672', '2025-12-10 21:34:33.552672'),
  (6, 3, NULL, '2025-12-01', '2025-12-01 13:50:00+00', '2025-12-01 14:50:00+00', 1.00, 1.00, 'thuis', 'Other', 'Team meet and partial onboarding', true, '2025-12-10 21:34:33.552672', '2025-12-10 21:34:33.552672'),

  -- Internal projects (not invoiced)
  (13, 4, NULL, '2025-12-15', '2025-12-15 15:00:00+00', '2025-12-15 19:00:00+00', 4.00, 4.00, 'home', 'Research and Development', 'met Ian. lijkt alsof whatsapp gefixed is.', false, '2025-12-15 18:47:04.560183', '2025-12-15 18:47:23.763626'),
  (16, 6, NULL, '2025-12-24', '2025-12-24 12:00:00+00', '2025-12-24 16:00:00+00', 4.00, 0.00, NULL, 'Administrative', 'WBSO aanvraag', false, '2025-12-24 14:56:11.220675', '2025-12-24 14:56:11.220675'),
  (17, 5, NULL, '2025-12-29', '2025-12-29 11:00:00+00', '2025-12-29 18:00:00+00', 7.00, 0.00, NULL, 'Research and Development', NULL, false, '2025-12-29 14:11:00.613174', '2025-12-29 14:11:00.613174');

SELECT setval('time_entries_id_seq', 17);

-- ============================================
-- INVOICES (OUTGOING)
-- ============================================

INSERT INTO invoices (id, invoice_number, client_id, project_id, invoice_date, due_date, status, subtotal, tax_amount, total_amount, payment_terms_days, currency, notes, created_at, updated_at, paid_date)
VALUES
  (9, 'INV-20251210-1', 1, NULL, '2025-12-10', '2025-12-24', 'paid', 568.00, 51.12, 619.12, 14, 'EUR', NULL, '2025-12-10 21:28:11.400915', '2025-12-15 09:45:06.898406', '2025-12-15'),
  (11, 'INV-20251230-1', 2, NULL, '2025-12-30', '2026-01-13', 'sent', 1950.00, 409.50, 2359.50, 14, 'EUR', NULL, '2025-12-30 11:22:06.232151', '2025-12-30 11:25:03.836733', NULL);

SELECT setval('invoices_id_seq', 11);

-- ============================================
-- INVOICE ITEMS
-- ============================================

INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, tax_rate_id, subtotal, tax_amount, line_total, created_at)
VALUES
  (25, 9, 'Schilderen - 2025-11-28', 5.00, 32.00, 2, 160.00, 14.40, 174.40, '2025-12-10 21:28:11.400915'),
  (26, 9, 'Schilderen - 2025-11-21', 6.50, 32.00, 2, 208.00, 18.72, 226.72, '2025-12-10 21:28:11.400915'),
  (27, 9, 'Schilderen - 2025-11-20', 6.25, 32.00, 2, 200.00, 18.00, 218.00, '2025-12-10 21:28:11.400915'),
  (30, 11, 'Development services (26-11-2025 - 30-12-2025) - 12 time entries', 26.00, 75.00, 1, 1950.00, 409.50, 2359.50, '2025-12-30 11:22:06.232151');

SELECT setval('invoice_items_id_seq', 30);

-- ============================================
-- INCOMING INVOICES (EXPENSES FROM SUPPLIERS)
-- ============================================

-- Convert old expenses to incoming_invoices
INSERT INTO incoming_invoices (
  id,
  supplier_id,
  invoice_date,
  review_status,
  reviewed_at,
  payment_status,
  paid_date,
  subtotal,
  tax_amount,
  total_amount,
  currency,
  category_id,
  description,
  supplier_name,
  source,
  created_at,
  updated_at
)
VALUES
  -- KVK invoice
  (1, 1000, '2025-11-14', 'approved', '2025-12-10 20:43:18.394821', 'paid', '2025-11-14', 82.25, 0.00, 82.25, 'EUR', NULL, 'KVK Handelsregister inschrijfvergoeding', 'KVK Kamer van Koophandel', 'manual', '2025-12-10 20:43:18.394821', '2025-12-10 20:43:18.394821'),

  -- Odido mobile phone
  (2, 1001, '2025-12-01', 'approved', NOW(), 'paid', '2025-12-05', 35.00, 7.35, 42.35, 'EUR', 1, 'Zakelijk mobiel abonnement december 2025', 'Odido (voorheen T-Mobile)', 'manual', NOW(), NOW()),

  -- Hostnet hosting
  (3, 1002, '2025-12-15', 'approved', NOW(), 'paid', '2025-12-16', 15.00, 3.15, 18.15, 'EUR', 1, 'Website hosting riemer.fyi - december 2025', 'Hostnet B.V.', 'manual', NOW(), NOW()),

  -- Microsoft 365
  (4, 1003, '2025-12-10', 'approved', NOW(), 'paid', '2025-12-10', 12.00, 2.52, 14.52, 'EUR', 3, 'Microsoft 365 Business Standard - december 2025', 'Microsoft Corporation', 'manual', NOW(), NOW()),

  -- Google Cloud (pending review)
  (5, 1004, '2025-12-20', 'pending', NULL, 'unpaid', NULL, 45.00, 9.45, 54.45, 'EUR', 1, 'Google Cloud Platform - compute & storage december', 'Google Cloud EMEA Limited', 'email', NOW(), NOW());

SELECT setval('incoming_invoices_id_seq', 5);

COMMIT;

-- ============================================
-- VERIFICATION
-- ============================================

SELECT '✅ COMPLETE MIGRATION DONE!' as status;

SELECT
  'Companies' as entity, COUNT(*) as count FROM companies
UNION ALL SELECT 'Projects', COUNT(*) FROM projects
UNION ALL SELECT 'Time Entries', COUNT(*) FROM time_entries
UNION ALL SELECT 'Invoices (Outgoing)', COUNT(*) FROM invoices
UNION ALL SELECT 'Invoice Items', COUNT(*) FROM invoice_items
UNION ALL SELECT 'Incoming Invoices (Expenses)', COUNT(*) FROM incoming_invoices;
