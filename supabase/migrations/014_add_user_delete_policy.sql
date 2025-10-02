-- Add DELETE policy for users table
-- Currently there is no delete policy, so nobody can delete users
-- Only admins should be able to delete users

DROP POLICY IF EXISTS "Only admins can delete users" ON users;

CREATE POLICY "Only admins can delete users" ON users
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND is_admin = true
  )
);
