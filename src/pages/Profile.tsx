import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getRankingColor, getRankingLabel, formatRanking } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { User } from '@/types';
import UserAvatar from '@/components/UserAvatar';
import { getCurrentUserProfile } from '@/lib/auth';

export default function Profile() {
  const { id } = useParams<{ id: string }>();

  // Get current user to check if authenticated
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUserProfile,
  });

  const isAuthenticated = !!currentUser;

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

  // Fetch playing partners (people booked in the same matches) - only if authenticated
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
    enabled: !!id && isAuthenticated,
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

        {isAuthenticated && (
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
        )}

        {(user.venmo_username || user.zelle_handle) && (
          <div className="border-t border-gray-200 pt-6 mt-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Options</h2>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-700 mb-3 font-medium">Pay {user.name}:</p>
              <div className="flex flex-col sm:flex-row gap-3">
                {user.venmo_username && (
                  <button
                    onClick={() => {
                      // Clean username - remove @ prefix if present
                      const cleanUsername = user.venmo_username!.replace(/^@/, '');
                      const note = 'Padel';

                      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

                      if (isMobile) {
                        // Use correct deep link format for Venmo app
                        // venmo://paycharge opens payment screen, txn=pay is for sending money
                        // No amount parameter - user will fill in the amount
                        const venmoUrl = `venmo://paycharge?txn=pay&recipients=${cleanUsername}&note=${encodeURIComponent(note)}`;

                        // Try to open Venmo app
                        window.location.href = venmoUrl;

                        // Fallback to web version if app doesn't open within 2 seconds
                        setTimeout(() => {
                          const venmoWebUrl = `https://venmo.com/${cleanUsername}?txn=pay&note=${encodeURIComponent(note)}`;
                          window.open(venmoWebUrl, '_blank');
                        }, 2000);
                      } else {
                        // Use web URL on desktop - no amount, user enters it
                        const venmoWebUrl = `https://venmo.com/${cleanUsername}?txn=pay&note=${encodeURIComponent(note)}`;
                        window.open(venmoWebUrl, '_blank');
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-3 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition shadow-sm"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19.83 4.18c.84 1.3 1.17 2.58 1.17 4.16 0 5.2-4.42 11.96-8.03 16.66H7.5L4.16 4.66h5.7l1.76 10.9c1.46-2.4 3.24-5.87 3.24-8.49 0-1.4-.27-2.37-.71-3.06l5.68-1.83z"/>
                    </svg>
                    Pay with Venmo
                  </button>
                )}
                {user.zelle_handle && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(user.zelle_handle!).then(() => {
                        alert(`Zelle handle copied: ${user.zelle_handle}`);
                      });
                    }}
                    className="flex-1 flex items-center justify-center gap-3 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition shadow-sm"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy Zelle Info
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {isAuthenticated && playingPartners && playingPartners.length > 0 && (
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

        {isAuthenticated && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              💡 Match history and detailed stats coming soon!
            </p>
          </div>
        )}

        {!isAuthenticated && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              <Link to="/signup" className="font-medium underline">Sign up</Link> or <Link to="/login" className="font-medium underline">log in</Link> to see more details and match history.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
