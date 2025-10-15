export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  photo_url?: string;
  ranking?: string;
  is_admin?: boolean;
  invited_by_code?: string;
  share_contact_info?: boolean;
  gender?: 'female' | 'male' | 'rather_not_say';
  venmo_username?: string;
  zelle_handle?: string;
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
  required_level?: number; // Minimum ranking required to join (null = all levels)
  gender_requirement?: 'all' | 'male_only' | 'female_only'; // Gender requirement (defaults to 'all')
  total_cost?: number; // Total cost paid for the court (will be split among all bookings)
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

export interface BookingPayment {
  id: string;
  booking_id: string;
  amount_paid: number;
  marked_as_paid: boolean;
  marked_at?: string;
  created_at: string;
  updated_at: string;
}

export interface MatchWithDetails extends Match {
  bookings: (Booking & { user: User })[];
  available_slots: number;
}
