import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { getCurrentUserProfile } from '@/lib/auth';
import { updateUser } from '@/lib/api';
import { User } from '@/types';
import { getRankingLevel, getRankingColor, validateRanking } from '@/lib/ranking';

export default function EditProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    ranking: '',
    photo_url: '',
  });

  useEffect(() => {
    loadProfile();
  }, [id]);

  const loadProfile = async () => {
    try {
      const profile = await getCurrentUserProfile();

      if (!profile) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      if (profile.id !== id) {
        setError('You can only edit your own profile');
        setLoading(false);
        return;
      }

      setUser(profile);
      setFormData({
        name: profile.name,
        phone: profile.phone || '',
        ranking: profile.ranking || '3.0',
        photo_url: profile.photo_url || '',
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    const rankingValidation = validateRanking(formData.ranking);
    if (!rankingValidation.valid) {
      setError(rankingValidation.message || 'Invalid ranking');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateUser(user.id, {
        name: formData.name,
        phone: formData.phone || undefined,
        ranking: formData.ranking,
        photo_url: formData.photo_url || undefined,
      });

      navigate(`/profile/${user.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="text-center text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
        <Link to="/matches" className="text-primary hover:underline">
          ← Back to matches
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link to={`/profile/${id}`} className="text-primary hover:underline mb-6 inline-block">
        ← Back to profile
      </Link>

      <div className="bg-white rounded-lg shadow-sm p-8 border border-gray-200">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Edit Profile</h1>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Photo URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Profile Photo URL (optional)
            </label>
            <input
              type="url"
              value={formData.photo_url}
              onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="https://example.com/photo.jpg"
            />
            {formData.photo_url && (
              <div className="mt-3">
                <p className="text-sm text-gray-600 mb-2">Preview:</p>
                <img
                  src={formData.photo_url}
                  alt="Preview"
                  className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name)}&background=random`;
                  }}
                />
              </div>
            )}
          </div>

          {/* Name */}
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
            />
          </div>

          {/* Phone */}
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

          {/* Ranking */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ranking (0.0 - 7.0)
            </label>
            <div className="flex gap-3 items-start">
              <div className="flex-1">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="7"
                  required
                  value={formData.ranking}
                  onChange={(e) => setFormData({ ...formData, ranking: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
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

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <Link
              to={`/profile/${id}`}
              className="flex-1 text-center bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-lg font-medium transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-primary hover:bg-primary-dark text-white py-3 rounded-lg font-medium transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
