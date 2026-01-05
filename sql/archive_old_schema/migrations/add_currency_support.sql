-- Add currency support to invoices, expenses, and projects
-- Migration: add_currency_support

-- Add currency column to expenses table (default EUR for existing records)
ALTER TABLE expenses
ADD COLUMN currency VARCHAR(3) DEFAULT 'EUR' NOT NULL;

-- Add currency column to invoices table
ALTER TABLE invoices
ADD COLUMN currency VARCHAR(3) DEFAULT 'EUR' NOT NULL;

-- Add currency column to projects table (for project-level rates)
ALTER TABLE projects
ADD COLUMN currency VARCHAR(3) DEFAULT 'EUR' NOT NULL;

-- Add index for currency lookups
CREATE INDEX idx_expenses_currency ON expenses(currency);
CREATE INDEX idx_invoices_currency ON invoices(currency);

-- Add comment to document supported currencies
COMMENT ON COLUMN expenses.currency IS 'Currency code (ISO 4217): EUR, USD, GBP, etc.';
COMMENT ON COLUMN invoices.currency IS 'Currency code (ISO 4217): EUR, USD, GBP, etc.';
COMMENT ON COLUMN projects.currency IS 'Currency code (ISO 4217) for project rates';
