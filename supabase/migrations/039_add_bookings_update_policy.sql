-- Add UPDATE policy for bookings table
-- This allows match creators and admins to update booking fields like match_gender

DROP POLICY IF EXISTS "Match creators and admins can update bookings" ON bookings;

CREATE POLICY "Match creators and admins can update bookings" ON bookings
  FOR UPDATE
  TO authenticated
  USING (
    -- Can update if you're the match creator OR an admin
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = bookings.match_id
      AND (
        matches.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.is_admin = true
        )
      )
    )
  )
  WITH CHECK (
    -- Same check for the updated values
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = bookings.match_id
      AND (
        matches.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.is_admin = true
        )
      )
    )
  );

COMMENT ON POLICY "Match creators and admins can update bookings" ON bookings IS
'Allows match creators and admins to update booking fields such as match_gender for tournament gender requirements';
