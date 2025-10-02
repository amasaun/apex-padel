-- ================================================
-- COMPLETE DATABASE SETUP FOR APEX PADEL
-- Run this entire script in Supabase SQL Editor
-- ================================================

-- ================================================
-- 1. CORE SCHEMA (Users, Matches, Bookings)
-- ================================================

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  photo_url TEXT,
  ranking TEXT DEFAULT '3.0',
  is_admin BOOLEAN DEFAULT false,
  invite_code_used TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create matches table
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration INTEGER NOT NULL,
  max_players INTEGER NOT NULL DEFAULT 4,
  location TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(match_id, user_id)
);

-- Create invites table
CREATE TABLE IF NOT EXISTS invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  email TEXT,
  phone TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  used_by UUID REFERENCES users(id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- ================================================
-- 2. INDEXES
-- ================================================

CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(date);
CREATE INDEX IF NOT EXISTS idx_matches_created_by ON matches(created_by);
CREATE INDEX IF NOT EXISTS idx_bookings_match_id ON bookings(match_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_invites_code ON invites(code);
CREATE INDEX IF NOT EXISTS idx_invites_created_by ON invites(created_by);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
CREATE INDEX IF NOT EXISTS idx_users_invite_code ON users(invite_code_used);

-- ================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- Users policies
DROP POLICY IF EXISTS "Users can view all users" ON users;
CREATE POLICY "Users can view all users" ON users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
CREATE POLICY "Users can insert their own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Only admins can promote users" ON users;
CREATE POLICY "Only admins can promote users" ON users FOR UPDATE
  USING (auth.uid() = id OR (SELECT is_admin FROM users WHERE id = auth.uid()))
  WITH CHECK ((NEW.is_admin = OLD.is_admin) OR (SELECT is_admin FROM users WHERE id = auth.uid()));

-- Matches policies
DROP POLICY IF EXISTS "Anyone can view matches" ON matches;
CREATE POLICY "Anyone can view matches" ON matches FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create matches" ON matches;
CREATE POLICY "Authenticated users can create matches" ON matches FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Match creators can update their matches" ON matches;
CREATE POLICY "Match creators can update their matches" ON matches FOR UPDATE USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Match creators can delete their matches" ON matches;
CREATE POLICY "Match creators can delete their matches" ON matches FOR DELETE USING (auth.uid() = created_by);

-- Bookings policies
DROP POLICY IF EXISTS "Anyone can view bookings" ON bookings;
CREATE POLICY "Anyone can view bookings" ON bookings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create bookings" ON bookings;
CREATE POLICY "Authenticated users can create bookings" ON bookings FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own bookings" ON bookings;
CREATE POLICY "Users can delete their own bookings" ON bookings FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Match creators can delete any booking" ON bookings;
CREATE POLICY "Match creators can delete any booking" ON bookings FOR DELETE
  USING (EXISTS (SELECT 1 FROM matches WHERE matches.id = bookings.match_id AND matches.created_by = auth.uid()));

-- Invites policies
DROP POLICY IF EXISTS "Anyone can view unused invites" ON invites;
CREATE POLICY "Anyone can view unused invites" ON invites FOR SELECT
  USING (used_at IS NULL AND (expires_at IS NULL OR expires_at > NOW()));

DROP POLICY IF EXISTS "Authenticated users can create invites" ON invites;
CREATE POLICY "Authenticated users can create invites" ON invites FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "System can update invites" ON invites;
CREATE POLICY "System can update invites" ON invites FOR UPDATE USING (true);

-- ================================================
-- 4. FUNCTIONS
-- ================================================

-- Generate random invite code
CREATE OR REPLACE FUNCTION generate_invite_code() RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Use invite code
CREATE OR REPLACE FUNCTION use_invite_code(
  invite_code TEXT,
  user_email TEXT DEFAULT NULL,
  user_phone TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  invite_record RECORD;
BEGIN
  SELECT * INTO invite_record FROM invites
  WHERE code = invite_code
  AND (expires_at IS NULL OR expires_at > NOW())
  AND current_uses < max_uses FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invite code';
  END IF;

  IF invite_record.email IS NOT NULL AND invite_record.email != user_email THEN
    RAISE EXCEPTION 'This invite is for a different email address';
  END IF;

  IF invite_record.phone IS NOT NULL AND invite_record.phone != user_phone THEN
    RAISE EXCEPTION 'This invite is for a different phone number';
  END IF;

  UPDATE invites SET
    current_uses = current_uses + 1,
    used_at = CASE WHEN used_at IS NULL THEN NOW() ELSE used_at END,
    used_by = CASE WHEN used_by IS NULL THEN auth.uid() ELSE used_by END
  WHERE code = invite_code;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Make first user admin
CREATE OR REPLACE FUNCTION make_first_user_admin() RETURNS TRIGGER AS $$
DECLARE
  user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM users;
  IF user_count = 0 THEN
    NEW.is_admin = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_first_user_as_admin ON users;
CREATE TRIGGER set_first_user_as_admin
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION make_first_user_admin();

-- ================================================
-- DONE! Your database is ready.
-- Next: Enable Email auth and create your account at /auth
-- ================================================
