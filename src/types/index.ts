export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  photo_url?: string;
  ranking?: string;
  is_admin?: boolean;
  invited_by_code?: string;
  created_at: string;
}

export interface InviteCode {
  id: string;
  code: string;
  created_by?: string;
  created_at: string;
  expires_at?: string;
  max_uses?: number;
  current_uses: number;
  is_active: boolean;
}

export interface Match {
  id: string;
  title?: string;
  date: string;
  time: string;
  duration: number; // in minutes: 60, 90, 120, 180
  max_players: number;
  location: string;
  is_private?: boolean;
  created_by: string;
  created_at: string;
  bookings?: Booking[];
}

export interface Booking {
  id: string;
  match_id: string;
  user_id: string;
  created_at: string;
  user?: User;
}

export interface MatchWithDetails extends Match {
  bookings: (Booking & { user: User })[];
  available_slots: number;
}
