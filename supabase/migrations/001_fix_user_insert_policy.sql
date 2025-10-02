-- Fix the user insert policy to allow signup
-- The issue is that during signup, auth.uid() is already set,
-- so we need to allow inserts where the id matches the authenticated user

DROP POLICY IF EXISTS "Users can insert their own profile" ON users;

CREATE POLICY "Users can insert their own profile"
  ON users FOR INSERT
  WITH CHECK (
    -- Allow if id matches current auth user
    auth.uid() = id
  );

-- Also ensure the admin promotion policy doesn't block first user
DROP POLICY IF EXISTS "Only admins can promote users" ON users;

CREATE POLICY "Admin and self updates allowed"
  ON users FOR UPDATE
  USING (
    -- Can update own profile OR user is admin
    auth.uid() = id OR
    (SELECT is_admin FROM users WHERE id = auth.uid()) = true
  )
  WITH CHECK (
    -- If changing is_admin field, must be admin (unless it's the first user auto-promotion)
    (NEW.is_admin = OLD.is_admin) OR
    (SELECT is_admin FROM users WHERE id = auth.uid()) = true OR
    OLD.is_admin IS NULL
  );
