-- Fix admin match update policy to include WITH CHECK clause
-- This allows admins to update matches they didn't create

-- Drop old policies
DROP POLICY IF EXISTS "Match creators can update their matches" ON matches;
DROP POLICY IF EXISTS "Match creators and admins can update matches" ON matches;

-- Create new policy with both USING and WITH CHECK clauses
CREATE POLICY "Creators and admins can update matches" ON matches
  FOR UPDATE
  USING (
    auth.uid() = created_by OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    auth.uid() = created_by OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );
