import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getRankingColor, getRankingLabel, formatRanking } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { User } from '@/types';
import UserAvatar from '@/components/UserAvatar';

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

  // Fetch playing partners (people booked in the same matches)
  const { data: playingPartners } = useQuery({
    queryKey: ['playing-partners', id],
    queryFn: async () => {
      // Get all bookings for this user
      const { data: userBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('match_id')
        .eq('user_id', id);

      if (bookingsError) throw bookingsError;
      if (!userBookings?.length) return [];

      const matchIds = userBookings.map(b => b.match_id);

      // Get all other bookings in those matches (excluding the user themselves)
      const { data: otherBookings, error: othersError } = await supabase
        .from('bookings')
        .select('user_id, users(*)')
        .in('match_id', matchIds)
        .neq('user_id', id);

      if (othersError) throw othersError;

      // Count frequency of each playing partner
      const partnerCounts = new Map<string, { user: User; count: number }>();

      otherBookings?.forEach((booking: any) => {
        const partnerId = booking.user_id;
        if (partnerCounts.has(partnerId)) {
          partnerCounts.get(partnerId)!.count++;
        } else {
          partnerCounts.set(partnerId, { user: booking.users, count: 1 });
        }
      });

      // Convert to array and sort by count (highest to lowest)
      return Array.from(partnerCounts.values())
        .sort((a, b) => b.count - a.count);
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
          <UserAvatar
            name={user.name}
            photoUrl={user.photo_url}
            size="xl"
            className="border-4 border-primary shadow-lg"
          />
          <div className="text-center md:text-left flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-3">{user.name}</h1>

            <div className="mb-3">
              <div className={`inline-flex items-center gap-3 ${getRankingColor(user.ranking || '0')} text-white px-6 py-3 rounded-lg shadow-md`}>
                <div className="text-left">
                  <div className="text-xs font-medium opacity-90">Padel Ranking</div>
                  <div className="text-2xl font-bold">{formatRanking(user.ranking)}</div>
                </div>
                <div className="h-12 w-px bg-white opacity-30"></div>
                <div className="text-left">
                  <div className="text-xs font-medium opacity-90">Level</div>
                  <div className="text-lg font-semibold">{getRankingLabel(user.ranking || '0')}</div>
                </div>
              </div>
            </div>
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
              {user.share_contact_info ? (
                <div className="space-y-1">
                  {user.email && (
                    <div className="text-sm font-medium text-gray-900">
                      📧 {user.email}
                    </div>
                  )}
                  {user.phone && (
                    <div className="text-sm font-medium text-gray-900">
                      📱 {user.phone}
                    </div>
                  )}
                  {!user.email && !user.phone && (
                    <div className="text-sm font-medium text-gray-900">
                      Not provided
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm font-medium text-gray-900">
                  Private
                </div>
              )}
            </div>
          </div>
        </div>

        {playingPartners && playingPartners.length > 0 && (
          <div className="border-t border-gray-200 pt-6 mt-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Played With</h2>
            <div className="flex flex-wrap gap-4 justify-center">
              {playingPartners.map(({ user: partner, count }) => (
                <Link
                  key={partner.id}
                  to={`/profile/${partner.id}`}
                  className="flex flex-col items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
                >
                  <div className="relative">
                    <UserAvatar
                      name={partner.name}
                      photoUrl={partner.photo_url}
                      size="lg"
                    />
                    <div className="absolute -top-1 -right-1 bg-primary text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-md">
                      {count}
                    </div>
                    <div
                      className={`absolute -bottom-1 -right-1 ${getRankingColor(
                        partner.ranking || '0'
                      )} text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[26px] h-5 flex items-center justify-center border-2 border-white shadow-sm`}
                    >
                      {formatRanking(partner.ranking)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-900 truncate max-w-[90px]">
                      {partner.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {count} {count === 1 ? 'match' : 'matches'}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 text-sm">
            💡 Match history and detailed stats coming soon!
          </p>
        </div>
      </div>
    </div>
  );
}
