-- Add required_level column to matches table
-- Stores the minimum ranking required to join the match
-- NULL means all levels are welcome
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS required_level DECIMAL(3,2);

-- Add comment to explain the field
COMMENT ON COLUMN matches.required_level IS 'Minimum ranking required to join this match. NULL means all levels welcome.';
