-- Create junction table for many-to-many relationship between time entries and contacts
CREATE TABLE IF NOT EXISTS time_entry_contacts (
    id SERIAL PRIMARY KEY,
    time_entry_id INTEGER NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(time_entry_id, contact_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_time_entry_contacts_time_entry ON time_entry_contacts(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_time_entry_contacts_contact ON time_entry_contacts(contact_id);

-- Migrate existing contact_id data from time_entries to the junction table
INSERT INTO time_entry_contacts (time_entry_id, contact_id)
SELECT id, contact_id
FROM time_entries
WHERE contact_id IS NOT NULL
ON CONFLICT (time_entry_id, contact_id) DO NOTHING;
