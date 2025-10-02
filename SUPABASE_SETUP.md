# Supabase Setup Guide

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign in or create an account
3. Click "New Project"
4. Choose your organization
5. Enter project details:
   - **Name**: apex-padel
   - **Database Password**: (create a strong password and save it)
   - **Region**: Choose closest to your users
6. Click "Create new project"

## 2. Get Your API Keys

1. Once the project is created, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (the `anon` key under "Project API keys")

## 3. Set Up Environment Variables

1. Create a `.env` file in the project root:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

## 4. Run Database Migrations

### Migration 1: Core Schema

1. Go to **SQL Editor** in your Supabase dashboard
2. Click "New query"
3. Copy the contents of `supabase/migrations/001_initial_schema.sql`
4. Paste into the SQL Editor
5. Click "Run" or press Cmd+Enter (Mac) / Ctrl+Enter (Windows)

This will create:
- `users` table
- `matches` table
- `bookings` table
- Indexes for performance
- Row Level Security (RLS) policies
- A view `matches_with_details` for efficient queries

### Migration 2: Invite System (Optional but Recommended)

1. Create a new query in SQL Editor
2. Copy the contents of `supabase/migrations/002_invite_system.sql`
3. Paste into the SQL Editor
4. Click "Run"

This will create:
- `invites` table for invite-only signups
- Helper functions for generating and validating invite codes
- RLS policies for invite management
- Optional trigger to enforce invite-only signups (commented out by default)

## 5. Verify the Setup

1. Go to **Table Editor** in Supabase dashboard
2. You should see three tables: `users`, `matches`, `bookings`
3. Go to **Authentication** → **Providers**
4. Enable email provider (or whichever auth method you want to use)

## 6. (Optional) Seed Test Data

Once you have authentication set up, you can create test users and matches through the app.

For now, in demo mode, the app will use mock data until authentication is implemented.

## 7. Run the App

```bash
npm run dev
```

The app will now connect to your Supabase database!

## Database Schema

### Users Table
- `id` - UUID (primary key)
- `name` - Text
- `email` - Text (unique)
- `phone` - Text (unique)
- `photo_url` - Text
- `ranking` - Text (default: '3.0')
- `created_at` - Timestamp

### Matches Table
- `id` - UUID (primary key)
- `title` - Text (optional)
- `date` - Date
- `time` - Time
- `duration` - Integer (minutes)
- `max_players` - Integer
- `location` - Text
- `created_by` - UUID (foreign key to users)
- `created_at` - Timestamp

### Bookings Table
- `id` - UUID (primary key)
- `match_id` - UUID (foreign key to matches)
- `user_id` - UUID (foreign key to users)
- `created_at` - Timestamp
- Unique constraint on (match_id, user_id)

## Row Level Security (RLS)

RLS policies are already configured to:
- Allow anyone to view users, matches, and bookings
- Only allow users to update their own profile
- Only allow match creators to edit/delete their matches
- Only allow users to book slots for themselves
- Allow match creators to remove any player from their match

## Invite-Based Signup System

The invite system allows you to control who can sign up:

### How It Works

1. **Admin/existing users generate invite codes** using the InviteManager component
2. **New users must enter a valid invite code** during signup
3. **Invite codes can be:**
   - Single-use or multi-use
   - Time-limited (expiring after X days)
   - Restricted to specific email or phone number
   - Revoked at any time

### Creating Invites

```typescript
import { createInvite } from '@/lib/invites';

// Create a simple invite (1 use, expires in 7 days)
await createInvite({
  expiresInDays: 7,
  maxUses: 1,
  notes: 'For John from the tournament'
});

// Create an email-restricted invite
await createInvite({
  email: 'newplayer@example.com',
  expiresInDays: 30,
  maxUses: 1
});

// Create a multi-use invite for a group
await createInvite({
  maxUses: 10,
  expiresInDays: 14,
  notes: 'For beginner clinic attendees'
});
```

### Validating During Signup

```typescript
import { validateInviteCode, useInviteCode } from '@/lib/invites';

// Check if code is valid
const result = await validateInviteCode('ABC12345', userEmail);
if (!result.valid) {
  console.error(result.message);
  return;
}

// Use the code during signup
await useInviteCode('ABC12345', userEmail);
```

### Enforcing Invite-Only Signups

To make invites **required** for all signups:

1. Go to SQL Editor in Supabase
2. Run this command to enable the trigger:
   ```sql
   CREATE TRIGGER enforce_invite_signup
     BEFORE INSERT ON users
     FOR EACH ROW
     EXECUTE FUNCTION check_invite_on_signup();
   ```

To disable invite-only mode later:
```sql
DROP TRIGGER IF EXISTS enforce_invite_signup ON users;
```

### Managing Invites

Use the `InviteManager` component to:
- Create new invites with custom settings
- View all your created invites
- See usage statistics
- Revoke unused invites
- Copy invite codes to share
