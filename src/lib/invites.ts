import { supabase } from './supabase';

export interface Invite {
  id: string;
  code: string;
  email?: string;
  phone?: string;
  created_by?: string;
  used_by?: string;
  used_at?: string;
  expires_at?: string;
  max_uses: number;
  current_uses: number;
  created_at: string;
  notes?: string;
}

// ============================================
// INVITE MANAGEMENT
// ============================================

/**
 * Generate a new invite code
 */
export async function generateInviteCode(): Promise<string> {
  const { data, error } = await supabase.rpc('generate_invite_code');
  if (error) throw error;
  return data as string;
}

/**
 * Create a new invite
 */
export async function createInvite(options: {
  email?: string;
  phone?: string;
  expiresInDays?: number;
  maxUses?: number;
  notes?: string;
}): Promise<Invite> {
  const code = await generateInviteCode();

  const expiresAt = options.expiresInDays
    ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { data: currentUser } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('invites')
    .insert({
      code,
      email: options.email,
      phone: options.phone,
      created_by: currentUser?.user?.id,
      expires_at: expiresAt,
      max_uses: options.maxUses || 1,
      notes: options.notes,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Invite;
}

/**
 * Validate an invite code (check if it's valid without using it)
 */
export async function validateInviteCode(
  code: string,
  email?: string,
  phone?: string
): Promise<{ valid: boolean; message?: string; invite?: Invite }> {
  const { data: invites, error } = await supabase
    .from('invites')
    .select('*')
    .eq('code', code.toUpperCase())
    .single();

  if (error || !invites) {
    return { valid: false, message: 'Invalid invite code' };
  }

  const invite = invites as Invite;

  // Check if expired
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return { valid: false, message: 'Invite code has expired' };
  }

  // Check if all uses are consumed
  if (invite.current_uses >= invite.max_uses) {
    return { valid: false, message: 'Invite code has been fully used' };
  }

  // Check email restriction
  if (invite.email && email && invite.email !== email) {
    return { valid: false, message: 'This invite is for a different email address' };
  }

  // Check phone restriction
  if (invite.phone && phone && invite.phone !== phone) {
    return { valid: false, message: 'This invite is for a different phone number' };
  }

  return { valid: true, invite };
}

/**
 * Use an invite code (call this during signup)
 */
export async function useInviteCode(
  code: string,
  email?: string,
  phone?: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('use_invite_code', {
    invite_code: code.toUpperCase(),
    user_email: email,
    user_phone: phone,
  });

  if (error) throw error;
  return data as boolean;
}

/**
 * Get all invites created by current user
 */
export async function getMyInvites(): Promise<Invite[]> {
  const { data: currentUser } = await supabase.auth.getUser();
  if (!currentUser?.user?.id) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .eq('created_by', currentUser.user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Invite[];
}

/**
 * Get all active (unused/not expired) invites
 */
export async function getActiveInvites(): Promise<Invite[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .lt('current_uses', supabase.from('invites').select('max_uses'))
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Invite[];
}

/**
 * Revoke an invite (delete it)
 */
export async function revokeInvite(inviteId: string): Promise<void> {
  const { error } = await supabase
    .from('invites')
    .delete()
    .eq('id', inviteId);

  if (error) throw error;
}
