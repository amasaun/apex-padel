-- Fix: Ensure users table RLS allows policies to check admin status
-- The issue might be that the UPDATE policy on matches can't query the users table
-- to check is_admin because of RLS restrictions

-- Check if is_user_admin function exists, if not create it
CREATE OR REPLACE FUNCTION is_user_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM users
        WHERE users.id = auth.uid()
        AND users.is_admin = true
    );
END;
$$;

-- Grant execute to all roles
GRANT EXECUTE ON FUNCTION is_user_admin() TO anon;
GRANT EXECUTE ON FUNCTION is_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_admin() TO service_role;

-- Ensure users table has a SELECT policy that allows checking own admin status
-- This is critical for the matches UPDATE policy to work
DO $$
BEGIN
    -- Check if policy exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'users'
        AND policyname = 'Users can view their own profile for policy checks'
    ) THEN
        -- Create policy to allow users to see their own profile
        CREATE POLICY "Users can view their own profile for policy checks"
            ON users
            FOR SELECT
            TO authenticated
            USING (id = auth.uid());
    END IF;
END $$;

-- Now recreate the matches UPDATE policy to be absolutely sure it's correct
DROP POLICY IF EXISTS "matches_update_policy" ON matches;
DROP POLICY IF EXISTS "Creators and admins can update matches" ON matches;
DROP POLICY IF EXISTS "Match creators and admins can update matches" ON matches;
DROP POLICY IF EXISTS "match_update_policy" ON matches;

-- Create a simple, working UPDATE policy
CREATE POLICY "allow_match_updates" ON matches
    FOR UPDATE
    TO authenticated
    USING (
        -- Can update if creator OR admin
        created_by = auth.uid() OR is_user_admin() = true
    )
    WITH CHECK (
        -- Same check for new values
        created_by = auth.uid() OR is_user_admin() = true
    );

-- Verify policy was created
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'matches'
    AND cmd = 'UPDATE'
    AND policyname = 'allow_match_updates';

    IF policy_count = 0 THEN
        RAISE EXCEPTION 'Failed to create UPDATE policy!';
    ELSE
        RAISE NOTICE 'Policy "allow_match_updates" successfully created!';
    END IF;
END $$;
