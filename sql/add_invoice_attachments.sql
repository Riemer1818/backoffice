-- Create invoice_attachments table to support multiple files per invoice
CREATE TABLE IF NOT EXISTS invoice_attachments (
    id SERIAL PRIMARY KEY,
    
    -- Link to incoming invoice
    incoming_invoice_id INTEGER NOT NULL REFERENCES incoming_invoices(id) ON DELETE CASCADE,
    
    -- File data
    file_data BYTEA NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50), -- PDF, image, etc
    file_size INTEGER,
    
    -- Metadata
    attachment_type VARCHAR(50) DEFAULT 'invoice', -- 'invoice', 'receipt', 'other'
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_invoice_attachments_invoice_id ON invoice_attachments(incoming_invoice_id);

-- Drop the single file columns from incoming_invoices (we'll migrate data first)
-- We'll keep invoice_file and invoice_file_name for now for backward compatibility
-- TODO: Migrate existing data, then drop these columns

COMMENT ON TABLE invoice_attachments IS 'Multiple file attachments for incoming invoices (invoices, receipts, etc)';
