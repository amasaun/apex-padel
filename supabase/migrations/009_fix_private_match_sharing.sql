-- Fix RLS for private matches
-- Private matches should ONLY be visible to creator and booked users in the match list
-- Direct match access bypasses RLS via the get_match_by_id() function

-- First, completely drop all existing SELECT policies on matches
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'matches' AND cmd = 'SELECT'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON matches', pol.policyname);
    END LOOP;
END $$;

-- Create new restrictive policy for match lists
CREATE POLICY "matches_select_policy"
  ON matches FOR SELECT
  USING (
    -- Public matches are visible to everyone
    (is_private = false)
    OR
    -- Private matches are ONLY visible if:
    -- 1. You created it
    (is_private = true AND created_by = auth.uid())
    OR
    -- 2. You have booked it
    (is_private = true AND EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.match_id = matches.id
      AND bookings.user_id = auth.uid()
    ))
  );
