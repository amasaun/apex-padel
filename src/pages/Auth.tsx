import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { signUpWithEmail, signInWithEmail } from '@/lib/auth';
import { getRankingLevel, getRankingColor, validateRanking } from '@/lib/ranking';
import { validateInviteCode } from '@/lib/api';

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inviteCodeFromUrl, setInviteCodeFromUrl] = useState<string>('');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    ranking: '3.0',
    inviteCode: '',
  });

  useEffect(() => {
    const inviteParam = searchParams.get('invite');
    if (inviteParam) {
      setInviteCodeFromUrl(inviteParam);
      setFormData(prev => ({ ...prev, inviteCode: inviteParam }));
      setMode('signup'); // Auto-switch to signup mode
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        // Validate invite code (hidden from user)
        if (!formData.inviteCode) {
          setError('Please use a valid invite link from an Apex Padel admin to sign up.');
          setLoading(false);
          return;
        }

        const isValid = await validateInviteCode(formData.inviteCode);
        if (!isValid) {
          setError('Invalid or expired invite link. Please contact an Apex Padel admin for a new invite.');
          setLoading(false);
          return;
        }

        await signUpWithEmail(formData.email, formData.password, {
          name: formData.name,
          phone: formData.phone,
          ranking: formData.ranking,
          invited_by_code: formData.inviteCode,
        });
        setSuccess('Account created successfully!');
        setTimeout(() => navigate('/matches'), 1500);
      } else {
        await signInWithEmail(formData.email, formData.password);
        setSuccess('Signed in successfully!');
        setTimeout(() => navigate('/matches'), 1000);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <img
            src="/apex-logo.svg"
            alt="Apex Padel Logo"
            className="w-48 h-48 mx-auto mb-4"
          />
          <p className="text-gray-600 text-lg">
            {mode === 'signin' ? 'Sign in to your account' : 'Create your account'}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-8 border border-gray-200">
          {/* Mode Toggle */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                mode === 'signin'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                mode === 'signup'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name (signup only) */}
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="John Smith"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            {/* Phone (signup only) */}
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone (optional)
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="+1234567890"
                />
              </div>
            )}


            {/* Ranking (signup only) */}
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Initial Ranking (0.0 - 7.0)
                </label>
                <div className="flex gap-3 items-start">
                  <div className="flex-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="7"
                      value={formData.ranking}
                      onChange={(e) => setFormData({ ...formData, ranking: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="3.0"
                    />
                    {formData.ranking && !validateRanking(formData.ranking).valid && (
                      <p className="mt-1 text-xs text-red-600">
                        {validateRanking(formData.ranking).message}
                      </p>
                    )}
                  </div>
                  {formData.ranking && validateRanking(formData.ranking).valid && (
                    <div className="flex-1">
                      <div
                        className={`${getRankingColor(
                          formData.ranking
                        )} text-white px-4 py-2 rounded-lg text-center font-medium`}
                      >
                        {getRankingLevel(formData.ranking)}
                      </div>
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Enter your skill level (e.g., 3.5, 4.25, 5.0)
                </p>
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password *
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="••••••••"
              />
              {mode === 'signup' && (
                <p className="mt-1 text-xs text-gray-500">Minimum 6 characters</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-dark text-white py-3 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        {mode === 'signup' && !inviteCodeFromUrl && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Need an invite link?</strong> Contact an Apex Padel admin to get access to the community.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
