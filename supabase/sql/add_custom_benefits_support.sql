-- Add support for custom tax benefits
-- This allows users to add and enable any tax benefit, not just the 3 hardcoded ones

-- Create a flexible table to track which benefits are enabled for the user
CREATE TABLE IF NOT EXISTS user_benefit_selections (
  id SERIAL PRIMARY KEY,
  benefit_id INTEGER NOT NULL REFERENCES tax_benefits(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(benefit_id)
);

CREATE INDEX idx_user_benefit_selections_benefit ON user_benefit_selections(benefit_id);
CREATE INDEX idx_user_benefit_selections_enabled ON user_benefit_selections(is_enabled);

-- Migrate existing data from user_tax_settings to the new table
INSERT INTO user_benefit_selections (benefit_id, is_enabled)
SELECT
  tb.id,
  CASE tb.benefit_type
    WHEN 'zelfstandigenaftrek' THEN COALESCE(uts.applies_zelfstandigenaftrek, false)
    WHEN 'startersaftrek' THEN COALESCE(uts.applies_startersaftrek, false)
    WHEN 'mkb_winstvrijstelling' THEN COALESCE(uts.applies_mkb_winstvrijstelling, false)
    ELSE false
  END
FROM tax_benefits tb
LEFT JOIN user_tax_settings uts ON uts.tax_year_id = tb.tax_year_id
WHERE tb.benefit_type IN ('zelfstandigenaftrek', 'startersaftrek', 'mkb_winstvrijstelling')
ON CONFLICT (benefit_id) DO NOTHING;
