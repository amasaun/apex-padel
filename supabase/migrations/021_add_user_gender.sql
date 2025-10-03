-- Add gender column to users table
-- Options: female, male, rather_not_say
ALTER TABLE users
ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('female', 'male', 'rather_not_say'));

-- Add comment to explain the field
COMMENT ON COLUMN users.gender IS 'User gender: female, male, or rather_not_say';
