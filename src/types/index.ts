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
  is_tournament?: boolean; // Whether this is a tournament (allows more players and gender quotas)
  required_level?: number; // Minimum ranking required to join (null = all levels)
  required_ladies?: number; // Exact number of female players required (tournaments only)
  required_lads?: number; // Exact number of male players required (tournaments only)
  gender_requirement?: 'all' | 'male_only' | 'female_only'; // Gender requirement (defaults to 'all')
  total_cost?: number; // Total cost paid for the court (will be split among all bookings)
  price_per_player?: number; // Price per player (total_cost = price_per_player * max_players)
  prize_first?: number; // 1st place prize (tournaments only)
  prize_second?: number; // 2nd place prize (tournaments only, optional)
  prize_third?: number; // 3rd place prize (tournaments only, optional)
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

export interface GuestBooking {
  id: string;
  match_id: string;
  guest_name?: string;
  guest_number: number;
  gender?: 'female' | 'male' | 'rather_not_say';
  added_by: string;
  created_at: string;
}

export interface GuestBookingPayment {
  id: string;
  guest_booking_id: string;
  amount_paid: number;
  marked_as_paid: boolean;
  marked_at?: string;
  created_at: string;
  updated_at: string;
}

export interface MatchWithDetails extends Match {
  bookings: (Booking & { user: User })[];
  guest_bookings?: GuestBooking[];
  available_slots: number;
}
