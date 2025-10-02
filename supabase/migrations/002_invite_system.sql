-- Create invites table
CREATE TABLE IF NOT EXISTS invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  email TEXT, -- Optional: restrict invite to specific email
  phone TEXT, -- Optional: restrict invite to specific phone
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  used_by UUID REFERENCES users(id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  max_uses INTEGER DEFAULT 1, -- How many times this code can be used
  current_uses INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT -- Optional notes about the invite
);

-- Create index for fast code lookups
CREATE INDEX IF NOT EXISTS idx_invites_code ON invites(code);
CREATE INDEX IF NOT EXISTS idx_invites_created_by ON invites(created_by);

-- Enable RLS
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view unused invites (to validate)"
  ON invites FOR SELECT
  USING (used_at IS NULL AND (expires_at IS NULL OR expires_at > NOW()));

CREATE POLICY "Authenticated users can create invites"
  ON invites FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "System can update invites when used"
  ON invites FOR UPDATE
  USING (true); -- This will be handled by app logic

-- Function to validate and use an invite code
CREATE OR REPLACE FUNCTION use_invite_code(
  invite_code TEXT,
  user_email TEXT DEFAULT NULL,
  user_phone TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  invite_record RECORD;
BEGIN
  -- Find the invite
  SELECT * INTO invite_record
  FROM invites
  WHERE code = invite_code
  AND (expires_at IS NULL OR expires_at > NOW())
  AND current_uses < max_uses
  FOR UPDATE;

  -- Check if invite exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invite code';
  END IF;

  -- Check email restriction (if set)
  IF invite_record.email IS NOT NULL AND invite_record.email != user_email THEN
    RAISE EXCEPTION 'This invite is for a different email address';
  END IF;

  -- Check phone restriction (if set)
  IF invite_record.phone IS NOT NULL AND invite_record.phone != user_phone THEN
    RAISE EXCEPTION 'This invite is for a different phone number';
  END IF;

  -- Mark invite as used
  UPDATE invites
  SET current_uses = current_uses + 1,
      used_at = CASE WHEN used_at IS NULL THEN NOW() ELSE used_at END,
      used_by = CASE WHEN used_by IS NULL THEN auth.uid() ELSE used_by END
  WHERE code = invite_code;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate random invite code
CREATE OR REPLACE FUNCTION generate_invite_code() RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Exclude similar looking chars
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Add invite_code to users table to track which invite they used
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_code_used TEXT;
CREATE INDEX IF NOT EXISTS idx_users_invite_code ON users(invite_code_used);

-- Create a trigger to prevent signup without valid invite
CREATE OR REPLACE FUNCTION check_invite_on_signup() RETURNS TRIGGER AS $$
BEGIN
  -- Skip check if user already has invite_code_used set
  IF NEW.invite_code_used IS NULL THEN
    RAISE EXCEPTION 'Signup requires a valid invite code';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Uncomment this trigger when you're ready to enforce invite-only signups
-- CREATE TRIGGER enforce_invite_signup
--   BEFORE INSERT ON users
--   FOR EACH ROW
--   EXECUTE FUNCTION check_invite_on_signup();
