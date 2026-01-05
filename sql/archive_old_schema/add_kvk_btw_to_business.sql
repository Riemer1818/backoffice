-- Add KVK and BTW number fields to business_info table
ALTER TABLE business_info
ADD COLUMN IF NOT EXISTS kvk_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS btw_number VARCHAR(50);

-- Example update (replace with your actual values)
-- UPDATE business_info SET
--   kvk_number = '12345678',
--   btw_number = 'NL123456789B01'
-- WHERE id = 1;
