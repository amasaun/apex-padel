import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getMatchById, deleteMatch, createBooking, deleteBookingByUserAndMatch } from '@/lib/api';
import { getCurrentUserProfile } from '@/lib/auth';
import { getRankingColor, formatTime, calculateEndTime, formatDuration } from '@/lib/utils';
import { LOCATION_DATA } from '@/lib/locations';
import { sendBookingConfirmationEmail, sendCancellationEmail } from '@/lib/email';
import EditMatchModal from '@/components/EditMatchModal';
import UserAvatar from '@/components/UserAvatar';

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showBookingConfirmation, setShowBookingConfirmation] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Fetch match data
  const { data: match, isLoading, error, refetch } = useQuery({
    queryKey: ['match', id],
    queryFn: () => getMatchById(id!),
    enabled: !!id,
  });

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUserProfile,
  });

  const isCreator = match?.created_by === currentUser?.id;

  // Handle bookings - might be JSONB string or array
  const bookings = match?.bookings ? (
    typeof match.bookings === 'string' ? JSON.parse(match.bookings) : match.bookings
  ) : [];

  const isBooked = currentUser && bookings.some((booking: any) => booking.user_id === currentUser?.id);

  const [showCalendarMenu, setShowCalendarMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const getShareUrl = () => window.location.href;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getShareUrl()).then(() => {
      alert('Link copied to clipboard!');
      setShowShareMenu(false);
    });
  };

  const handleShareEmail = () => {
    if (!match) return;
    const subject = encodeURIComponent(`Join me for Padel - ${match.title || 'Match'}`);
    const body = encodeURIComponent(
      `I'm playing padel at ${match.location} on ${formatDate(match.date)} at ${formatTime(match.time)}.\n\n` +
      `Join me! Click here to book: ${getShareUrl()}\n\n` +
      `Match Details:\n` +
      `- Duration: ${formatDuration(match.duration)}\n` +
      `- Available Slots: ${match.available_slots}/${match.max_players}`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setShowShareMenu(false);
  };

  const handleShareWhatsApp = () => {
    if (!match) return;
    const text = encodeURIComponent(
      `🎾 Join me for Padel!\n\n` +
      `📍 ${match.location}\n` +
      `📅 ${formatDate(match.date)}\n` +
      `⏰ ${formatTime(match.time)}\n` +
      `⏱️ ${formatDuration(match.duration)}\n` +
      `👥 ${match.available_slots} slots available\n\n` +
      `Book here: ${getShareUrl()}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
    setShowShareMenu(false);
  };

  const getGoogleCalendarUrl = () => {
    if (!match) return '';
    const startDateTime = new Date(`${match.date}T${match.time}`);
    const endDateTime = new Date(startDateTime.getTime() + match.duration * 60000);

    const formatGoogleDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `${match.title || 'Padel Match'} - ${match.location}`,
      dates: `${formatGoogleDate(startDateTime)}/${formatGoogleDate(endDateTime)}`,
      details: `Padel match at ${match.location}\nPlayers: ${match.bookings.length}/${match.max_players}\nDuration: ${formatDuration(match.duration)}`,
      location: match.location,
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const downloadICS = () => {
    if (!match) return;

    const startDateTime = new Date(`${match.date}T${match.time}`);
    const endDateTime = new Date(startDateTime.getTime() + match.duration * 60000);

    const formatDateTime = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `DTSTART:${formatDateTime(startDateTime)}`,
      `DTEND:${formatDateTime(endDateTime)}`,
      `SUMMARY:${match.title || 'Padel Match'} - ${match.location}`,
      `DESCRIPTION:Padel match at ${match.location}\\nPlayers: ${match.bookings.length}/${match.max_players}\\nDuration: ${formatDuration(match.duration)}`,
      `LOCATION:${match.location}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `padel-match-${match.date}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowCalendarMenu(false);
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-center text-gray-500">Loading match...</p>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-gray-500">Match not found</p>
        <Link to="/matches" className="text-primary hover:underline mt-4 inline-block">
          ← Back to matches
        </Link>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  const handleBookSlot = async () => {
    if (!currentUser || !match) return;

    try {
      const isUnbooking = isBooked;

      if (isUnbooking) {
        // Unbook the slot
        await deleteBookingByUserAndMatch(match.id, currentUser.id);

        // TODO: Send cancellation email when enabled
        // await sendCancellationEmail({...});
      } else {
        // Book the slot
        await createBooking(match.id, currentUser.id);

        // TODO: Send booking confirmation email when enabled
        // await sendBookingConfirmationEmail({...});
      }

      // Refresh match data
      await refetch();
      setShowBookingConfirmation(true);
      setTimeout(() => setShowBookingConfirmation(false), 3000);
    } catch (error: any) {
      alert(error.message || 'Failed to update booking');
    }
  };

  const handleCancelMatch = async () => {
    if (confirm('Are you sure you want to cancel this match? This action cannot be undone.')) {
      try {
        await deleteMatch(id!);
        navigate('/matches');
      } catch (err: any) {
        alert('Failed to delete match: ' + err.message);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to="/matches" className="text-primary hover:underline mb-6 inline-block">
        ← Back to matches
      </Link>

      {showBookingConfirmation && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-800">
            ✓ {isBooked ? 'Booking confirmed!' : 'Booking cancelled!'}
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-8 border border-gray-200">
        <div className="mb-6">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {match.title || 'Match Details'}
              </h1>
              {match.is_private && (
                <span className="inline-block mt-2 px-3 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-full">
                  🔒 Private Match
                </span>
              )}
            </div>
            {/* Desktop buttons */}
            <div className="hidden md:flex gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowShareMenu(!showShareMenu)}
                  className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg font-medium transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share
                </button>

                {showShareMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowShareMenu(false)}
                    />
                    <div className="absolute left-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                      <button
                        onClick={handleCopyLink}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition w-full text-left"
                      >
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm font-medium text-gray-700">Copy Link</span>
                      </button>
                      <button
                        onClick={handleShareWhatsApp}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition w-full text-left"
                      >
                        <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        <span className="text-sm font-medium text-gray-700">WhatsApp</span>
                      </button>
                      <button
                        onClick={handleShareEmail}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition w-full text-left"
                      >
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm font-medium text-gray-700">Email</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {isCreator && (
                <>
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition"
                  >
                    Edit Match
                  </button>
                  <button
                    onClick={handleCancelMatch}
                    className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition"
                  >
                    Cancel Match
                  </button>
                </>
              )}
            </div>

            {/* Mobile hamburger menu */}
            <div className="md:hidden relative">
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
                aria-label="Menu"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {showMobileMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMobileMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                      Share
                    </div>
                    <button
                      onClick={() => {
                        handleCopyLink();
                        setShowMobileMenu(false);
                      }}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition w-full text-left"
                    >
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-700">Copy Link</span>
                    </button>
                    <button
                      onClick={() => {
                        handleShareWhatsApp();
                        setShowMobileMenu(false);
                      }}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition w-full text-left"
                    >
                      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      <span className="text-sm font-medium text-gray-700">WhatsApp</span>
                    </button>
                    <button
                      onClick={() => {
                        handleShareEmail();
                        setShowMobileMenu(false);
                      }}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition w-full text-left"
                    >
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-700">Email</span>
                    </button>

                    {isBooked && (
                      <>
                        <div className="my-1 border-t border-gray-200"></div>
                        <button
                          onClick={() => {
                            setShowCalendarMenu(!showCalendarMenu);
                            setShowMobileMenu(false);
                          }}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition w-full text-left"
                        >
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-sm font-medium text-gray-700">Add to Calendar</span>
                        </button>
                      </>
                    )}

                    {isCreator && (
                      <>
                        <div className="my-1 border-t border-gray-200"></div>
                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Manage
                        </div>
                        <button
                          onClick={() => {
                            setIsEditModalOpen(true);
                            setShowMobileMenu(false);
                          }}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition w-full text-left"
                        >
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span className="text-sm font-medium text-gray-700">Edit Match</span>
                        </button>
                        <button
                          onClick={() => {
                            handleCancelMatch();
                            setShowMobileMenu(false);
                          }}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition w-full text-left"
                        >
                          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span className="text-sm font-medium text-red-700">Cancel Match</span>
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="text-gray-600 mb-1">
            {formatDate(match.date)}
          </div>
          <div className="text-lg font-semibold text-gray-800 mb-3">
            {formatTime(match.time)} - {formatTime(calculateEndTime(match.time, match.duration))}
            <span className="text-sm font-normal text-gray-500 ml-2">({formatDuration(match.duration)})</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center p-1 shadow-sm ${
                match.location.includes('The Padel Courts')
                  ? 'bg-gray-800 border-2 border-gray-700'
                  : 'bg-white border-2 border-gray-200'
              }`}>
                <img
                  src={LOCATION_DATA[match.location]?.logo}
                  alt={match.location}
                  className="w-full h-full object-contain"
                />
              </div>
              {/* Instant tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-100 pointer-events-none z-10">
                <div className="bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
                  {match.location}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                    <div className="border-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
            </div>
            <span className="font-medium text-gray-800">{match.location}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Total Slots</div>
            <div className="text-2xl font-bold text-gray-900">{match.max_players}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Available Slots</div>
            <div className="text-2xl font-bold text-primary">{match.available_slots}</div>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Players ({match.bookings.length}/{match.max_players})
          </h2>
          <div className="space-y-3">
            {match.bookings.map((booking) => (
              <Link
                key={booking.id}
                to={`/profile/${booking.user.id}`}
                className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
              >
                <div className="relative group">
                  <UserAvatar
                    name={booking.user.name}
                    photoUrl={booking.user.photo_url}
                    size="lg"
                  />
                  <div
                    className={`absolute -bottom-1 -right-1 ${getRankingColor(
                      booking.user.ranking || '0'
                    )} text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[26px] h-5 flex items-center justify-center border-2 border-white shadow-sm`}
                  >
                    {booking.user.ranking}
                  </div>
                  {/* Instant tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-100 pointer-events-none z-10">
                    <div className="bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
                      {booking.user.name}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                        <div className="border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-gray-900">{booking.user.name}</div>
                    {booking.user.id === match.created_by && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full" title="Match Creator">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                          <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                        </svg>
                        Creator
                      </span>
                    )}
                  </div>
                  <div className={`text-sm ${getRankingColor(booking.user.ranking || '0')} bg-opacity-10 inline-block px-2 py-0.5 rounded`}>
                    Rank: {booking.user.ranking}
                  </div>
                </div>
              </Link>
            ))}
            {match.available_slots > 0 && (
              <div className="flex items-center gap-4 p-3 border-2 border-dashed border-gray-300 rounded-lg">
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-400 text-xl">?</span>
                </div>
                <div className="text-gray-500">
                  {match.available_slots} {match.available_slots === 1 ? 'slot' : 'slots'} available
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 items-center">
          {(match.available_slots > 0 || isBooked) && (
            <button
              onClick={handleBookSlot}
              className={`flex-1 py-3 rounded-lg font-medium transition ${
                isBooked
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-primary hover:bg-primary-dark text-white'
              }`}
            >
              {isBooked ? 'Give Up My Spot' : 'Book a Slot'}
            </button>
          )}

          {match.available_slots === 0 && !isBooked && (
            <div className="flex-1 text-center py-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-600 font-medium">This match is fully booked</p>
            </div>
          )}

          {isBooked && (
            <div className="relative hidden md:block">
              <button
                onClick={() => setShowCalendarMenu(!showCalendarMenu)}
                className="p-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg transition"
                title="Add to Calendar"
              >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>

            {showCalendarMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowCalendarMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                  <a
                    href={getGoogleCalendarUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition"
                    onClick={() => setShowCalendarMenu(false)}
                  >
                    <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/>
                    </svg>
                    <span className="text-sm font-medium text-gray-700">Google Calendar</span>
                  </a>
                  <button
                    onClick={downloadICS}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition w-full text-left"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span className="text-sm font-medium text-gray-700">Apple/Outlook (.ics)</span>
                  </button>
                </div>
              </>
            )}
            </div>
          )}
        </div>
      </div>

      {isCreator && (
        <EditMatchModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={() => refetch()}
          match={match}
        />
      )}
    </div>
  );
}
