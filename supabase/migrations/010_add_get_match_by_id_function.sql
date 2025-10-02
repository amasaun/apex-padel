-- Create a function to get match by ID that bypasses RLS for sharing private matches
-- Drop existing function first if it exists
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
  created_by UUID,
  created_at TIMESTAMPTZ,
  bookings JSONB
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
              'created_at', u.created_at
            )
          )
        )
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        WHERE b.match_id = m.id
      ),
      '[]'::jsonb
    ) as bookings
  FROM matches m
  WHERE m.id = match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
