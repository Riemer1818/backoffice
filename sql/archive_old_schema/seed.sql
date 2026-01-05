-- Seed data for Ian Joosten project

-- Insert client
INSERT INTO contacts (type, company_name, contact_person, street_address, postal_code, city, country, phone, email, vat_number, is_active)
VALUES ('client', 'Joosten Investments B.V.', 'Ian Joosten', 'Prinsengracht 343 D', '1016 HK', 'Amsterdam', 'Netherlands', '0641588640', 'ian.joosten@gmail.com', 'NL861929627B01', true);

-- Insert project (assuming the contact_id is 1, adjust if needed)
INSERT INTO projects (name, contact_id, description, hourly_rate, status, start_date)
VALUES ('Joosten Investments Work', 1, 'Development work for Ian Joosten', 32.00, 'completed', '2024-01-01');

-- Insert time entries (assuming project_id is 1)
-- Dag 1: 10:00 - 16:15 = 6.25 hours, €200 = €32/hour
INSERT INTO time_entries (project_id, contact_id, date, start_time, end_time, total_hours, chargeable_hours, notes, is_invoiced)
VALUES (1, 1, '2024-01-01', '2024-01-01 10:00:00+01', '2024-01-01 16:15:00+01', 6.25, 6.25, 'Dag 1 werk', false);

-- Dag 2: 17:30 - 22:30 = 5 hours, €160 = €32/hour
INSERT INTO time_entries (project_id, contact_id, date, start_time, end_time, total_hours, chargeable_hours, notes, is_invoiced)
VALUES (1, 1, '2024-01-02', '2024-01-02 17:30:00+01', '2024-01-02 22:30:00+01', 5.00, 5.00, 'Dag 2 werk', false);

-- Dag 3: 09:30 - 16:00 = 6.5 hours, €208 = €32/hour
INSERT INTO time_entries (project_id, contact_id, date, start_time, end_time, total_hours, chargeable_hours, notes, is_invoiced)
VALUES (1, 1, '2024-01-03', '2024-01-03 09:30:00+01', '2024-01-03 16:00:00+01', 6.50, 6.50, 'Dag 3 werk', false);

-- Totaal: 17.75 uur, €568 excl. btw, €619.12 incl. 9% btw
