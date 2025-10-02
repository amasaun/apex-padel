# Authentication Setup Guide

## Quick Start (Create Your Admin Account)

### 1. Set Up Supabase (if you haven't already)

Follow the instructions in `SUPABASE_SETUP.md` to:
1. Create a Supabase project
2. Get your API keys
3. Create `.env` file with your credentials
4. Run all 3 migrations:
   - `001_initial_schema.sql` - Core tables
   - `002_invite_system.sql` - Invite codes
   - `003_admin_roles.sql` - Admin system

### 2. Enable Email Authentication in Supabase

1. Go to your Supabase dashboard
2. Navigate to **Authentication** → **Providers**
3. Find **Email** provider
4. Make sure it's **enabled**
5. Optional: Disable "Confirm email" if you want to test without email verification
   - Go to **Authentication** → **Settings** → **Email Auth**
   - Uncheck "Enable email confirmations" for testing (re-enable for production!)

### 3. Create Your Admin Account

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:5173/auth`

3. Click "Sign Up" and fill in:
   - **Full Name**: Your name
   - **Email**: Your email
   - **Phone**: (optional)
   - **Initial Ranking**: Choose your skill level
   - **Password**: At least 6 characters

4. Click "Create Account"

5. **You will automatically become an admin** (first user gets admin by default)

6. Check your email for verification link (if email confirmations are enabled)

7. Once verified, sign in at `/auth`

### 4. Verify You're an Admin

After signing in:

1. Open browser console (F12)
2. Run this:
   ```javascript
   supabase.from('users').select('*').eq('email', 'your@email.com').single()
   ```
3. Check that `is_admin: true` in the response

Or check in Supabase dashboard:
1. Go to **Table Editor**
2. Open `users` table
3. Find your user
4. Verify `is_admin` column is `true`

### 5. Create Invite Codes for Other Users

Once you're signed in as admin:

1. Navigate to `/invites`
2. Click "+ Create Invite"
3. Configure invite settings:
   - **Email**: (optional) Restrict to specific email
   - **Expires in**: Days until expiration
   - **Max Uses**: How many people can use this code
   - **Notes**: Remember who it's for
4. Click "Generate Invite Code"
5. Copy the code and share with new users

### 6. Make Other Users Admins

To promote other users to admin:

```typescript
import { makeUserAdmin } from '@/lib/auth';

// Get their user ID from the users table
await makeUserAdmin('user-uuid-here');
```

Or directly in Supabase:
1. Go to **Table Editor** → `users`
2. Find the user
3. Edit their row
4. Set `is_admin` to `true`

## How Authentication Works

### Sign Up Flow
1. User fills signup form at `/auth`
2. Supabase creates auth account
3. App creates profile in `users` table
4. First user automatically gets `is_admin: true`
5. Email verification sent (if enabled)

### Sign In Flow
1. User enters email/password at `/auth`
2. Supabase validates credentials
3. User redirected to `/matches`
4. Can now create matches, book slots, etc.

### Admin Privileges
Admins can:
- Create invite codes for new users
- Manage all matches (not just their own)
- Promote other users to admin
- View all user profiles

## Current User in Components

To get the current authenticated user:

```typescript
import { getCurrentUser, getCurrentUserProfile } from '@/lib/auth';

// Get Supabase auth user
const authUser = await getCurrentUser();

// Get full profile from users table
const profile = await getCurrentUserProfile();

// Check if admin
const isAdmin = profile?.is_admin || false;
```

## Testing Without Email Verification

For development, you can disable email confirmations:

1. Supabase Dashboard → **Authentication** → **Settings**
2. Scroll to **Email Auth**
3. Uncheck "Enable email confirmations"
4. Save

Now users can sign in immediately without verifying email.

**Remember to re-enable this in production!**

## Switching Between Demo and Real Mode

The app currently uses mock data. To switch to real Supabase data, you'll need to:
1. Update components to use API functions from `src/lib/api.ts`
2. Replace `mockUsers[0]` with `getCurrentUser()`
3. Use React Query for data fetching

This will be done in the next phase of development.

## Troubleshooting

### "Invalid login credentials"
- Check email/password are correct
- Verify user exists in Supabase Authentication → Users
- Check if email confirmation is required

### "User not found in users table"
- The signup didn't complete properly
- Manually add user to `users` table with matching `id` from auth.users

### "Not authorized"
- Check RLS policies are set up correctly
- Verify user is authenticated
- Check user has correct permissions

### "Invite code required"
- The invite enforcement trigger is enabled
- You need a valid invite code to sign up
- Disable trigger or create invite codes
