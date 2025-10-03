-- Add share_contact_info column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS share_contact_info BOOLEAN DEFAULT FALSE;

-- Update existing users to have share_contact_info as false by default
UPDATE users
SET share_contact_info = FALSE
WHERE share_contact_info IS NULL;
