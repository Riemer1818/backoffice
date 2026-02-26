-- Add label column to emails table for categorizing emails
-- This allows users to label emails as invoices, receipts, newsletters, or other

-- Step 1: Add label column (nullable to support existing records)
ALTER TABLE emails
ADD COLUMN label VARCHAR(50) CHECK (label IN ('incoming_invoice', 'receipt', 'newsletter', 'other'));

-- Step 2: Add index for faster filtering by label
CREATE INDEX idx_emails_label ON emails(label);

-- Step 3: Add comment to explain the column
COMMENT ON COLUMN emails.label IS 'User-assigned label to categorize the email: incoming_invoice, receipt, newsletter, or other';
