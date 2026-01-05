-- Add columns to store PDFs as binary data in the database

-- For expenses table (receipts/factures)
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS receipt_file BYTEA,
ADD COLUMN IF NOT EXISTS receipt_filename VARCHAR(255),
ADD COLUMN IF NOT EXISTS receipt_mimetype VARCHAR(100),
ADD COLUMN IF NOT EXISTS receipt_size INTEGER;

-- For invoices table (generated PDFs)
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS pdf_file BYTEA,
ADD COLUMN IF NOT EXISTS pdf_filename VARCHAR(255),
ADD COLUMN IF NOT EXISTS pdf_size INTEGER;

-- Add indexes for better query performance when checking file existence
CREATE INDEX IF NOT EXISTS idx_expenses_has_receipt ON expenses((receipt_file IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_invoices_has_pdf ON invoices((pdf_file IS NOT NULL));

-- Comments for documentation
COMMENT ON COLUMN expenses.receipt_file IS 'Binary storage of receipt/facture PDF or image';
COMMENT ON COLUMN expenses.receipt_filename IS 'Original filename of uploaded receipt';
COMMENT ON COLUMN expenses.receipt_mimetype IS 'MIME type (application/pdf, image/jpeg, etc)';
COMMENT ON COLUMN expenses.receipt_size IS 'File size in bytes';

COMMENT ON COLUMN invoices.pdf_file IS 'Binary storage of generated invoice PDF';
COMMENT ON COLUMN invoices.pdf_filename IS 'Generated PDF filename';
COMMENT ON COLUMN invoices.pdf_size IS 'PDF file size in bytes';