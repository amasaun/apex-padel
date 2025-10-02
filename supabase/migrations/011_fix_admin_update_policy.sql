-- Fix the admin policy to allow admins to update any user
-- The issue is that the policy is checking both USING and WITH CHECK
-- We need to allow admins to update other users' is_admin status

DROP POLICY IF EXISTS "Only admins can promote users" ON users;

-- New policy: Users can update themselves, or admins can update anyone
CREATE POLICY "Users can update own profile or admins can update anyone" ON users FOR UPDATE
  USING (
    auth.uid() = id OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    auth.uid() = id OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );
