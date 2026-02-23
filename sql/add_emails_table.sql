-- ============================================
-- EMAILS TABLE
-- Store all emails fetched from IMAP independently
-- ============================================

CREATE TABLE IF NOT EXISTS emails (
    id SERIAL PRIMARY KEY,

    -- Email identifiers
    email_uid VARCHAR(255) NOT NULL UNIQUE, -- IMAP UID
    message_id VARCHAR(500), -- Email Message-ID header

    -- Email metadata
    subject VARCHAR(1000),
    from_address VARCHAR(500) NOT NULL,
    to_address VARCHAR(500),
    cc_address TEXT,
    bcc_address TEXT,

    -- Date
    email_date TIMESTAMPTZ NOT NULL,

    -- Content
    body_text TEXT,
    body_html TEXT,

    -- Status
    is_read BOOLEAN DEFAULT false,
    is_processed BOOLEAN DEFAULT false, -- Whether it's been processed (e.g., for invoice extraction)
    processing_status VARCHAR(50) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    processing_error TEXT,
    processed_at TIMESTAMPTZ,

    -- Relations
    linked_invoice_id INTEGER REFERENCES incoming_invoices(id) ON DELETE SET NULL,

    -- Metadata
    has_attachments BOOLEAN DEFAULT false,
    attachment_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- EMAIL ATTACHMENTS TABLE
-- Store email attachments separately
-- ============================================

CREATE TABLE IF NOT EXISTS email_attachments (
    id SERIAL PRIMARY KEY,
    email_id INTEGER NOT NULL REFERENCES emails(id) ON DELETE CASCADE,

    -- File info
    filename VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    file_data BYTEA NOT NULL,

    -- Metadata
    is_inline BOOLEAN DEFAULT false,
    content_id VARCHAR(255), -- For inline attachments

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_emails_uid ON emails(email_uid);
CREATE INDEX idx_emails_from ON emails(from_address);
CREATE INDEX idx_emails_date ON emails(email_date);
CREATE INDEX idx_emails_processed ON emails(is_processed);
CREATE INDEX idx_emails_processing_status ON emails(processing_status);
CREATE INDEX idx_emails_has_attachments ON emails(has_attachments);
CREATE INDEX idx_emails_linked_invoice ON emails(linked_invoice_id);

CREATE INDEX idx_email_attachments_email ON email_attachments(email_id);
CREATE INDEX idx_email_attachments_mime ON email_attachments(mime_type);

-- ============================================
-- UPDATE incoming_invoices TO LINK TO EMAILS
-- ============================================

-- Add email_id column to incoming_invoices if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'incoming_invoices'
        AND column_name = 'email_id'
    ) THEN
        ALTER TABLE incoming_invoices
        ADD COLUMN email_id INTEGER REFERENCES emails(id) ON DELETE SET NULL;

        CREATE INDEX idx_incoming_invoices_email ON incoming_invoices(email_id);
    END IF;
END $$;