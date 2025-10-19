-- ================================================
-- Add Guest Bookings Feature
-- Allows match creators to add non-registered guests to matches
-- ================================================

-- Create guest_bookings table
CREATE TABLE IF NOT EXISTS guest_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  guest_name TEXT,
  guest_number INTEGER NOT NULL,
  added_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(match_id, guest_number)
);

-- Create guest_booking_payments table for paid matches
CREATE TABLE IF NOT EXISTS guest_booking_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_booking_id UUID NOT NULL REFERENCES guest_bookings(id) ON DELETE CASCADE UNIQUE,
  amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 0,
  marked_as_paid BOOLEAN NOT NULL DEFAULT false,
  marked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_guest_bookings_match_id ON guest_bookings(match_id);
CREATE INDEX IF NOT EXISTS idx_guest_bookings_added_by ON guest_bookings(added_by);
CREATE INDEX IF NOT EXISTS idx_guest_booking_payments_guest_booking_id ON guest_booking_payments(guest_booking_id);

-- Enable RLS
ALTER TABLE guest_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_booking_payments ENABLE ROW LEVEL SECURITY;

-- Guest Bookings Policies

-- Anyone can view guest bookings
DROP POLICY IF EXISTS "Anyone can view guest bookings" ON guest_bookings;
CREATE POLICY "Anyone can view guest bookings" ON guest_bookings
  FOR SELECT USING (true);

-- Match creators and admins can insert guest bookings
DROP POLICY IF EXISTS "Match creators can add guest bookings" ON guest_bookings;
CREATE POLICY "Match creators can add guest bookings" ON guest_bookings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = guest_bookings.match_id
      AND (matches.created_by = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true))
    )
  );

-- Match creators and admins can delete guest bookings
DROP POLICY IF EXISTS "Match creators can delete guest bookings" ON guest_bookings;
CREATE POLICY "Match creators can delete guest bookings" ON guest_bookings
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = guest_bookings.match_id
      AND (matches.created_by = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true))
    )
  );

-- Guest Booking Payments Policies

-- Anyone can view guest booking payments
DROP POLICY IF EXISTS "Anyone can view guest booking payments" ON guest_booking_payments;
CREATE POLICY "Anyone can view guest booking payments" ON guest_booking_payments
  FOR SELECT USING (true);

-- Match creators and admins can insert guest booking payments
DROP POLICY IF EXISTS "Match creators can add guest booking payments" ON guest_booking_payments;
CREATE POLICY "Match creators can add guest booking payments" ON guest_booking_payments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM guest_bookings
      JOIN matches ON matches.id = guest_bookings.match_id
      WHERE guest_bookings.id = guest_booking_payments.guest_booking_id
      AND (matches.created_by = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true))
    )
  );

-- Match creators and admins can update guest booking payments
DROP POLICY IF EXISTS "Match creators can update guest booking payments" ON guest_booking_payments;
CREATE POLICY "Match creators can update guest booking payments" ON guest_booking_payments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM guest_bookings
      JOIN matches ON matches.id = guest_bookings.match_id
      WHERE guest_bookings.id = guest_booking_payments.guest_booking_id
      AND (matches.created_by = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true))
    )
  );

-- Function to auto-generate guest number for a match
CREATE OR REPLACE FUNCTION get_next_guest_number(p_match_id UUID)
RETURNS INTEGER AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(guest_number), 0) + 1 INTO next_number
  FROM guest_bookings
  WHERE match_id = p_match_id;

  RETURN next_number;
END;
$$ LANGUAGE plpgsql;

-- Update the get_match_by_id function to include guest bookings
DROP FUNCTION IF EXISTS get_match_by_id(UUID);
CREATE OR REPLACE FUNCTION get_match_by_id(match_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  "date" DATE,
  "time" TIME,
  duration INTEGER,
  max_players INTEGER,
  location TEXT,
  is_private BOOLEAN,
  required_level NUMERIC,
  gender_requirement TEXT,
  total_cost NUMERIC,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  bookings JSONB,
  guest_bookings JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.title,
    m."date",
    m."time",
    m.duration,
    m.max_players,
    m.location,
    m.is_private,
    m.required_level,
    m.gender_requirement,
    m.total_cost,
    m.created_by,
    m.created_at,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', b.id,
            'match_id', b.match_id,
            'user_id', b.user_id,
            'created_at', b.created_at,
            'user', jsonb_build_object(
              'id', u.id,
              'name', u.name,
              'email', u.email,
              'phone', u.phone,
              'photo_url', u.photo_url,
              'ranking', u.ranking,
              'is_admin', u.is_admin,
              'invited_by_code', u.invited_by_code,
              'share_contact_info', u.share_contact_info,
              'gender', u.gender,
              'venmo_username', u.venmo_username,
              'zelle_handle', u.zelle_handle,
              'created_at', u.created_at
            )
          )
        )
        FROM bookings b
        JOIN users u ON u.id = b.user_id
        WHERE b.match_id = m.id
      ),
      '[]'::jsonb
    ) AS bookings,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', gb.id,
            'match_id', gb.match_id,
            'guest_name', gb.guest_name,
            'guest_number', gb.guest_number,
            'added_by', gb.added_by,
            'created_at', gb.created_at
          )
        )
        FROM guest_bookings gb
        WHERE gb.match_id = m.id
      ),
      '[]'::jsonb
    ) AS guest_bookings
  FROM matches m
  WHERE m.id = match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
