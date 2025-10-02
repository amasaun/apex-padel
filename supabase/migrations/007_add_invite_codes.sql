-- Create invite_codes table
CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- Add invited_by_code column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by_code TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_active ON invite_codes(is_active);

-- Enable RLS
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Policies for invite_codes
-- Anyone can read active codes (for validation during signup)
CREATE POLICY "Anyone can read active invite codes"
  ON invite_codes
  FOR SELECT
  USING (is_active = true);

-- Only admins can insert invite codes
CREATE POLICY "Only admins can create invite codes"
  ON invite_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- Only admins can update invite codes
CREATE POLICY "Only admins can update invite codes"
  ON invite_codes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- Only admins can delete invite codes
CREATE POLICY "Only admins can delete invite codes"
  ON invite_codes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- Function to validate and increment invite code usage
CREATE OR REPLACE FUNCTION validate_invite_code(invite_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  code_record RECORD;
BEGIN
  -- Get the invite code record
  SELECT * INTO code_record
  FROM invite_codes
  WHERE code = invite_code
  AND is_active = true;

  -- Check if code exists
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check if expired
  IF code_record.expires_at IS NOT NULL AND code_record.expires_at < NOW() THEN
    RETURN false;
  END IF;

  -- Check if max uses reached
  IF code_record.max_uses IS NOT NULL AND code_record.current_uses >= code_record.max_uses THEN
    RETURN false;
  END IF;

  -- Increment usage count
  UPDATE invite_codes
  SET current_uses = current_uses + 1
  WHERE code = invite_code;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
