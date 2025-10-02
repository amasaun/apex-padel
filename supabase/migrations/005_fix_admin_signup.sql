-- Update signup function to NOT automatically make users admin
-- Admins must be manually promoted
CREATE OR REPLACE FUNCTION public.handle_new_user_signup(
  user_id UUID,
  user_email TEXT,
  user_name TEXT,
  user_phone TEXT DEFAULT NULL,
  user_ranking TEXT DEFAULT '3.0'
) RETURNS JSON AS $$
DECLARE
  new_user users%ROWTYPE;
BEGIN
  -- Insert new user (NOT as admin by default)
  INSERT INTO users (id, email, name, phone, ranking, is_admin)
  VALUES (user_id, user_email, user_name, user_phone, user_ranking, false)
  RETURNING * INTO new_user;

  RETURN row_to_json(new_user);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
