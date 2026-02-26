-- Add company and contact links to emails table
-- This allows tracking which company/person sent each email

-- Step 1: Add foreign key columns
ALTER TABLE emails
ADD COLUMN IF NOT EXISTS linked_company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS linked_contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL;

-- Step 2: Add indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_emails_linked_company ON emails(linked_company_id);
CREATE INDEX IF NOT EXISTS idx_emails_linked_contact ON emails(linked_contact_id);

-- Step 3: Add comments
COMMENT ON COLUMN emails.linked_company_id IS 'Company that sent this email (auto-matched or manually linked)';
COMMENT ON COLUMN emails.linked_contact_id IS 'Contact person that sent this email (auto-matched or manually linked)';
