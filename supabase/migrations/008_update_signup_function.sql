-- Update handle_new_user_signup function to include invited_by_code
CREATE OR REPLACE FUNCTION handle_new_user_signup(
  user_id UUID,
  user_email TEXT,
  user_name TEXT,
  user_phone TEXT DEFAULT NULL,
  user_ranking TEXT DEFAULT '3.0',
  user_invited_by_code TEXT DEFAULT NULL
)
RETURNS users AS $$
DECLARE
  new_user users;
  user_count INTEGER;
BEGIN
  -- Count existing users
  SELECT COUNT(*) INTO user_count FROM users;

  -- Insert the new user profile
  INSERT INTO users (id, email, name, phone, ranking, invited_by_code, is_admin, created_at)
  VALUES (
    user_id,
    user_email,
    user_name,
    user_phone,
    user_ranking,
    user_invited_by_code,
    (user_count = 0), -- First user is admin
    NOW()
  )
  RETURNING * INTO new_user;

  RETURN new_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
