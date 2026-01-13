-- Add tax credits (heffingskortingen) system
-- These reduce the actual tax payable, not the taxable income

-- Create table for tax credits configuration
CREATE TABLE IF NOT EXISTS tax_credits (
  id SERIAL PRIMARY KEY,
  tax_year_id INTEGER NOT NULL REFERENCES tax_years(id) ON DELETE CASCADE,
  credit_type VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  max_amount NUMERIC(10,2),
  -- Phaseout configuration (for income-dependent credits)
  phaseout_start NUMERIC(12,2), -- Income level where phaseout begins
  phaseout_end NUMERIC(12,2),   -- Income level where credit reaches 0
  phaseout_rate NUMERIC(5,2),   -- Percentage rate of phaseout
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tax_credits_year ON tax_credits(tax_year_id);
CREATE INDEX idx_tax_credits_type ON tax_credits(credit_type);

-- Insert 2025 tax credits
INSERT INTO tax_credits (tax_year_id, credit_type, name, description, max_amount, phaseout_start, phaseout_end, phaseout_rate)
VALUES
  (
    (SELECT id FROM tax_years WHERE year = 2025),
    'algemene_heffingskorting',
    'Algemene heffingskorting',
    'General tax credit that reduces based on income',
    3068.00,
    28406.00,
    76817.00,
    6.337
  ),
  (
    (SELECT id FROM tax_years WHERE year = 2025),
    'arbeidskorting',
    'Arbeidskorting',
    'Labor tax credit for earned income',
    5599.00,
    NULL, -- Will need more complex logic
    NULL,
    NULL
  );

-- Insert 2026 tax credits
INSERT INTO tax_credits (tax_year_id, credit_type, name, description, max_amount, phaseout_start, phaseout_end, phaseout_rate)
VALUES
  (
    (SELECT id FROM tax_years WHERE year = 2026),
    'algemene_heffingskorting',
    'Algemene heffingskorting',
    'General tax credit that reduces based on income',
    3115.00,
    29736.00,
    78426.00,
    6.398
  ),
  (
    (SELECT id FROM tax_years WHERE year = 2026),
    'arbeidskorting',
    'Arbeidskorting',
    'Labor tax credit for earned income',
    5685.00,
    NULL, -- Will need more complex logic
    NULL,
    NULL
  );

-- Create table to track which credits apply to the user
CREATE TABLE IF NOT EXISTS user_tax_credit_selections (
  id SERIAL PRIMARY KEY,
  credit_id INTEGER NOT NULL REFERENCES tax_credits(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(credit_id)
);

CREATE INDEX idx_user_tax_credit_selections_credit ON user_tax_credit_selections(credit_id);

-- Enable all credits by default
INSERT INTO user_tax_credit_selections (credit_id, is_enabled)
SELECT id, true FROM tax_credits
ON CONFLICT (credit_id) DO NOTHING;
