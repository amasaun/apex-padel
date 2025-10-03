-- Add gender_requirement column to matches table
-- Options: all, male_only, female_only
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS gender_requirement TEXT DEFAULT 'all' CHECK (gender_requirement IN ('all', 'male_only', 'female_only'));

-- Add comment to explain the field
COMMENT ON COLUMN matches.gender_requirement IS 'Gender requirement for match: all, male_only, or female_only. Defaults to all.';
