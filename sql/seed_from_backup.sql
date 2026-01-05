-- ============================================
-- SEED DATA FROM BACKUP
-- Migrates data from old schema to new schema
-- ============================================

BEGIN;

-- ============================================
-- COMPANIES (from old contacts table)
-- ============================================

-- Insert companies from backup
INSERT INTO companies (id, type, name, main_contact_person, email, phone, street_address, postal_code, city, country, btw_number, kvk_number, iban, notes, is_active, created_at, updated_at)
VALUES
  (1, 'client', 'Joosten Investments B.V.', 'Ian Joosten', 'ian.joosten@gmail.com', '+31641588640', 'Prinsengracht 343 D', '1016 HK', 'Amsterdam', 'Netherlands', 'NL861929627B01', NULL, NULL, NULL, true, '2025-12-09 13:08:48.208891', '2025-12-11 14:00:41.789888'),
  (2, 'client', 'Moods AI B.V. i.o.', 'Jaime Essed', NULL, NULL, 'Sarphatistraat 141C', '1018GD', 'Amsterdam', 'Netherlands', NULL, NULL, NULL, 'Note vanuit Jaime: belangrijk dat er "i.o." op de factuur staat zoals hierboven. De notaris verwerkt de oprichting pas in januari voor de nieuwe B.V.', true, '2025-12-10 21:33:50.619485', '2025-12-18 17:03:39.280459');

-- Reset sequence
SELECT setval('companies_id_seq', (SELECT MAX(id) FROM companies));

-- ============================================
-- PROJECTS
-- ============================================

INSERT INTO projects (id, name, client_id, description, hourly_rate, status, start_date, end_date, tax_rate_id, currency, created_at, updated_at)
VALUES
  (1, 'Joosten Investments Schilderen', 1, 'schilderwerk work for Ian Joosten', 32.00, 'active', '2023-12-27', NULL, 2, 'EUR', '2025-12-09 13:08:48.211298', '2025-12-10 11:04:07.730097'),
  (3, 'moodsAI-MVP', 2, NULL, 75.00, 'active', '2025-11-25', NULL, 1, 'EUR', '2025-12-10 21:33:56.129126', '2025-12-10 21:35:16.568925');

-- Projects without clients (internal projects)
INSERT INTO projects (id, name, client_id, description, hourly_rate, status, start_date, tax_rate_id, currency, created_at)
VALUES
  -- Create dummy "Internal" company for projects without clients
  (4, 'participatie-ai', 1, NULL, 0.00, 'active', '2025-11-04', 3, 'EUR', '2025-12-15 13:23:49.53992'),
  (5, 'winwin', 1, NULL, 0.00, 'active', '2025-11-04', 3, 'EUR', '2025-12-15 13:25:45.073391'),
  (6, 'riemer FYI', 1, NULL, 0.00, 'active', '2025-11-05', 3, 'EUR', '2025-12-24 14:55:38.879496');

-- Actually, let me create an Internal company first
INSERT INTO companies (id, type, name, is_active, created_at, updated_at)
VALUES (999, 'client', 'Internal / Personal Projects', true, NOW(), NOW());

-- Update projects to use Internal company
UPDATE projects SET client_id = 999 WHERE id IN (4, 5, 6);

-- Reset sequence
SELECT setval('projects_id_seq', (SELECT MAX(id) FROM projects));

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

-- Reset sequence
SELECT setval('time_entries_id_seq', (SELECT MAX(id) FROM time_entries));

COMMIT;

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'MIGRATION COMPLETE!' as status;

SELECT 'Companies' as entity, COUNT(*) as count FROM companies
UNION ALL
SELECT 'Projects', COUNT(*) FROM projects
UNION ALL
SELECT 'Time Entries', COUNT(*) FROM time_entries;
