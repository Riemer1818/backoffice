-- ============================================
-- UPDATE TAX DATA WITH CORRECT 2025 & 2026 VALUES
-- Source: Official Dutch government tax information
-- ============================================

-- Update 2026 zelfstandigenaftrek (reduced from €2,470 to €1,200)
UPDATE tax_benefits
SET amount = 1200.00,
    description = 'Aftrek voor ondernemers die minimaal 1225 uur per jaar besteden aan hun onderneming (sterk verlaagd in 2026)',
    updated_at = CURRENT_TIMESTAMP
WHERE benefit_type = 'zelfstandigenaftrek'
AND tax_year_id = (SELECT id FROM tax_years WHERE year = 2026);

-- Update MKB-winstvrijstelling for both years (both are 12.70%)
UPDATE tax_benefits
SET percentage = 12.70,
    updated_at = CURRENT_TIMESTAMP
WHERE benefit_type = 'mkb_winstvrijstelling'
AND tax_year_id IN (SELECT id FROM tax_years WHERE year IN (2025, 2026));

-- Update 2026 income tax brackets (3 brackets instead of 2)
-- First, delete existing 2026 brackets
DELETE FROM income_tax_brackets
WHERE tax_year_id = (SELECT id FROM tax_years WHERE year = 2026);

-- Insert correct 2026 brackets
INSERT INTO income_tax_brackets (tax_year_id, bracket_order, income_from, income_to, rate)
VALUES
    ((SELECT id FROM tax_years WHERE year = 2026), 1, 0.00, 38883.00, 35.75),
    ((SELECT id FROM tax_years WHERE year = 2026), 2, 38883.01, 78426.00, 37.56),
    ((SELECT id FROM tax_years WHERE year = 2026), 3, 78426.01, NULL, 49.50);

-- Update 2025 income tax brackets (should also have 3 brackets)
-- First, delete existing 2025 brackets
DELETE FROM income_tax_brackets
WHERE tax_year_id = (SELECT id FROM tax_years WHERE year = 2025);

-- Insert correct 2025 brackets
INSERT INTO income_tax_brackets (tax_year_id, bracket_order, income_from, income_to, rate)
VALUES
    ((SELECT id FROM tax_years WHERE year = 2025), 1, 0.00, 38441.00, 35.82),
    ((SELECT id FROM tax_years WHERE year = 2025), 2, 38441.01, 76817.00, 37.48),
    ((SELECT id FROM tax_years WHERE year = 2025), 3, 76817.01, NULL, 49.50);

-- Add notes about the changes
COMMENT ON COLUMN tax_benefits.amount IS 'Fixed deduction amount (e.g., zelfstandigenaftrek: €2,470 in 2025, €1,200 in 2026)';
COMMENT ON COLUMN tax_benefits.percentage IS 'Percentage exemption (e.g., MKB-winstvrijstelling: 12.70% in 2025 & 2026)';