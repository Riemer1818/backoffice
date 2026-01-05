-- Add tax_rate_id column to projects table
-- This allows each project to have its own BTW/VAT rate

ALTER TABLE projects
ADD COLUMN tax_rate_id INTEGER REFERENCES tax_rates(id) DEFAULT 1;

-- Update existing projects to use standard 21% VAT rate
UPDATE projects SET tax_rate_id = 1 WHERE tax_rate_id IS NULL;

COMMENT ON COLUMN projects.tax_rate_id IS 'BTW/VAT rate for this project (references tax_rates table)';
