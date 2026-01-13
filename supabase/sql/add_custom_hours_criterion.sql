-- Add custom hours requirement field for benefits with different hour criteria
-- e.g., WBSO requires 500 hours, while zelfstandigenaftrek requires 1225 hours

ALTER TABLE tax_benefits
ADD COLUMN IF NOT EXISTS minimum_hours_required INTEGER;

COMMENT ON COLUMN tax_benefits.minimum_hours_required IS 'Minimum hours per year required to qualify for this benefit (e.g., 1225 for zelfstandigenaftrek, 500 for WBSO)';

-- Update existing benefits with their known hour requirements
UPDATE tax_benefits
SET minimum_hours_required = 1225
WHERE benefit_type IN ('zelfstandigenaftrek', 'startersaftrek')
  AND requires_hours_criterion = true;

-- Add a general notes/criteria field for other requirements
ALTER TABLE tax_benefits
ADD COLUMN IF NOT EXISTS eligibility_criteria TEXT;

COMMENT ON COLUMN tax_benefits.eligibility_criteria IS 'Free-text description of eligibility criteria and requirements for this benefit';

-- Update existing benefits with their criteria descriptions
UPDATE tax_benefits
SET eligibility_criteria = 'Must work at least 1,225 hours per year on your business'
WHERE benefit_type IN ('zelfstandigenaftrek', 'startersaftrek')
  AND requires_hours_criterion = true;
