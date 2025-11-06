-- ================================================
-- Allow admins to delete any booking
-- ================================================

-- Drop the existing policy
DROP POLICY IF EXISTS "Match creators can delete any booking" ON bookings;

-- Recreate the policy to include admins
CREATE POLICY "Match creators and admins can delete any booking" ON bookings FOR DELETE
  USING (
    -- Match creator can delete
    EXISTS (SELECT 1 FROM matches WHERE matches.id = bookings.match_id AND matches.created_by = auth.uid())
    OR
    -- Admin can delete
    (SELECT is_admin FROM users WHERE id = auth.uid()) = true
  );

-- ================================================
-- DONE! Admins can now delete bookings
-- ================================================
