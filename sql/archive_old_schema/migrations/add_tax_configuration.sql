-- Tax Configuration Tables for Inkomstenbelasting

-- Tax years configuration
CREATE TABLE IF NOT EXISTS tax_years (
    id SERIAL PRIMARY KEY,
    year INTEGER UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Income tax brackets (Inkomstenbelasting schijven)
CREATE TABLE IF NOT EXISTS income_tax_brackets (
    id SERIAL PRIMARY KEY,
    tax_year_id INTEGER REFERENCES tax_years(id) ON DELETE CASCADE,
    bracket_order INTEGER NOT NULL, -- 1, 2, 3, etc.
    income_from DECIMAL(12,2) NOT NULL,
    income_to DECIMAL(12,2), -- NULL for last bracket (unlimited)
    rate DECIMAL(5,2) NOT NULL, -- percentage (e.g., 35.82)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tax_year_id, bracket_order)
);

-- Tax deductions (Aftrekposten)
CREATE TABLE IF NOT EXISTS tax_deductions (
    id SERIAL PRIMARY KEY,
    tax_year_id INTEGER REFERENCES tax_years(id) ON DELETE CASCADE,
    deduction_type VARCHAR(100) NOT NULL, -- 'zelfstandigenaftrek', 'startersaftrek', 'mkb_winstvrijstelling'
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(12,2), -- Fixed amount for zelfstandigenaftrek/startersaftrek
    percentage DECIMAL(5,2), -- Percentage for mkb_winstvrijstelling
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    requires_hours_criterion BOOLEAN DEFAULT false, -- For zelfstandigenaftrek (1225 hours)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User's tax settings per year (which deductions apply)
CREATE TABLE IF NOT EXISTS user_tax_settings (
    id SERIAL PRIMARY KEY,
    tax_year_id INTEGER REFERENCES tax_years(id) ON DELETE CASCADE,
    applies_zelfstandigenaftrek BOOLEAN DEFAULT true,
    applies_startersaftrek BOOLEAN DEFAULT false,
    applies_mkb_winstvrijstelling BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tax_year_id)
);

-- Insert 2025 tax year configuration
INSERT INTO tax_years (year, is_active) VALUES (2025, true)
ON CONFLICT (year) DO NOTHING;

-- Get the tax year ID for 2025
DO $$
DECLARE
    year_2025_id INTEGER;
BEGIN
    SELECT id INTO year_2025_id FROM tax_years WHERE year = 2025;

    -- Insert 2025 income tax brackets
    INSERT INTO income_tax_brackets (tax_year_id, bracket_order, income_from, income_to, rate) VALUES
        (year_2025_id, 1, 0.00, 38441.00, 35.82),
        (year_2025_id, 2, 38441.01, NULL, 49.50)
    ON CONFLICT (tax_year_id, bracket_order) DO NOTHING;

    -- Insert 2025 tax deductions
    INSERT INTO tax_deductions (tax_year_id, deduction_type, name, amount, percentage, description, requires_hours_criterion) VALUES
        (year_2025_id, 'zelfstandigenaftrek', 'Zelfstandigenaftrek', 2470.00, NULL, 'Zelfstandigenaftrek voor ondernemers (minimaal 1225 uur)', true),
        (year_2025_id, 'startersaftrek', 'Startersaftrek', 2123.00, NULL, 'Extra aftrek voor starters (max 2x in 5 jaar)', false),
        (year_2025_id, 'mkb_winstvrijstelling', 'MKB-winstvrijstelling', NULL, 13.31, 'Percentage van winst na aftrekposten vrijgesteld', false)
    ON CONFLICT DO NOTHING;

    -- Insert default user settings for 2025
    INSERT INTO user_tax_settings (tax_year_id, applies_zelfstandigenaftrek, applies_startersaftrek, applies_mkb_winstvrijstelling)
    VALUES (year_2025_id, true, false, true)
    ON CONFLICT (tax_year_id) DO NOTHING;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_income_tax_brackets_year ON income_tax_brackets(tax_year_id);
CREATE INDEX IF NOT EXISTS idx_tax_deductions_year ON tax_deductions(tax_year_id);
CREATE INDEX IF NOT EXISTS idx_user_tax_settings_year ON user_tax_settings(tax_year_id);
