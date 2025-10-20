-- Debug script to check admin status and policies

-- 1. Check if you are an admin (replace with your email)
SELECT id, name, email, is_admin
FROM users
WHERE email = 'YOUR_EMAIL_HERE';

-- 2. Check current UPDATE policies on matches table
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'matches'
AND cmd = 'UPDATE';

-- 3. Check all policies on matches table
SELECT
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'matches'
ORDER BY cmd, policyname;
