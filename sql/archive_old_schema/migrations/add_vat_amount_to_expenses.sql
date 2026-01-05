-- Add vat_amount column to expenses to track input VAT/BTW
-- This allows proper tracking of deductible VAT for quarterly returns

-- Add vat_amount column (amount of VAT/BTW paid on this expense)
ALTER TABLE expenses
ADD COLUMN vat_amount DECIMAL(10,2) DEFAULT 0.00;

-- Update existing records to calculate vat_amount from amount and tax_rate
UPDATE expenses e
SET vat_amount = e.amount * (tr.rate / 100)
FROM tax_rates tr
WHERE e.tax_rate_id = tr.id;

-- Add index for VAT reporting queries
CREATE INDEX idx_expenses_vat_amount ON expenses(vat_amount);

-- Add comment to document the field
COMMENT ON COLUMN expenses.vat_amount IS 'VAT/BTW amount paid on this expense (input VAT for quarterly returns)';
