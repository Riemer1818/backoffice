-- Add project_id to expenses table
-- Expenses can belong to projects (e.g., software subscription for specific project)

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;

-- Create index for project expenses queries
CREATE INDEX IF NOT EXISTS idx_expenses_project ON expenses(project_id);

-- Add comment
COMMENT ON COLUMN expenses.project_id IS 'Optional: link expense to a specific project';
