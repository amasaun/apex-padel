-- Create locations table for managing padel court locations
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add address column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'locations' AND column_name = 'address'
  ) THEN
    ALTER TABLE locations ADD COLUMN address TEXT;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Policies for locations
DROP POLICY IF EXISTS "Anyone can view active locations" ON locations;
CREATE POLICY "Anyone can view active locations" ON locations
  FOR SELECT
  USING (is_active = true OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS "Only admins can insert locations" ON locations;
CREATE POLICY "Only admins can insert locations" ON locations
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS "Only admins can update locations" ON locations;
CREATE POLICY "Only admins can update locations" ON locations
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS "Only admins can delete locations" ON locations;
CREATE POLICY "Only admins can delete locations" ON locations
  FOR DELETE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));

-- Create index
CREATE INDEX IF NOT EXISTS idx_locations_is_active ON locations(is_active);

-- Insert existing locations from LOCATION_DATA
INSERT INTO locations (name, logo_url, address, is_active) VALUES
  (
    'Padel Up - Century City',
    'https://cdn.prod.website-files.com/6657bfd4bd5e6513709cecf5/66635e7f6ca978c79be4b35f_logo-notext.svg',
    '10250 Santa Monica Blvd, Los Angeles, CA 90067',
    true
  ),
  (
    'Padel Up - Culver City',
    'https://cdn.prod.website-files.com/6657bfd4bd5e6513709cecf5/66635e7f6ca978c79be4b35f_logo-notext.svg',
    '3007 Hauser Blvd, Los Angeles, CA 90016',
    true
  ),
  (
    'The Padel Courts - Hollywood',
    'https://img1.wsimg.com/isteam/ip/37b16837-021b-439a-bf27-a443023d5071/TPC%20Logotype%20White-643073b.png/:/rs=w:370,h:208,cg:true,m/cr=w:370,h:208/qt=q:95',
    '5115 West Sunset Blvd, Los Angeles, CA 90027',
    true
  ),
  (
    'Pura Padel - Sherman Oaks',
    'https://paybycourts3.s3.amazonaws.com/uploads/facility/logo/765/Pura_Padel_Colored_Logo__1_.png',
    '14006 Riverside Dr, Sherman Oaks, CA 91423',
    true
  )
ON CONFLICT (name) DO NOTHING;
