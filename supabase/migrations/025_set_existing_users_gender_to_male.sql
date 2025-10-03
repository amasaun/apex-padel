-- Set existing users' gender to 'male'
UPDATE users
SET gender = 'male'
WHERE gender IS NULL;
