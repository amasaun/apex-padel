import { supabase } from './supabase';
import { User } from '@/types';

export interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
}

// ============================================
// AUTHENTICATION
// ============================================

/**
 * Sign up with email and password
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  userData: { name: string; phone?: string; ranking?: string; gender?: string; invited_by_code?: string }
) {
  // First, sign up with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error('Signup failed');

  // Create user profile using database function (bypasses RLS)
  const { data: profileData, error: profileError } = await supabase.rpc(
    'handle_new_user_signup',
    {
      user_id: authData.user.id,
      user_email: email,
      user_name: userData.name,
      user_phone: userData.phone || null,
      user_ranking: userData.ranking || '3.0',
      user_gender: userData.gender || null,
      user_invited_by_code: userData.invited_by_code || null,
    }
  );

  if (profileError) throw profileError;

  return { user: authData.user, profile: profileData as User };
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

/**
 * Sign out
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get current session
 */
export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

/**
 * Get current user profile from users table
 */
export async function getCurrentUserProfile(): Promise<User | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) throw error;
  return data as User;
}

/**
 * Reset password
 */
export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) throw error;
}

/**
 * Update password
 */
export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) throw error;
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null);
  });

  return data.subscription;
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

/**
 * Check if current user is admin
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  return profile?.is_admin || false;
}

/**
 * Make a user an admin (only admins can do this)
 */
export async function makeUserAdmin(userId: string): Promise<void> {
  const { error } = await supabase.rpc('make_user_admin', {
    target_user_id: userId,
  });

  if (error) throw error;
}

/**
 * Remove admin status from a user (only admins can do this)
 */
export async function removeUserAdmin(userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_user_admin', {
    target_user_id: userId,
  });

  if (error) throw error;
}
