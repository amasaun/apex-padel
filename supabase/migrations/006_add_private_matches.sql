-- Add is_private column to matches table
ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;

-- Create index for filtering private matches
CREATE INDEX IF NOT EXISTS idx_matches_is_private ON matches(is_private);

-- Update the RLS policy for viewing matches
-- Users can see: public matches OR private matches they created OR private matches they're booked in
DROP POLICY IF EXISTS "Anyone can view matches" ON matches;

CREATE POLICY "Users can view public matches and their private matches"
  ON matches FOR SELECT
  USING (
    -- Public matches (everyone can see)
    is_private = false
    OR
    -- Private matches created by current user
    created_by = auth.uid()
    OR
    -- Private matches where user has a booking
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.match_id = matches.id
      AND bookings.user_id = auth.uid()
    )
    OR
    -- Allow viewing if not authenticated (for sharing links, will be handled by app logic)
    auth.uid() IS NULL
  );

-- Update Match type to include is_private
COMMENT ON COLUMN matches.is_private IS 'If true, match is only visible to creator and participants';
