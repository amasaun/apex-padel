-- Create functions to manage admin status that bypass RLS
-- These functions can only be called by admins

-- Function to make a user an admin
CREATE OR REPLACE FUNCTION make_user_admin(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_is_admin BOOLEAN;
BEGIN
  -- Check if the caller is an admin
  SELECT is_admin INTO caller_is_admin
  FROM users
  WHERE id = auth.uid();

  IF NOT caller_is_admin THEN
    RAISE EXCEPTION 'Only admins can make users admins';
  END IF;

  -- Update the target user
  UPDATE users
  SET is_admin = true
  WHERE id = target_user_id;
END;
$$;

-- Function to remove admin status from a user
CREATE OR REPLACE FUNCTION remove_user_admin(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_is_admin BOOLEAN;
BEGIN
  -- Check if the caller is an admin
  SELECT is_admin INTO caller_is_admin
  FROM users
  WHERE id = auth.uid();

  IF NOT caller_is_admin THEN
    RAISE EXCEPTION 'Only admins can remove admin status';
  END IF;

  -- Update the target user
  UPDATE users
  SET is_admin = false
  WHERE id = target_user_id;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION make_user_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_user_admin(UUID) TO authenticated;
