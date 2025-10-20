-- Add match_gender column to bookings table
-- This allows creators/admins to assign a temporary gender for tournament matches
-- to users who have "rather not say" as their profile gender

-- Add the column
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS match_gender TEXT;

-- Add constraint to ensure valid values
ALTER TABLE bookings
ADD CONSTRAINT bookings_match_gender_check
CHECK (match_gender IN ('male', 'female') OR match_gender IS NULL);

-- Add comment explaining the purpose
COMMENT ON COLUMN bookings.match_gender IS
'Temporary gender assignment for this specific match. Used for tournament gender requirements when user profile gender is "rather not say". Does not change user profile gender.';

-- Create index for querying by match_gender
CREATE INDEX IF NOT EXISTS idx_bookings_match_gender ON bookings(match_gender);
