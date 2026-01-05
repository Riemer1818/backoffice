-- Add hierarchical support to contacts table
-- Allows people to belong to organizations

-- Add parent_id column for hierarchy (person -> organization)
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL;

-- Add entity_type to distinguish organizations from people
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS entity_type VARCHAR(20) DEFAULT 'organization' CHECK (entity_type IN ('organization', 'person'));

-- Add first_name and last_name for better person support
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS role VARCHAR(100);

-- Create index for hierarchy queries
CREATE INDEX IF NOT EXISTS idx_contacts_parent_id ON contacts(parent_id);
CREATE INDEX IF NOT EXISTS idx_contacts_entity_type ON contacts(entity_type);

-- Update existing data: mark all existing contacts as organizations
UPDATE contacts
SET entity_type = 'organization'
WHERE entity_type IS NULL;

-- Add comments
COMMENT ON COLUMN contacts.parent_id IS 'For people: references the organization they belong to';
COMMENT ON COLUMN contacts.entity_type IS 'Whether this is an organization or a person';
COMMENT ON COLUMN contacts.first_name IS 'For people: first name';
COMMENT ON COLUMN contacts.last_name IS 'For people: last name';
COMMENT ON COLUMN contacts.role IS 'For people: role within organization';
