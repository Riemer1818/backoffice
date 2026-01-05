-- Add review workflow fields to expenses table
-- This allows expenses to be marked as needing review after AI extraction

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) DEFAULT 'approved'
  CHECK (review_status IN ('pending_review', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS extracted_data JSONB,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(100);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_expenses_review_status ON expenses(review_status);

-- Add comments
COMMENT ON COLUMN expenses.review_status IS 'Review status: pending_review (needs human review), approved (verified), rejected (invalid)';
COMMENT ON COLUMN expenses.extracted_data IS 'Original AI-extracted data for comparison/audit';
COMMENT ON COLUMN expenses.reviewed_at IS 'When the expense was reviewed';
COMMENT ON COLUMN expenses.reviewed_by IS 'Who reviewed the expense';
