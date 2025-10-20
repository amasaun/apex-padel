-- Update get_match_by_id function to include match_gender in bookings
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
            'match_gender', b.match_gender,
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
            'gender', gb.gender,
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
