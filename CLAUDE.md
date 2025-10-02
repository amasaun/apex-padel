# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Apex Padel - A community app for managing padel matches and court bookings. The app allows users to view upcoming matches, book available slots, and manage their player profiles.

## Key Features

1. **Authentication** (phased approach)
   - Phase 1: Demo mode without login for initial feedback
   - Phase 2: WhatsApp authentication (existing community)
   - Phase 3: Username/password and OAuth (Gmail)

2. **Match Management**
   - View upcoming matches with details (date, time, players, available slots)
   - Create new matches with configurable parameters
   - Book available slots in matches
   - Email confirmation for bookings

3. **User Profiles**
   - Player photo
   - Name
   - Ranking/skill level

## Tech Stack

### Frontend
- **Vite + React + TypeScript** - Fast development and build tool
- **Tailwind CSS** - For rapid UI development
- **React Query** - For data fetching and caching
- **React Router** - Client-side routing

### Backend & Database
- **Supabase** - PostgreSQL database with built-in auth, REST API, and real-time subscriptions
- **Supabase Client** - For database queries and authentication

### Deployment
- **Vercel** - Frontend hosting and deployment
- **Supabase Cloud** - Managed database hosting

### Services
- **Resend** - Email confirmations
- **Cloudinary** - Profile image storage (or Supabase Storage)
- **WhatsApp Business API** - For Phase 2 authentication

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Run linting
npm run lint

# Run type checking
npm run type-check
```

## Project Structure

```
/apex-padel
├── src/
│   ├── components/          # Reusable React components
│   │   ├── matches/         # Match-related components
│   │   ├── profile/         # Profile components
│   │   └── ui/              # Generic UI components
│   ├── pages/               # Page components
│   │   ├── Matches.tsx      # Match listing page
│   │   ├── MatchDetail.tsx  # Match detail page
│   │   └── Profile.tsx      # User profile page
│   ├── lib/                 # Utility functions and configs
│   │   ├── supabase.ts      # Supabase client setup
│   │   ├── auth.ts          # Authentication helpers
│   │   └── api.ts           # API utility functions
│   ├── types/               # TypeScript type definitions
│   ├── hooks/               # Custom React hooks
│   ├── App.tsx              # Main app component
│   └── main.tsx             # Entry point
├── supabase/                # Supabase schema and migrations
│   └── migrations/
├── public/                  # Static assets
└── vercel.json              # Vercel deployment config
```

## Database Schema

### Core Tables
- **users** - User profiles and authentication
- **matches** - Scheduled padel matches
- **bookings** - Player bookings for matches
- **courts** - Available courts (for future expansion)

## Development Priorities

### Phase 1: MVP Demo (No Auth)
1. Static match listing with mock data
2. Basic booking interface (no persistence)
3. Simple profile cards
4. Responsive mobile-first design

### Phase 2: Core Functionality
1. Database setup and migrations
2. Real match creation and booking
3. Email confirmations
4. Basic WhatsApp authentication

### Phase 3: Enhanced Features
1. OAuth integration
2. Player rankings and statistics
3. Match history
4. Court availability calendar

## Supabase Tables & Queries

### Database Operations
All database operations use Supabase client:
```typescript
// List matches
supabase.from('matches').select('*, bookings(*, users(*))')

// Create match
supabase.from('matches').insert({...})

// Book slot
supabase.from('bookings').insert({...})

// Get user profile
supabase.from('users').select('*').eq('id', userId)
```

## Important Conventions

- Use TypeScript for all new code
- Follow mobile-first responsive design
- Implement optimistic UI updates for better UX
- Use server-side rendering for SEO and performance
- Keep components small and focused
- Write integration tests for critical user flows