-- Add optional phone number to candidates
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS phone text;
