-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  photo_url TEXT,
  ranking TEXT DEFAULT '3.0',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create matches table
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration INTEGER NOT NULL, -- in minutes: 60, 90, 120, 180
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
  UNIQUE(match_id, user_id) -- Prevent duplicate bookings
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(date);
CREATE INDEX IF NOT EXISTS idx_matches_created_by ON matches(created_by);
CREATE INDEX IF NOT EXISTS idx_bookings_match_id ON bookings(match_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view all users"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policies for matches table
CREATE POLICY "Anyone can view matches"
  ON matches FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create matches"
  ON matches FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Match creators can update their matches"
  ON matches FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Match creators can delete their matches"
  ON matches FOR DELETE
  USING (auth.uid() = created_by);

-- RLS Policies for bookings table
CREATE POLICY "Anyone can view bookings"
  ON bookings FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bookings"
  ON bookings FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Match creators can delete any booking for their match"
  ON bookings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = bookings.match_id
      AND matches.created_by = auth.uid()
    )
  );

-- Create a view for matches with details (includes bookings and available slots)
CREATE OR REPLACE VIEW matches_with_details AS
SELECT
  m.*,
  COALESCE(
    json_agg(
      json_build_object(
        'id', b.id,
        'match_id', b.match_id,
        'user_id', b.user_id,
        'created_at', b.created_at,
        'user', json_build_object(
          'id', u.id,
          'name', u.name,
          'email', u.email,
          'phone', u.phone,
          'photo_url', u.photo_url,
          'ranking', u.ranking,
          'created_at', u.created_at
        )
      ) ORDER BY b.created_at
    ) FILTER (WHERE b.id IS NOT NULL),
    '[]'::json
  ) as bookings,
  m.max_players - COUNT(b.id) as available_slots
FROM matches m
LEFT JOIN bookings b ON m.id = b.match_id
LEFT JOIN users u ON b.user_id = u.id
GROUP BY m.id;
