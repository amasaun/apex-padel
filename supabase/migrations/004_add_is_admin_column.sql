-- Add is_admin column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create index for faster admin checks
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);

-- Update the signup function to handle is_admin
CREATE OR REPLACE FUNCTION public.handle_new_user_signup(
  user_id UUID,
  user_email TEXT,
  user_name TEXT,
  user_phone TEXT DEFAULT NULL,
  user_ranking TEXT DEFAULT '3.0'
) RETURNS JSON AS $$
DECLARE
  new_user users%ROWTYPE;
  user_count INTEGER;
  is_first_user BOOLEAN;
BEGIN
  -- Check if this is the first user
  SELECT COUNT(*) INTO user_count FROM users;
  is_first_user := (user_count = 0);

  -- Insert the new user with is_admin
  INSERT INTO users (id, email, name, phone, ranking, is_admin)
  VALUES (user_id, user_email, user_name, user_phone, user_ranking, is_first_user)
  RETURNING * INTO new_user;

  -- Return the user as JSON
  RETURN row_to_json(new_user);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user_signup TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user_signup TO anon;
