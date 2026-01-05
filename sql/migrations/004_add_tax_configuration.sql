-- ============================================
-- TAX CONFIGURATION TABLES
-- For managing Dutch tax benefits and settings per year
-- ============================================

-- Tax years configuration
CREATE TABLE IF NOT EXISTS tax_years (
    id SERIAL PRIMARY KEY,
    year INTEGER UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Income tax brackets (Inkomstenbelasting schijven)
CREATE TABLE IF NOT EXISTS income_tax_brackets (
    id SERIAL PRIMARY KEY,
    tax_year_id INTEGER REFERENCES tax_years(id) ON DELETE CASCADE,
    bracket_order INTEGER NOT NULL, -- 1, 2, 3, etc.
    income_from DECIMAL(12,2) NOT NULL,
    income_to DECIMAL(12,2), -- NULL for last bracket (unlimited)
    rate DECIMAL(5,2) NOT NULL, -- percentage (e.g., 35.82)
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tax_year_id, bracket_order)
);

-- Tax deductions/benefits (Aftrekposten & Faciliteiten)
CREATE TABLE IF NOT EXISTS tax_benefits (
    id SERIAL PRIMARY KEY,
    tax_year_id INTEGER REFERENCES tax_years(id) ON DELETE CASCADE,
    benefit_type VARCHAR(100) NOT NULL, -- 'zelfstandigenaftrek', 'startersaftrek', 'mkb_winstvrijstelling'
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(12,2), -- Fixed amount for zelfstandigenaftrek/startersaftrek
    percentage DECIMAL(5,2), -- Percentage for mkb_winstvrijstelling
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    requires_hours_criterion BOOLEAN DEFAULT false, -- For zelfstandigenaftrek (1225 hours)
    max_usage_count INTEGER, -- For startersaftrek: max 3x in eerste 5 jaar
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- User's tax settings per year (which benefits apply)
CREATE TABLE IF NOT EXISTS user_tax_settings (
    id SERIAL PRIMARY KEY,
    tax_year_id INTEGER REFERENCES tax_years(id) ON DELETE CASCADE,
    applies_zelfstandigenaftrek BOOLEAN DEFAULT false,
    applies_startersaftrek BOOLEAN DEFAULT false,
    applies_mkb_winstvrijstelling BOOLEAN DEFAULT false,
    meets_hours_criterion BOOLEAN DEFAULT true, -- User confirms they meet 1225 hours
    starter_years_used INTEGER DEFAULT 0, -- Track how many years startersaftrek has been used
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tax_year_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_income_tax_brackets_year ON income_tax_brackets(tax_year_id);
CREATE INDEX IF NOT EXISTS idx_tax_benefits_year ON tax_benefits(tax_year_id);
CREATE INDEX IF NOT EXISTS idx_tax_benefits_type ON tax_benefits(benefit_type);
CREATE INDEX IF NOT EXISTS idx_user_tax_settings_year ON user_tax_settings(tax_year_id);

-- Insert 2025 tax year
INSERT INTO tax_years (year, is_active) VALUES (2025, true)
ON CONFLICT (year) DO NOTHING;

-- Insert 2026 tax year
INSERT INTO tax_years (year, is_active) VALUES (2026, true)
ON CONFLICT (year) DO NOTHING;

-- Insert 2025 configuration
DO $$
DECLARE
    year_2025_id INTEGER;
BEGIN
    SELECT id INTO year_2025_id FROM tax_years WHERE year = 2025;

    -- 2025 income tax brackets
    INSERT INTO income_tax_brackets (tax_year_id, bracket_order, income_from, income_to, rate) VALUES
        (year_2025_id, 1, 0.00, 38441.00, 35.82),
        (year_2025_id, 2, 38441.01, NULL, 49.50)
    ON CONFLICT (tax_year_id, bracket_order) DO NOTHING;

    -- 2025 tax benefits
    INSERT INTO tax_benefits (tax_year_id, benefit_type, name, amount, percentage, description, requires_hours_criterion, max_usage_count) VALUES
        (year_2025_id, 'zelfstandigenaftrek', 'Zelfstandigenaftrek', 2470.00, NULL, 'Aftrek voor ondernemers die minimaal 1225 uur per jaar besteden aan hun onderneming', true, NULL),
        (year_2025_id, 'startersaftrek', 'Startersaftrek', 2123.00, NULL, 'Extra aftrek voor starters in de eerste 5 jaar (maximaal 3 keer te gebruiken)', true, 3),
        (year_2025_id, 'mkb_winstvrijstelling', 'MKB-winstvrijstelling', NULL, 12.70, 'Percentage van de winst (na aftrekposten) dat vrijgesteld is van belasting', false, NULL)
    ON CONFLICT DO NOTHING;

    -- Default user settings for 2025 (nothing selected by default)
    INSERT INTO user_tax_settings (tax_year_id, applies_zelfstandigenaftrek, applies_startersaftrek, applies_mkb_winstvrijstelling, meets_hours_criterion)
    VALUES (year_2025_id, false, false, false, true)
    ON CONFLICT (tax_year_id) DO NOTHING;
END $$;

-- Insert 2026 configuration
DO $$
DECLARE
    year_2026_id INTEGER;
BEGIN
    SELECT id INTO year_2026_id FROM tax_years WHERE year = 2026;

    -- 2026 income tax brackets (same as 2025 - update when official rates are published)
    INSERT INTO income_tax_brackets (tax_year_id, bracket_order, income_from, income_to, rate) VALUES
        (year_2026_id, 1, 0.00, 38441.00, 35.82),
        (year_2026_id, 2, 38441.01, NULL, 49.50)
    ON CONFLICT (tax_year_id, bracket_order) DO NOTHING;

    -- 2026 tax benefits
    INSERT INTO tax_benefits (tax_year_id, benefit_type, name, amount, percentage, description, requires_hours_criterion, max_usage_count) VALUES
        (year_2026_id, 'zelfstandigenaftrek', 'Zelfstandigenaftrek', 2470.00, NULL, 'Aftrek voor ondernemers die minimaal 1225 uur per jaar besteden aan hun onderneming (afbouw is gestopt)', true, NULL),
        (year_2026_id, 'startersaftrek', 'Startersaftrek', 2123.00, NULL, 'Extra aftrek voor starters in de eerste 5 jaar (maximaal 3 keer te gebruiken)', true, 3),
        (year_2026_id, 'mkb_winstvrijstelling', 'MKB-winstvrijstelling', NULL, 12.03, 'Percentage van de winst (na aftrekposten) dat vrijgesteld is van belasting', false, NULL)
    ON CONFLICT DO NOTHING;

    -- Default user settings for 2026 (nothing selected by default)
    INSERT INTO user_tax_settings (tax_year_id, applies_zelfstandigenaftrek, applies_startersaftrek, applies_mkb_winstvrijstelling, meets_hours_criterion)
    VALUES (year_2026_id, false, false, false, true)
    ON CONFLICT (tax_year_id) DO NOTHING;
END $$;