-- Add color column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#1e3a8a';

-- Update existing projects with different default colors
-- This gives variety to existing projects
UPDATE projects SET color =
  CASE
    WHEN id % 8 = 0 THEN '#1e3a8a'  -- Blue
    WHEN id % 8 = 1 THEN '#15803d'  -- Green
    WHEN id % 8 = 2 THEN '#b91c1c'  -- Red
    WHEN id % 8 = 3 THEN '#7c2d12'  -- Orange
    WHEN id % 8 = 4 THEN '#4c1d95'  -- Purple
    WHEN id % 8 = 5 THEN '#0e7490'  -- Cyan
    WHEN id % 8 = 6 THEN '#a21caf'  -- Pink
    ELSE '#ca8a04'                  -- Yellow
  END
WHERE color IS NULL;
