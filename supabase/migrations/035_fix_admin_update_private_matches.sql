-- Fix admin ability to mark matches as private
-- The WITH CHECK clause needs to properly allow admins to make any updates

-- Drop existing update policy
DROP POLICY IF EXISTS "match_update_policy" ON matches;
DROP POLICY IF EXISTS "Creators and admins can update matches" ON matches;
DROP POLICY IF EXISTS "Match creators and admins can update matches" ON matches;

-- Create new comprehensive UPDATE policy
-- This allows both creators and admins to update matches
-- The key is that the WITH CHECK should not be more restrictive than USING
CREATE POLICY "matches_update_policy" ON matches
  FOR UPDATE
  USING (
    -- User can update if they created it OR they are an admin
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  )
  WITH CHECK (
    -- Same check for the updated values
    -- This allows admins to update ANY field including is_private
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- Add helpful comment
COMMENT ON POLICY "matches_update_policy" ON matches IS 'Allows match creators and admins to update any match fields including privacy settings';
