-- Comprehensive fix for admin match updates
-- This migration ensures admins can update matches including marking them private

-- First, drop ALL existing update policies to start clean
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'matches' AND cmd = 'UPDATE'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON matches', pol.policyname);
    END LOOP;
END $$;

-- Create a helper function to check if user is admin
-- This makes the policy cleaner and more efficient
CREATE OR REPLACE FUNCTION is_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM users
        WHERE users.id = auth.uid()
        AND users.is_admin = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION is_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_admin() TO anon;

-- Create the new UPDATE policy using the function
CREATE POLICY "matches_update_policy" ON matches
    FOR UPDATE
    TO authenticated
    USING (
        -- Can update if: creator OR admin
        (created_by = auth.uid()) OR is_user_admin()
    )
    WITH CHECK (
        -- Same check - allows updating any field including is_private
        (created_by = auth.uid()) OR is_user_admin()
    );

-- Verify the policy was created
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'matches'
        AND policyname = 'matches_update_policy'
        AND cmd = 'UPDATE'
    ) THEN
        RAISE EXCEPTION 'Policy creation failed!';
    END IF;

    RAISE NOTICE 'Policy successfully created!';
END $$;
