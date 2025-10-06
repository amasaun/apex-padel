-- Allow admins to edit any match
-- Update the matches UPDATE policy to allow both creators and admins

DROP POLICY IF EXISTS "Match creators can update their matches" ON matches;

CREATE POLICY "Match creators and admins can update matches" ON matches FOR UPDATE
  USING (
    auth.uid() = created_by OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );
