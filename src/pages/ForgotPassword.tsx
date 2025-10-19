import { useState } from 'react';
import { Link } from 'react-router-dom';
import { resetPassword } from '@/lib/auth';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await resetPassword(email);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <img
            src="/apex-logo.svg"
            alt="Apex Padel Logo"
            className="w-48 h-48 mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Reset Password</h1>
          <p className="text-gray-600">
            Enter your email and we'll send you a link to reset your password
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg shadow-sm p-8 border border-gray-200">
          {success ? (
            <div className="text-center">
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
                <p className="font-medium mb-2">Check your email!</p>
                <p className="text-sm">
                  We've sent a password reset link to <strong>{email}</strong>
                </p>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                Click the link in the email to reset your password. The link will expire in 1 hour.
              </p>
              <Link
                to="/auth"
                className="inline-block w-full bg-primary hover:bg-primary-dark text-white py-3 rounded-lg font-medium transition text-center"
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Email Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="you@example.com"
                  disabled={loading}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-dark text-white py-3 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>

              {/* Back to Sign In */}
              <div className="text-center">
                <Link
                  to="/auth"
                  className="text-sm text-primary hover:text-primary-dark font-medium"
                >
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
