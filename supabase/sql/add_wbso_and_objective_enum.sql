-- Add WBSO tracking and objective dropdown to time_entries

-- Step 1: Create enum type for objectives
CREATE TYPE time_entry_objective AS ENUM (
  'development',
  'research',
  'meeting',
  'documentation',
  'support',
  'maintenance',
  'administration',
  'other'
);

-- Step 2: Add is_wbso column
ALTER TABLE time_entries
ADD COLUMN is_wbso BOOLEAN NOT NULL DEFAULT false;

-- Step 3: Convert objective column to enum type
-- First, add a temporary column with the enum type
ALTER TABLE time_entries
ADD COLUMN objective_new time_entry_objective;

-- Update the new column based on existing values (best effort mapping)
UPDATE time_entries
SET objective_new = CASE
  WHEN LOWER(objective) LIKE '%develop%' THEN 'development'::time_entry_objective
  WHEN LOWER(objective) LIKE '%research%' THEN 'research'::time_entry_objective
  WHEN LOWER(objective) LIKE '%meeting%' THEN 'meeting'::time_entry_objective
  WHEN LOWER(objective) LIKE '%doc%' THEN 'documentation'::time_entry_objective
  WHEN LOWER(objective) LIKE '%support%' THEN 'support'::time_entry_objective
  WHEN LOWER(objective) LIKE '%maintenance%' OR LOWER(objective) LIKE '%maintain%' THEN 'maintenance'::time_entry_objective
  WHEN LOWER(objective) LIKE '%admin%' THEN 'administration'::time_entry_objective
  ELSE 'other'::time_entry_objective
END
WHERE objective IS NOT NULL;

-- Drop the old column and rename the new one
ALTER TABLE time_entries
DROP COLUMN objective;

ALTER TABLE time_entries
RENAME COLUMN objective_new TO objective;

-- Step 4: Add index for WBSO filtering
CREATE INDEX idx_time_entries_wbso ON time_entries(is_wbso);

-- Step 5: Add comment
COMMENT ON COLUMN time_entries.is_wbso IS 'Whether this time entry counts towards WBSO (R&D tax credit) hours';
COMMENT ON COLUMN time_entries.objective IS 'Category/objective of the time entry';
