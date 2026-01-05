-- Add currency fields to incoming_invoices table
ALTER TABLE incoming_invoices
ADD COLUMN IF NOT EXISTS original_currency VARCHAR(3) DEFAULT 'EUR',
ADD COLUMN IF NOT EXISTS original_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(10,6) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS exchange_rate_date DATE;

-- Add comment
COMMENT ON COLUMN incoming_invoices.original_currency IS 'Original currency code (USD, EUR, GBP, etc)';
COMMENT ON COLUMN incoming_invoices.original_amount IS 'Total amount in original currency';
COMMENT ON COLUMN incoming_invoices.exchange_rate IS 'Exchange rate used for EUR conversion';
COMMENT ON COLUMN incoming_invoices.exchange_rate_date IS 'Date of exchange rate (invoice date)';
