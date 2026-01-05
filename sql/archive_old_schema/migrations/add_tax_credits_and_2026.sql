-- Add Tax Credits (Heffingskortingen) and 2026 data

-- Tax credits table
CREATE TABLE IF NOT EXISTS tax_credits (
    id SERIAL PRIMARY KEY,
    tax_year_id INTEGER REFERENCES tax_years(id) ON DELETE CASCADE,
    credit_type VARCHAR(100) NOT NULL, -- 'algemene_heffingskorting', 'arbeidskorting', 'inkomensafhankelijke_combinatiekorting'
    name VARCHAR(255) NOT NULL,
    max_amount DECIMAL(12,2) NOT NULL,
    income_threshold_start DECIMAL(12,2), -- Where reduction starts
    income_threshold_end DECIMAL(12,2), -- Where credit becomes 0
    reduction_rate DECIMAL(5,2), -- Percentage reduction per euro above threshold
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert 2026 tax year
INSERT INTO tax_years (year, is_active) VALUES (2026, true)
ON CONFLICT (year) DO NOTHING;

-- Update 2025 and 2026 tax data
DO $$
DECLARE
    year_2025_id INTEGER;
    year_2026_id INTEGER;
BEGIN
    SELECT id INTO year_2025_id FROM tax_years WHERE year = 2025;
    SELECT id INTO year_2026_id FROM tax_years WHERE year = 2026;

    -- Update 2025 brackets with correct 3-bracket system
    DELETE FROM income_tax_brackets WHERE tax_year_id = year_2025_id;
    INSERT INTO income_tax_brackets (tax_year_id, bracket_order, income_from, income_to, rate) VALUES
        (year_2025_id, 1, 0.00, 38441.00, 35.82),
        (year_2025_id, 2, 38441.01, 76817.00, 37.48),
        (year_2025_id, 3, 76817.01, NULL, 49.50);

    -- Insert 2026 brackets
    INSERT INTO income_tax_brackets (tax_year_id, bracket_order, income_from, income_to, rate) VALUES
        (year_2026_id, 1, 0.00, 38883.00, 35.70),
        (year_2026_id, 2, 38883.01, 77320.00, 37.56),
        (year_2026_id, 3, 77320.01, NULL, 49.50)
    ON CONFLICT (tax_year_id, bracket_order) DO UPDATE
        SET income_from = EXCLUDED.income_from,
            income_to = EXCLUDED.income_to,
            rate = EXCLUDED.rate;

    -- Update 2025 deductions
    DELETE FROM tax_deductions WHERE tax_year_id = year_2025_id;
    INSERT INTO tax_deductions (tax_year_id, deduction_type, name, amount, percentage, description, requires_hours_criterion) VALUES
        (year_2025_id, 'zelfstandigenaftrek', 'Zelfstandigenaftrek', 2470.00, NULL, 'Zelfstandigenaftrek voor ondernemers (minimaal 1.225 uur)', true),
        (year_2025_id, 'startersaftrek', 'Startersaftrek', 2123.00, NULL, 'Extra aftrek voor starters (max 3x in eerste 5 jaar, bovenop zelfstandigenaftrek)', false),
        (year_2025_id, 'mkb_winstvrijstelling', 'MKB-winstvrijstelling', NULL, 12.70, 'Percentage van winst na ondernemersaftrek vrijgesteld (géén urencriterium)', false);

    -- Insert 2026 deductions
    INSERT INTO tax_deductions (tax_year_id, deduction_type, name, amount, percentage, description, requires_hours_criterion) VALUES
        (year_2026_id, 'zelfstandigenaftrek', 'Zelfstandigenaftrek', 1200.00, NULL, 'Zelfstandigenaftrek voor ondernemers (minimaal 1.225 uur) - LET OP: Fors verlaagd!', true),
        (year_2026_id, 'startersaftrek', 'Startersaftrek', 2123.00, NULL, 'Extra aftrek voor starters (max 3x in eerste 5 jaar, bovenop zelfstandigenaftrek)', false),
        (year_2026_id, 'mkb_winstvrijstelling', 'MKB-winstvrijstelling', NULL, 12.70, 'Percentage van winst na ondernemersaftrek vrijgesteld (géén urencriterium)', false)
    ON CONFLICT DO NOTHING;

    -- Insert 2025 tax credits
    INSERT INTO tax_credits (tax_year_id, credit_type, name, max_amount, income_threshold_start, description) VALUES
        (year_2025_id, 'algemene_heffingskorting', 'Algemene heffingskorting', 3068.00, 24813.00, 'Wordt automatisch toegepast, bouwt af bij hogere inkomens'),
        (year_2025_id, 'arbeidskorting', 'Arbeidskorting', 5599.00, 43000.00, 'Voor ondernemers, bouwt af vanaf ~€43.000'),
        (year_2025_id, 'inkomensafhankelijke_combinatiekorting', 'Inkomensafhankelijke combinatiekorting', 2986.00, NULL, 'Voor ouders met jonge kinderen die werken')
    ON CONFLICT DO NOTHING;

    -- Insert 2026 tax credits
    INSERT INTO tax_credits (tax_year_id, credit_type, name, max_amount, income_threshold_start, description) VALUES
        (year_2026_id, 'algemene_heffingskorting', 'Algemene heffingskorting', 3115.00, 25129.00, 'Wordt automatisch toegepast, bouwt af bij hogere inkomens'),
        (year_2026_id, 'arbeidskorting', 'Arbeidskorting', 5712.00, 45500.00, 'Voor ondernemers, bouwt af vanaf ~€45.500'),
        (year_2026_id, 'inkomensafhankelijke_combinatiekorting', 'Inkomensafhankelijke combinatiekorting', 3032.00, NULL, 'Voor ouders met jonge kinderen die werken')
    ON CONFLICT DO NOTHING;

    -- Update user settings for 2025 (waarschijnlijk geen zelfstandigenaftrek vanwege uren)
    INSERT INTO user_tax_settings (tax_year_id, applies_zelfstandigenaftrek, applies_startersaftrek, applies_mkb_winstvrijstelling, notes)
    VALUES (year_2025_id, false, false, true, 'Gestart nov 2025 - urencriterium waarschijnlijk niet gehaald')
    ON CONFLICT (tax_year_id) DO UPDATE
        SET applies_zelfstandigenaftrek = false,
            applies_startersaftrek = false,
            notes = 'Gestart nov 2025 - urencriterium waarschijnlijk niet gehaald';

    -- Insert default user settings for 2026
    INSERT INTO user_tax_settings (tax_year_id, applies_zelfstandigenaftrek, applies_startersaftrek, applies_mkb_winstvrijstelling, notes)
    VALUES (year_2026_id, true, true, true, 'Bij 30 uur/week (~1.560 uur/jaar) - voldoet aan urencriterium. Eerste jaar met startersaftrek.')
    ON CONFLICT (tax_year_id) DO NOTHING;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tax_credits_year ON tax_credits(tax_year_id);
CREATE INDEX IF NOT EXISTS idx_tax_credits_type ON tax_credits(credit_type);
