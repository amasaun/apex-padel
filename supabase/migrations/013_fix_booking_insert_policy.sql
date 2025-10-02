-- Fix booking insert policy to allow match creators to add players
-- Currently only allows users to book for themselves
-- Should also allow match creators to add any player to their match

DROP POLICY IF EXISTS "Authenticated users can create bookings" ON bookings;

CREATE POLICY "Users can book for themselves or match creators can add players" ON bookings
FOR INSERT
WITH CHECK (
  -- User can book for themselves
  auth.uid() = user_id
  OR
  -- Match creator can add any player to their match
  EXISTS (
    SELECT 1 FROM matches
    WHERE matches.id = match_id
    AND matches.created_by = auth.uid()
  )
  OR
  -- Admins can add anyone to any match
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.is_admin = true
  )
);
