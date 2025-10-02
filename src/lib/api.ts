import { supabase } from './supabase';
import { Match, User, Booking, MatchWithDetails, InviteCode } from '@/types';

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
    .gte('date', new Date().toISOString().split('T')[0]) // Only future matches
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
  console.log('RPC function not available, falling back to direct query. Error:', rpcError);

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
  const { error: bookingError } = await supabase
    .from('bookings')
    .insert({
      match_id: createdMatch.id,
      user_id: match.created_by,
    });

  if (bookingError) {
    console.error('Failed to auto-book creator:', bookingError);
    // Don't throw - match was created successfully
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
  return data as Match;
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
