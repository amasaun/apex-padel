-- ================================================
-- Add Tournament Feature
-- Allows matches to be configured as tournaments with more players and gender quotas
-- ================================================

-- Add tournament fields to matches table
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS is_tournament BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS required_ladies INTEGER,
ADD COLUMN IF NOT EXISTS required_lads INTEGER,
ADD COLUMN IF NOT EXISTS price_per_player NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS prize_first NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS prize_second NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS prize_third NUMERIC(10, 2);

-- Add check constraint to ensure gender requirements don't exceed max players
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_gender_requirements'
    AND conrelid = 'matches'::regclass
  ) THEN
    ALTER TABLE matches
    ADD CONSTRAINT check_gender_requirements
    CHECK (
      (required_ladies IS NULL AND required_lads IS NULL) OR
      (required_ladies + required_lads <= max_players)
    );
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN matches.is_tournament IS 'Whether this match is a tournament (allows more players and gender quotas)';
COMMENT ON COLUMN matches.required_ladies IS 'Exact number of female players required for tournament';
COMMENT ON COLUMN matches.required_lads IS 'Exact number of male players required for tournament';
COMMENT ON COLUMN matches.price_per_player IS 'Price per player for paid matches (total_cost = price_per_player * max_players)';
COMMENT ON COLUMN matches.prize_first IS 'Prize money for 1st place (tournaments only)';
COMMENT ON COLUMN matches.prize_second IS 'Prize money for 2nd place (tournaments only, optional)';
COMMENT ON COLUMN matches.prize_third IS 'Prize money for 3rd place (tournaments only, optional)';

-- Update the get_match_by_id function to include new tournament fields
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
  is_tournament BOOLEAN,
  required_level NUMERIC,
  required_ladies INTEGER,
  required_lads INTEGER,
  gender_requirement TEXT,
  total_cost NUMERIC,
  price_per_player NUMERIC,
  prize_first NUMERIC,
  prize_second NUMERIC,
  prize_third NUMERIC,
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
    m.is_tournament,
    m.required_level,
    m.required_ladies,
    m.required_lads,
    m.gender_requirement,
    m.total_cost,
    m.price_per_player,
    m.prize_first,
    m.prize_second,
    m.prize_third,
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
