-- Debug and fix admin match update policy
-- Check current policies and rebuild them properly

-- Drop ALL existing update policies for matches to start fresh
DROP POLICY IF EXISTS "Match creators can update their matches" ON matches;
DROP POLICY IF EXISTS "Match creators and admins can update matches" ON matches;
DROP POLICY IF EXISTS "Creators and admins can update matches" ON matches;
DROP POLICY IF EXISTS "update_matches_policy" ON matches;

-- Create a simple, working UPDATE policy
-- This allows match creators AND admins to update matches
CREATE POLICY "match_update_policy" ON matches
  FOR UPDATE
  USING (
    -- Can select/see the row if:
    -- 1. You created it, OR
    -- 2. You are an admin
    (created_by = auth.uid())
    OR
    (
      EXISTS (
        SELECT 1
        FROM users
        WHERE id = auth.uid()
        AND is_admin = true
      )
    )
  )
  WITH CHECK (
    -- Can update to these values if:
    -- 1. You created it, OR
    -- 2. You are an admin
    (created_by = auth.uid())
    OR
    (
      EXISTS (
        SELECT 1
        FROM users
        WHERE id = auth.uid()
        AND is_admin = true
      )
    )
  );
