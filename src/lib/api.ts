import { supabase } from './supabase';
import { Match, User, Booking, MatchWithDetails, InviteCode, BookingPayment } from '@/types';

// ============================================
// USERS
// ============================================

export async function getUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('name');

  if (error) throw error;
  return data as User[];
}

export async function getUserById(id: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as User;
}

export async function createUser(user: Omit<User, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('users')
    .insert(user)
    .select()
    .single();

  if (error) throw error;
  return data as User;
}

export async function updateUser(id: string, updates: Partial<User>) {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as User;
}

// ============================================
// MATCHES
// ============================================

export async function getMatches(filters?: { date?: string; location?: string }) {
  let query = supabase
    .from('matches')
    .select(`
      *,
      bookings (
        *,
        user:users (*)
      )
    `)
    .order('date', { ascending: true })
    .order('time', { ascending: true });

  if (filters?.date) {
    query = query.eq('date', filters.date);
  }

  if (filters?.location) {
    query = query.eq('location', filters.location);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Transform data to include available_slots
  const matchesWithDetails: MatchWithDetails[] = (data as any[]).map((match) => ({
    ...match,
    available_slots: match.max_players - (match.bookings?.length || 0),
  }));

  return matchesWithDetails;
}

export async function getMatchById(id: string) {
  // Try using RPC function to bypass RLS for private match sharing
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_match_by_id', {
    match_id: id,
  });

  // If RPC function exists and works
  if (!rpcError && rpcData && rpcData.length > 0) {
    const match = rpcData[0] as any;

    // Parse bookings from JSONB if it's a string
    const bookings = typeof match.bookings === 'string'
      ? JSON.parse(match.bookings)
      : match.bookings || [];

    const matchWithDetails: MatchWithDetails = {
      ...match,
      bookings,
      available_slots: match.max_players - (bookings?.length || 0),
    };

    return matchWithDetails;
  }

  // Fallback to direct query (will fail for private matches due to RLS, but works for public)
  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      bookings (
        *,
        user:users (*)
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  if (!data) throw new Error('Match not found');

  // Transform to include available_slots
  const match = data as any;
  const matchWithDetails: MatchWithDetails = {
    ...match,
    available_slots: match.max_players - (match.bookings?.length || 0),
  };

  return matchWithDetails;
}

export async function createMatch(match: Omit<Match, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('matches')
    .insert(match)
    .select()
    .single();

  if (error) throw error;

  // Automatically add the creator as a player
  const createdMatch = data as Match;
  const { data: bookingData, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      match_id: createdMatch.id,
      user_id: match.created_by,
    })
    .select()
    .single();

  if (bookingError) {
    console.error('Failed to auto-book creator:', bookingError);
    // Don't throw - match was created successfully
  } else if (bookingData && createdMatch.total_cost && createdMatch.total_cost > 0) {
    // If it's a paid match, automatically mark creator as paid
    const perPersonCost = createdMatch.total_cost / createdMatch.max_players;
    const { error: paymentError } = await supabase
      .from('booking_payments')
      .insert({
        booking_id: bookingData.id,
        amount_paid: perPersonCost,
        marked_as_paid: true,
        marked_at: new Date().toISOString(),
      });

    if (paymentError) {
      console.error('Failed to mark creator as paid:', paymentError);
      // Don't throw - match and booking were created successfully
    }
  }

  return createdMatch;
}

export async function updateMatch(id: string, updates: Partial<Match>) {
  const { data, error } = await supabase
    .from('matches')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  const updatedMatch = data as Match;

  // If match now has a cost, ensure creator is marked as paid
  if (updatedMatch.total_cost && updatedMatch.total_cost > 0) {
    // Find creator's booking
    const { data: creatorBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('match_id', updatedMatch.id)
      .eq('user_id', updatedMatch.created_by)
      .single();

    if (creatorBooking) {
      // Check if payment record exists
      const { data: existingPayment } = await supabase
        .from('booking_payments')
        .select('id')
        .eq('booking_id', creatorBooking.id)
        .single();

      // Create payment record if it doesn't exist
      if (!existingPayment) {
        const perPersonCost = updatedMatch.total_cost / updatedMatch.max_players;
        await supabase
          .from('booking_payments')
          .insert({
            booking_id: creatorBooking.id,
            amount_paid: perPersonCost,
            marked_as_paid: true,
            marked_at: new Date().toISOString(),
          });
      }
    }
  }

  return updatedMatch;
}

export async function deleteMatch(id: string) {
  const { error } = await supabase
    .from('matches')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================
// BOOKINGS
// ============================================

export async function createBooking(matchId: string, userId: string) {
  // Directly insert booking - let database constraints handle validation
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      match_id: matchId,
      user_id: userId,
    })
    .select(`
      *,
      user:users (*)
    `)
    .single();

  if (error) {
    // Handle specific error cases
    if (error.code === '23505') { // Unique constraint violation
      throw new Error('You have already booked this match');
    }
    throw error;
  }

  return data as Booking & { user: User };
}

export async function deleteBooking(bookingId: string) {
  const { error } = await supabase
    .from('bookings')
    .delete()
    .eq('id', bookingId);

  if (error) throw error;
}

export async function deleteBookingByUserAndMatch(matchId: string, userId: string) {
  const { error } = await supabase
    .from('bookings')
    .delete()
    .eq('match_id', matchId)
    .eq('user_id', userId);

  if (error) throw error;
}

// ============================================
// BATCH OPERATIONS
// ============================================

export async function updateMatchPlayers(matchId: string, userIds: string[]) {
  // Get existing bookings
  const { data: existingBookings, error: fetchError } = await supabase
    .from('bookings')
    .select('*')
    .eq('match_id', matchId);

  if (fetchError) throw fetchError;

  const existingUserIds = existingBookings?.map((b) => b.user_id) || [];

  // Determine which users to add and remove
  const toAdd = userIds.filter((id) => !existingUserIds.includes(id));
  const toRemove = existingUserIds.filter((id) => !userIds.includes(id));

  // Remove bookings
  if (toRemove.length > 0) {
    const { error: deleteError } = await supabase
      .from('bookings')
      .delete()
      .eq('match_id', matchId)
      .in('user_id', toRemove);

    if (deleteError) throw deleteError;
  }

  // Add bookings
  if (toAdd.length > 0) {
    const newBookings = toAdd.map((userId) => ({
      match_id: matchId,
      user_id: userId,
    }));

    const { error: insertError } = await supabase
      .from('bookings')
      .insert(newBookings);

    if (insertError) throw insertError;
  }
}

// ============================================
// INVITE CODES
// ============================================

export async function getInviteCodes() {
  const { data, error } = await supabase
    .from('invite_codes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as InviteCode[];
}

export async function validateInviteCode(code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('validate_invite_code', {
    invite_code: code,
  });

  if (error) {
    console.error('Error validating invite code:', error);
    return false;
  }

  return data as boolean;
}

export async function createInviteCode(params: {
  code: string;
  expiresAt?: string;
  maxUses?: number;
}) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('invite_codes')
    .insert({
      code: params.code,
      created_by: user.user.id,
      expires_at: params.expiresAt || null,
      max_uses: params.maxUses || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as InviteCode;
}

export async function updateInviteCode(
  id: string,
  updates: Partial<Pick<InviteCode, 'is_active' | 'expires_at' | 'max_uses'>>
) {
  const { data, error } = await supabase
    .from('invite_codes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as InviteCode;
}

export async function deleteInviteCode(id: string) {
  const { error } = await supabase.from('invite_codes').delete().eq('id', id);

  if (error) throw error;
}

// ============================================
// LOCATIONS
// ============================================

export async function getLocations(includeInactive = false) {
  let query = supabase.from('locations').select('*').order('name');

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

export async function createLocation(location: { name: string; logo_url?: string }) {
  const { data, error } = await supabase
    .from('locations')
    .insert({
      name: location.name,
      logo_url: location.logo_url || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateLocation(id: string, updates: { name?: string; logo_url?: string; is_active?: boolean }) {
  const { data, error } = await supabase
    .from('locations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteLocation(id: string) {
  const { error } = await supabase.from('locations').delete().eq('id', id);

  if (error) throw error;
}

// ============================================
// BOOKING PAYMENTS
// ============================================

export async function getPaymentsByMatchId(matchId: string) {
  // Get all bookings for the match
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('id')
    .eq('match_id', matchId);

  if (bookingsError) throw bookingsError;
  if (!bookings || bookings.length === 0) return [];

  const bookingIds = bookings.map(b => b.id);

  // Get payment records for these bookings
  const { data, error } = await supabase
    .from('booking_payments')
    .select('*')
    .in('booking_id', bookingIds);

  if (error) throw error;
  return data as BookingPayment[];
}

export async function getPaymentByBookingId(bookingId: string) {
  const { data, error } = await supabase
    .from('booking_payments')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle();

  if (error) throw error;
  return data as BookingPayment | null;
}

export async function createOrUpdatePayment(bookingId: string, amountPaid: number, markedAsPaid: boolean) {
  // Check if payment record exists
  const existing = await getPaymentByBookingId(bookingId);

  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from('booking_payments')
      .update({
        amount_paid: amountPaid,
        marked_as_paid: markedAsPaid,
        marked_at: markedAsPaid ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('booking_id', bookingId)
      .select()
      .single();

    if (error) throw error;
    return data as BookingPayment;
  } else {
    // Create new
    const { data, error } = await supabase
      .from('booking_payments')
      .insert({
        booking_id: bookingId,
        amount_paid: amountPaid,
        marked_as_paid: markedAsPaid,
        marked_at: markedAsPaid ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) throw error;
    return data as BookingPayment;
  }
}

export async function markPaymentAsPaid(bookingId: string, amountPaid: number) {
  return createOrUpdatePayment(bookingId, amountPaid, true);
}
