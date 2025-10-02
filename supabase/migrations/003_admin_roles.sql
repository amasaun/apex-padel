-- Add is_admin column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create index for faster admin checks
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);

-- Function to make first user an admin automatically
CREATE OR REPLACE FUNCTION make_first_user_admin() RETURNS TRIGGER AS $$
DECLARE
  user_count INTEGER;
BEGIN
  -- Count existing users
  SELECT COUNT(*) INTO user_count FROM users;

  -- If this is the first user, make them admin
  IF user_count = 0 THEN
    NEW.is_admin = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run the function
DROP TRIGGER IF EXISTS set_first_user_as_admin ON users;
CREATE TRIGGER set_first_user_as_admin
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION make_first_user_admin();

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION is_current_user_admin() RETURNS BOOLEAN AS $$
DECLARE
  is_admin_user BOOLEAN;
BEGIN
  SELECT is_admin INTO is_admin_user
  FROM users
  WHERE id = auth.uid();

  RETURN COALESCE(is_admin_user, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies for admin-only operations

-- Only admins can update other users' admin status
CREATE POLICY "Only admins can promote users"
  ON users FOR UPDATE
  USING (
    -- Either updating yourself (non-admin fields) or you're an admin
    auth.uid() = id OR is_current_user_admin()
  )
  WITH CHECK (
    -- If changing is_admin, must be admin
    (NEW.is_admin = OLD.is_admin) OR is_current_user_admin()
  );

-- Drop old update policy if exists
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
