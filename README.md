# Apex Padel

A community app for managing padel matches and court bookings.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run development server:**
   ```bash
   npm run dev
   ```

3. **Open in browser:**
   Navigate to `http://localhost:5173`

## Current Status

✅ **Phase 1: Demo Mode (Current)**
- View upcoming matches with mock data
- See player profiles
- Basic booking interface (no persistence)
- Mobile-first responsive design

🔄 **Phase 2: Coming Soon**
- Supabase database integration
- Real match creation and booking
- Email confirmations
- WhatsApp authentication

## Tech Stack

- **Frontend:** Vite + React + TypeScript
- **Styling:** Tailwind CSS
- **Routing:** React Router
- **Data:** React Query (ready for API integration)
- **Database:** Supabase (to be configured)
- **Deployment:** Vercel

## Next Steps

### 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key
3. Create `.env` file:
   ```
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

### 2. Create Database Tables

Run these SQL commands in Supabase SQL Editor:

```sql
-- Users table
create table users (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text,
  phone text,
  photo_url text,
  ranking text,
  created_at timestamp with time zone default now()
);

-- Matches table
create table matches (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  time text not null,
  max_players integer not null default 4,
  created_by uuid references users(id),
  created_at timestamp with time zone default now()
);

-- Bookings table
create table bookings (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid references matches(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique(match_id, user_id)
);
```

### 3. Deploy to Vercel

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

## Development Commands

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript checks
```

## Project Structure

```
src/
├── components/      # Reusable React components
├── pages/          # Page components (Matches, MatchDetail, Profile)
├── lib/            # Utilities and configs
├── types/          # TypeScript types
└── hooks/          # Custom React hooks
```

## Features Roadmap

- [x] Match listing
- [x] Match details
- [x] Player profiles
- [x] Demo mode
- [ ] Database integration
- [ ] Real booking system
- [ ] Email confirmations
- [ ] WhatsApp authentication
- [ ] Match creation form
- [ ] OAuth (Gmail)
- [ ] Player statistics
- [ ] Match history
