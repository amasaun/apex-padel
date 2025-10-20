import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { updatePassword } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validToken, setValidToken] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if we have a valid recovery session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      console.log('Reset Password - Session check:', session);

      // Check if we have a session (recovery sessions are still valid sessions)
      if (session) {
        // We have a valid session, allow password reset
        setValidToken(true);
      } else {
        // No session means the link expired or is invalid
        setValidToken(false);
        setError('Invalid or expired reset link. Please request a new one.');
      }
    };

    checkSession();

    // Also listen for auth state changes in case the session is set after component mounts
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      console.log('Reset Password - Auth event:', event);
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setValidToken(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password length
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await updatePassword(password);

      // Show success and redirect
      setTimeout(() => {
        navigate('/matches');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
      setLoading(false);
    }
  };

  // Show loading state while checking token
  if (validToken === null) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  // Show error if token is invalid
  if (validToken === false) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <img
              src="/apex-logo.svg"
              alt="Apex Padel Logo"
              className="w-48 h-48 mx-auto mb-4"
            />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Reset Link</h1>
          </div>

          <div className="bg-gray-50 rounded-lg shadow-sm p-8 border border-gray-200">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-6">
              <p className="font-medium mb-2">Link Expired or Invalid</p>
              <p className="text-sm">
                This password reset link has expired or is invalid. Please request a new one.
              </p>
            </div>

            <button
              onClick={() => navigate('/forgot-password')}
              className="w-full bg-primary hover:bg-primary-dark text-white py-3 rounded-lg font-medium transition"
            >
              Request New Reset Link
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <img
            src="/apex-logo.svg"
            alt="Apex Padel Logo"
            className="w-48 h-48 mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Set New Password</h1>
          <p className="text-gray-600">
            Enter your new password below
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg shadow-sm p-8 border border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Success Message */}
            {loading && !error && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                Password updated successfully! Redirecting...
              </div>
            )}

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="••••••••"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500">Minimum 6 characters</p>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-dark text-white py-3 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
