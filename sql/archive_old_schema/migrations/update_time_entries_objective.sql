-- Migrate time entries objective to dropdown with predefined values
-- Move existing objective text to notes and set objective to predefined value

-- First, migrate existing objectives to notes (if notes is empty)
UPDATE time_entries
SET notes = CASE
    WHEN notes IS NULL OR notes = '' THEN objective
    ELSE notes || ' | Previous objective: ' || objective
END
WHERE objective IS NOT NULL AND objective != '';

-- Now update objective column to be one of the predefined values
-- Try to match existing objectives to new categories
UPDATE time_entries
SET objective = CASE
    WHEN LOWER(objective) LIKE '%research%' OR LOWER(objective) LIKE '%r&d%' OR LOWER(objective) LIKE '%development%' THEN 'Research and Development'
    WHEN LOWER(objective) LIKE '%consult%' OR LOWER(objective) LIKE '%advies%' OR LOWER(objective) LIKE '%advice%' THEN 'Consulting'
    WHEN LOWER(objective) LIKE '%software%' OR LOWER(objective) LIKE '%engineer%' OR LOWER(objective) LIKE '%coding%' OR LOWER(objective) LIKE '%programming%' THEN 'Software Engineering'
    WHEN LOWER(objective) LIKE '%procurement%' OR LOWER(objective) LIKE '%inkoop%' OR LOWER(objective) LIKE '%purchase%' THEN 'Procurement'
    WHEN LOWER(objective) LIKE '%admin%' OR LOWER(objective) LIKE '%administratie%' OR LOWER(objective) LIKE '%paperwork%' THEN 'Administrative'
    ELSE 'Other'
END;

-- Set any NULL objectives to 'Other'
UPDATE time_entries
SET objective = 'Other'
WHERE objective IS NULL OR objective = '';

-- Add a check constraint to ensure only valid values
ALTER TABLE time_entries
DROP CONSTRAINT IF EXISTS time_entries_objective_check;

ALTER TABLE time_entries
ADD CONSTRAINT time_entries_objective_check
CHECK (objective IN ('Research and Development', 'Consulting', 'Software Engineering', 'Procurement', 'Administrative', 'Other'));

-- Make objective NOT NULL
ALTER TABLE time_entries
ALTER COLUMN objective SET NOT NULL;
