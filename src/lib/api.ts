import { supabase } from './supabase';
import { Match, User, Booking, MatchWithDetails, InviteCode, BookingPayment, GuestBooking, GuestBookingPayment } from '@/types';

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
      ),
      guest_bookings (*)
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

  // Transform data to include available_slots (accounting for both regular and guest bookings)
  const matchesWithDetails: MatchWithDetails[] = (data as any[]).map((match) => {
    const regularBookings = match.bookings?.length || 0;
    const guestBookings = match.guest_bookings?.length || 0;
    return {
      ...match,
      available_slots: match.max_players - regularBookings - guestBookings,
    };
  });

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

    const guestBookings = typeof match.guest_bookings === 'string'
      ? JSON.parse(match.guest_bookings)
      : match.guest_bookings || [];

    const matchWithDetails: MatchWithDetails = {
      ...match,
      bookings,
      guest_bookings: guestBookings,
      available_slots: match.max_players - (bookings?.length || 0) - (guestBookings?.length || 0),
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
      ),
      guest_bookings (*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  if (!data) throw new Error('Match not found');

  // Transform to include available_slots
  const match = data as any;
  const regularBookings = match.bookings?.length || 0;
  const guestBookings = match.guest_bookings?.length || 0;
  const matchWithDetails: MatchWithDetails = {
    ...match,
    available_slots: match.max_players - regularBookings - guestBookings,
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
  // Try to update with select first
  const { data, error } = await supabase
    .from('matches')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  // If error and we're marking as private, try without select
  // This handles the case where admin marks match private and can no longer see it
  if (error && updates.is_private === true) {
    console.error('Update with select failed:', error);
    console.log('Trying update without select...');

    const { error: updateError } = await supabase
      .from('matches')
      .update(updates)
      .eq('id', id);

    if (updateError) {
      console.error('Update without select also failed:', updateError);
      throw updateError;
    }

    console.log('Update without select succeeded');
    // Return a partial match object
    return { id, ...updates } as Match;
  }

  if (error) {
    console.error('Update match error:', error);
    throw error;
  }

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
// TOURNAMENT HELPERS
// ============================================

export interface GenderQuotaCheck {
  canBook: boolean;
  reason?: string;
  currentLadies: number;
  currentLads: number;
  requiredLadies?: number;
  requiredLads?: number;
}

export async function checkTournamentGenderQuota(
  match: MatchWithDetails,
  userGender: 'female' | 'male' | 'rather_not_say' | null | undefined
): Promise<GenderQuotaCheck> {
  // Not a tournament - no gender quota
  if (!match.is_tournament) {
    return { canBook: true, currentLadies: 0, currentLads: 0 };
  }

  // Count current ladies and lads from bookings
  const currentLadies = match.bookings.filter(b => b.user?.gender === 'female').length;
  const currentLads = match.bookings.filter(b => b.user?.gender === 'male').length;

  const result: GenderQuotaCheck = {
    canBook: true,
    currentLadies,
    currentLads,
    requiredLadies: match.required_ladies || undefined,
    requiredLads: match.required_lads || undefined,
  };

  // If no gender requirements set, allow booking
  if (!match.required_ladies && !match.required_lads) {
    return result;
  }

  // Check if user's gender would exceed quota
  if (userGender === 'female') {
    if (match.required_ladies && currentLadies >= match.required_ladies) {
      result.canBook = false;
      result.reason = `Ladies spots are full (${currentLadies}/${match.required_ladies}). Lads spots available (${currentLads}/${match.required_lads || 0}).`;
    }
  } else if (userGender === 'male') {
    if (match.required_lads && currentLads >= match.required_lads) {
      result.canBook = false;
      result.reason = `Lads spots are full (${currentLads}/${match.required_lads}). Ladies spots available (${currentLadies}/${match.required_ladies || 0}).`;
    }
  } else {
    // Gender is 'rather_not_say' or null - for tournaments, we need to know gender
    result.canBook = false;
    result.reason = 'This tournament requires gender information. Please update your profile.';
  }

  return result;
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

export async function updateBookingMatchGender(matchId: string, userId: string, matchGender: 'male' | 'female' | null) {
  const { error } = await supabase
    .from('bookings')
    .update({ match_gender: matchGender })
    .eq('match_id', matchId)
    .eq('user_id', userId);

  if (error) throw error;
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

// ============================================
// GUEST BOOKINGS
// ============================================

export async function createGuestBooking(
  matchId: string,
  guestName?: string,
  gender?: 'female' | 'male' | 'rather_not_say'
) {
  // Get next guest number for this match
  const { data: nextNumberData, error: numberError } = await supabase.rpc('get_next_guest_number', {
    p_match_id: matchId,
  });

  if (numberError) throw numberError;

  const guestNumber = nextNumberData as number;
  const finalGuestName = guestName?.trim() || `Guest ${guestNumber}`;

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('guest_bookings')
    .insert({
      match_id: matchId,
      guest_name: finalGuestName,
      guest_number: guestNumber,
      gender: gender || null,
      added_by: user.user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as GuestBooking;
}

export async function deleteGuestBooking(guestBookingId: string) {
  const { error } = await supabase
    .from('guest_bookings')
    .delete()
    .eq('id', guestBookingId);

  if (error) throw error;
}

export async function updateGuestBooking(
  guestBookingId: string,
  updates: {
    guest_name?: string;
    gender?: 'female' | 'male' | 'rather_not_say' | null;
  }
) {
  const { data, error } = await supabase
    .from('guest_bookings')
    .update(updates)
    .eq('id', guestBookingId)
    .select()
    .single();

  if (error) throw error;
  return data as GuestBooking;
}

export async function getGuestPaymentsByMatchId(matchId: string) {
  // Get all guest bookings for the match
  const { data: guestBookings, error: guestBookingsError } = await supabase
    .from('guest_bookings')
    .select('id')
    .eq('match_id', matchId);

  if (guestBookingsError) throw guestBookingsError;
  if (!guestBookings || guestBookings.length === 0) return [];

  const guestBookingIds = guestBookings.map(gb => gb.id);

  // Get payment records for these guest bookings
  const { data, error } = await supabase
    .from('guest_booking_payments')
    .select('*')
    .in('guest_booking_id', guestBookingIds);

  if (error) throw error;
  return data as GuestBookingPayment[];
}

export async function getGuestPaymentByGuestBookingId(guestBookingId: string) {
  const { data, error } = await supabase
    .from('guest_booking_payments')
    .select('*')
    .eq('guest_booking_id', guestBookingId)
    .maybeSingle();

  if (error) throw error;
  return data as GuestBookingPayment | null;
}

export async function createOrUpdateGuestPayment(guestBookingId: string, amountPaid: number, markedAsPaid: boolean) {
  // Check if payment record exists
  const existing = await getGuestPaymentByGuestBookingId(guestBookingId);

  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from('guest_booking_payments')
      .update({
        amount_paid: amountPaid,
        marked_as_paid: markedAsPaid,
        marked_at: markedAsPaid ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('guest_booking_id', guestBookingId)
      .select()
      .single();

    if (error) throw error;
    return data as GuestBookingPayment;
  } else {
    // Create new
    const { data, error } = await supabase
      .from('guest_booking_payments')
      .insert({
        guest_booking_id: guestBookingId,
        amount_paid: amountPaid,
        marked_as_paid: markedAsPaid,
        marked_at: markedAsPaid ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) throw error;
    return data as GuestBookingPayment;
  }
}
