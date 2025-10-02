-- Fix the make_first_user_admin function
-- The issue is we need to check BEFORE the insert happens

DROP TRIGGER IF EXISTS set_first_user_as_admin ON users;
DROP FUNCTION IF EXISTS make_first_user_admin();

-- Recreate the function correctly
CREATE OR REPLACE FUNCTION make_first_user_admin() RETURNS TRIGGER AS $$
DECLARE
  user_count INTEGER;
BEGIN
  -- Count existing users (not including the current insert)
  SELECT COUNT(*) INTO user_count FROM users;

  -- If this is the first user, make them admin
  IF user_count = 0 THEN
    NEW.is_admin := true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER set_first_user_as_admin
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION make_first_user_admin();
