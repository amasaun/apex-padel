import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getRankingColor, getRankingLabel } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { User } from '@/types';

export default function Profile() {
  const { id } = useParams<{ id: string }>();

  // Fetch user from Supabase
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as User;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-center text-gray-500">Loading profile...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-gray-500">User not found</p>
        <Link to="/matches" className="text-primary hover:underline mt-4 inline-block">
          ← Back to matches
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to="/matches" className="text-primary hover:underline mb-6 inline-block">
        ← Back to matches
      </Link>

      <div className="bg-white rounded-lg shadow-sm p-8 border border-gray-200">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-8">
          <img
            src={user.photo_url}
            alt={user.name}
            className="w-32 h-32 rounded-full border-4 border-primary shadow-lg"
          />
          <div className="text-center md:text-left flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-3">{user.name}</h1>

            <div className="mb-3">
              <div className={`inline-flex items-center gap-3 ${getRankingColor(user.ranking || '0')} text-white px-6 py-3 rounded-lg shadow-md`}>
                <div className="text-left">
                  <div className="text-xs font-medium opacity-90">Padel Ranking</div>
                  <div className="text-2xl font-bold">{user.ranking}</div>
                </div>
                <div className="h-12 w-px bg-white opacity-30"></div>
                <div className="text-left">
                  <div className="text-xs font-medium opacity-90">Level</div>
                  <div className="text-lg font-semibold">{getRankingLabel(user.ranking || '0')}</div>
                </div>
              </div>
            </div>

            {user.email && (
              <div className="text-gray-600">
                <span className="text-sm">📧 {user.email}</span>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Stats</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Member Since</div>
              <div className="text-2xl font-bold text-gray-900">
                {new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Contact</div>
              <div className="text-sm font-medium text-gray-900">
                {user.email || user.phone || 'Not provided'}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 text-sm">
            💡 Match history and detailed stats coming soon!
          </p>
        </div>
      </div>
    </div>
  );
}
