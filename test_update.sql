-- Test if you can update a match as an admin
-- This will help us see if it's a policy issue or code issue

-- Step 1: Find a public match that you didn't create
SELECT id, title, date, created_by, is_private
FROM matches
WHERE is_private = false
LIMIT 5;

-- Step 2: Get your user ID
SELECT id, email, is_admin FROM users WHERE email = 'YOUR_EMAIL_HERE';

-- Step 3: Try to update a match (replace MATCH_ID with an actual match ID from step 1)
-- This should work if you're an admin
UPDATE matches
SET is_private = true
WHERE id = 'MATCH_ID_HERE';

-- Step 4: Check if it worked
SELECT id, is_private FROM matches WHERE id = 'MATCH_ID_HERE';

-- Step 5: Rollback the change
UPDATE matches
SET is_private = false
WHERE id = 'MATCH_ID_HERE';
