# Getting Started with Apex Padel

## Quick Setup (5 minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Supabase

#### Option A: Use Demo Mode (No Setup Required)
```bash
npm run dev
```
Navigate to `http://localhost:5173` and start using the app with mock data!

#### Option B: Set Up Real Database
1. Follow **SUPABASE_SETUP.md** to create your Supabase project
2. Create `.env` file with your Supabase credentials
3. Run the 3 SQL migrations in Supabase dashboard
4. Follow **AUTH_SETUP.md** to create your admin account

### 3. Create Your Admin Account

1. Start the app: `npm run dev`
2. Go to `http://localhost:5173/auth`
3. Click "Sign Up" and create your account
4. **You automatically become the first admin!**
5. Navigate to `/invites` to create invite codes for other users

## What You Can Do

### As a User (Demo Mode)
✅ View all upcoming matches
✅ See match details and players
✅ Filter matches by date
✅ View player profiles with rankings

### As an Authenticated User
✅ Everything above, plus:
✅ Create new matches
✅ Book slots in matches
✅ Edit/cancel your own matches
✅ Manage players in your matches

### As an Admin
✅ Everything above, plus:
✅ Create invite codes for new users
✅ Manage all matches (not just yours)
✅ Promote other users to admin
✅ View all user data

## Key Features

### 🎾 Match Management
- Create matches with title, date, time, location, duration
- Support for 4, 6, or 8 player matches
- Automatic slot tracking
- Time-based urgency indicators

### 👥 Player System
- Ranking system (1.0 - 7.0)
- Color-coded skill levels
- Profile photos with ranking badges
- Instant hover tooltips

### 📍 Multiple Locations
- Padel Up - Century City
- Padel Up - Culver City
- The Padel Courts - Hollywood
- Pura Padel - Sherman Oaks

### 🔐 Invite-Based Signups
- Generate unique invite codes
- Email/phone restrictions
- Expiration dates
- Multi-use codes
- Usage tracking

### ⚙️ Admin Controls
- First user = automatic admin
- Create invites for new users
- Manage all matches
- Promote other admins

## Project Structure

```
/apex-padel
├── src/
│   ├── components/        # React components
│   │   ├── CreateMatchModal.tsx
│   │   ├── EditMatchModal.tsx
│   │   └── InviteManager.tsx
│   ├── pages/            # Page components
│   │   ├── Matches.tsx   # Match listing
│   │   ├── MatchDetail.tsx
│   │   ├── Profile.tsx
│   │   └── Auth.tsx      # Login/Signup
│   ├── lib/              # Utilities
│   │   ├── supabase.ts   # Supabase client
│   │   ├── api.ts        # Database operations
│   │   ├── auth.ts       # Authentication
│   │   ├── invites.ts    # Invite system
│   │   ├── utils.ts      # Helper functions
│   │   └── mockData.ts   # Demo data
│   └── types/            # TypeScript types
├── supabase/
│   └── migrations/       # Database schema
└── docs/
    ├── SUPABASE_SETUP.md
    ├── AUTH_SETUP.md
    └── GETTING_STARTED.md (this file)
```

## Development Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Run type checking
npm run type-check

# Lint code
npm run lint
```

## Next Steps

1. **Set up Supabase** - Follow SUPABASE_SETUP.md
2. **Create admin account** - Follow AUTH_SETUP.md
3. **Create invite codes** - Go to `/invites`
4. **Invite your friends** - Share codes with other players
5. **Start creating matches!** - Go to `/matches`

## Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

## Tech Stack

- **Frontend**: Vite + React + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **State Management**: React Query
- **Routing**: React Router
- **Deployment**: Vercel (frontend) + Supabase Cloud (backend)

## Support

If you run into issues:
1. Check the troubleshooting section in AUTH_SETUP.md
2. Verify all migrations ran successfully in Supabase
3. Check browser console for errors
4. Verify `.env` file has correct credentials

## Demo vs Production Mode

### Demo Mode (Current)
- Uses mock data in memory
- No persistence
- No authentication required
- Perfect for testing UI/UX

### Production Mode (After Setup)
- Real Supabase database
- Persistent data
- Authentication required
- Invite-based signups
- Admin controls

The app is currently in **Demo Mode**. Follow the setup guides to enable production features!
