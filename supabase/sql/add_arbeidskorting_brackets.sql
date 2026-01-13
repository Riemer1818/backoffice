-- Add arbeidskorting bracket structure
-- Arbeidskorting has complex multi-bracket calculations that depend on income

CREATE TABLE IF NOT EXISTS arbeidskorting_brackets (
  id SERIAL PRIMARY KEY,
  tax_year_id INTEGER NOT NULL REFERENCES tax_years(id) ON DELETE CASCADE,
  bracket_order INTEGER NOT NULL,
  income_from NUMERIC(12,2) NOT NULL,
  income_to NUMERIC(12,2),
  -- Either flat rate (percentage of income) or formula-based
  rate NUMERIC(5,3), -- Can be percentage like 8.053% or 30.030%
  base_amount NUMERIC(10,2), -- Base amount to add (e.g., €980)
  rate_applies_to_excess BOOLEAN DEFAULT false, -- If true, rate applies to (income - income_from)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_arbeidskorting_brackets_year ON arbeidskorting_brackets(tax_year_id);

-- Insert 2025 arbeidskorting brackets
INSERT INTO arbeidskorting_brackets (tax_year_id, bracket_order, income_from, income_to, rate, base_amount, rate_applies_to_excess)
VALUES
  -- Bracket 1: tot € 12.169 → 8,053% x arbeidsinkomen
  ((SELECT id FROM tax_years WHERE year = 2025), 1, 0, 12169, 8.053, 0, false),

  -- Bracket 2: vanaf € 12.169 tot € 26.288 → € 980 + 30,030% x (arbeidsinkomen - € 12.169)
  ((SELECT id FROM tax_years WHERE year = 2025), 2, 12169, 26288, 30.030, 980, true),

  -- Bracket 3: vanaf € 26.288 tot € 43.071 → € 5.220 + 2,258% x (arbeidsinkomen - € 26.288)
  ((SELECT id FROM tax_years WHERE year = 2025), 3, 26288, 43071, 2.258, 5220, true),

  -- Bracket 4: vanaf € 43.071 tot € 129.078 → € 5.599 - 6,510% x (arbeidsinkomen - € 43.071) [phaseout]
  ((SELECT id FROM tax_years WHERE year = 2025), 4, 43071, 129078, -6.510, 5599, true),

  -- Bracket 5: vanaf € 129.078 → € 0
  ((SELECT id FROM tax_years WHERE year = 2025), 5, 129078, NULL, 0, 0, false);

-- Insert 2026 arbeidskorting brackets
INSERT INTO arbeidskorting_brackets (tax_year_id, bracket_order, income_from, income_to, rate, base_amount, rate_applies_to_excess)
VALUES
  -- Bracket 1: tot € 11.965 → 8,324% x arbeidsinkomen
  ((SELECT id FROM tax_years WHERE year = 2026), 1, 0, 11965, 8.324, 0, false),

  -- Bracket 2: vanaf € 11.965 tot € 25.845 → € 996 + 31,009% x (arbeidsinkomen - € 11.965)
  ((SELECT id FROM tax_years WHERE year = 2026), 2, 11965, 25845, 31.009, 996, true),

  -- Bracket 3: vanaf € 25.845 tot € 45.592 → € 5.300 + 1.950% x (arbeidsinkomen - € 25.845)
  ((SELECT id FROM tax_years WHERE year = 2026), 3, 25845, 45592, 1.950, 5300, true),

  -- Bracket 4: vanaf € 45.592 tot € 132.920 → € 5.685 - 6,510% x (arbeidsinkomen - € 45.592) [phaseout]
  ((SELECT id FROM tax_years WHERE year = 2026), 4, 45592, 132920, -6.510, 5685, true),

  -- Bracket 5: vanaf € 132.920 → € 0
  ((SELECT id FROM tax_years WHERE year = 2026), 5, 132920, NULL, 0, 0, false);
