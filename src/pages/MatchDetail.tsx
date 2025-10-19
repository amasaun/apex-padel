import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMatchById, deleteMatch, createBooking, deleteBookingByUserAndMatch, getUserById, getPaymentByBookingId, createOrUpdatePayment, getPaymentsByMatchId, getGuestPaymentsByMatchId, createOrUpdateGuestPayment, checkTournamentGenderQuota } from '@/lib/api';
import { getCurrentUserProfile } from '@/lib/auth';
import { getRankingColor, formatTime, calculateEndTime, formatDuration, getRankingLabel, formatRanking } from '@/lib/utils';
import { LOCATION_DATA } from '@/lib/locations';
// import { sendCreatorBookingNotification, sendCreatorCancellationNotification } from '@/lib/email';
import { getPrimaryInviteCode } from '@/lib/invites';
import EditMatchModal from '@/components/EditMatchModal';
import UserAvatar from '@/components/UserAvatar';
import { Map, Marker } from 'pigeon-maps';

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

  // Get match creator
  const { data: matchCreator } = useQuery({
    queryKey: ['user', match?.created_by],
    queryFn: () => getUserById(match!.created_by),
    enabled: !!match?.created_by,
  });

  // Fetch primary invite code for sharing
  const { data: inviteCode } = useQuery({
    queryKey: ['primaryInviteCode'],
    queryFn: getPrimaryInviteCode,
  });

  const isAuthenticated = !!currentUser;
  const isCreator = match?.created_by === currentUser?.id;
  const isAdmin = currentUser?.is_admin || false;

  // Handle bookings - might be JSONB string or array
  const bookings = match?.bookings ? (
    typeof match.bookings === 'string' ? JSON.parse(match.bookings) : match.bookings
  ) : [];

  const isBooked = currentUser && bookings.some((booking: any) => booking.user_id === currentUser?.id);

  // Get current user's booking ID
  const currentUserBooking = bookings.find((booking: any) => booking.user_id === currentUser?.id);

  // Fetch payment info for current user's booking
  const { data: currentUserPayment } = useQuery({
    queryKey: ['payment', currentUserBooking?.id],
    queryFn: () => getPaymentByBookingId(currentUserBooking!.id),
    enabled: !!currentUserBooking?.id,
  });

  // Fetch all payment records for the match (for creator view)
  const { data: allPayments = [] } = useQuery({
    queryKey: ['payments', match?.id],
    queryFn: () => getPaymentsByMatchId(match!.id),
    enabled: !!match?.id && (match.total_cost || 0) > 0,
  });

  // Fetch all guest payment records for the match
  const { data: allGuestPayments = [] } = useQuery({
    queryKey: ['guestPayments', match?.id],
    queryFn: () => getGuestPaymentsByMatchId(match!.id),
    enabled: !!match?.id && (match.total_cost || 0) > 0,
  });

  // Calculate per-person cost if match has a total cost
  // Divide by max_players (available slots), not bookings length
  const perPersonCost = (match?.total_cost || 0) > 0 && match?.max_players
    ? match.total_cost! / match.max_players
    : null;

  // Debug logging for payment visibility
  console.log('Payment Debug:', {
    hasTotalCost: !!match?.total_cost,
    totalCost: match?.total_cost,
    perPersonCost,
    isCreator,
    isBooked,
    bookingsLength: bookings.length,
    currentUserId: currentUser?.id,
    creatorId: match?.created_by,
    currentUserPayment,
  });

  // Helper to check if a booking has been paid
  const isBookingPaid = (bookingId: string) => {
    return allPayments.some(p => p.booking_id === bookingId && p.marked_as_paid);
  };

  // Helper to check if a guest booking has been paid
  const isGuestBookingPaid = (guestBookingId: string) => {
    return allGuestPayments.some(p => p.guest_booking_id === guestBookingId && p.marked_as_paid);
  };

  const guestBookings = match?.guest_bookings || [];

  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const queryClient = useQueryClient();

  // Mutation for toggling payment status
  const togglePaymentMutation = useMutation({
    mutationFn: async (newPaidStatus: boolean) => {
      if (!currentUserBooking || !perPersonCost) throw new Error('Missing booking or cost info');
      return createOrUpdatePayment(currentUserBooking.id, perPersonCost, newPaidStatus);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment', currentUserBooking?.id] });
      queryClient.invalidateQueries({ queryKey: ['payments', match?.id] });
      queryClient.invalidateQueries({ queryKey: ['match', id] });
    },
  });

  const getShareUrl = () => window.location.href;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getShareUrl()).then(() => {
      alert('Link copied to clipboard!');
      setShowShareMenu(false);
    });
  };

  const getAbbreviatedRankingLabel = (level: string) => {
    const label = getRankingLabel(level);
    const abbreviations: { [key: string]: string } = {
      'Beginner': 'B',
      'High Beginner': 'HB',
      'Intermediate': 'I',
      'Advanced': 'A',
      'Pro': 'P',
    };
    return abbreviations[label] ? `${abbreviations[label]}+` : `${label}+`;
  };

  const handleShareEmail = () => {
    if (!match) return;
    const subject = encodeURIComponent(`Join me for Padel - ${match.title || 'Match'}`);

    let bodyText = `I'm playing padel at ${match.location} on ${formatDate(match.date)} at ${formatTime(match.time)}.\n\n`;
    bodyText += `Location: ${LOCATION_DATA[match.location]?.address || ''}\n\n`;
    bodyText += `Join me! Click here to book: ${getShareUrl()}\n\n`;
    bodyText += `Match Details:\n`;
    bodyText += `- Duration: ${formatDuration(match.duration)}\n`;
    bodyText += `- Available Slots: ${match.available_slots}/${match.max_players}\n`;

    if (match.required_level !== null && match.required_level !== undefined) {
      bodyText += `- Minimum Level: ${getRankingLabel(match.required_level.toString())} and above\n`;
    }

    if (match.gender_requirement && match.gender_requirement !== 'all') {
      bodyText += `- ${match.gender_requirement === 'male_only' ? 'Lads only' : 'Ladies only'}\n`;
    }

    if (inviteCode) {
      bodyText += `\n---\nNew to Apex Padel? Join here: ${window.location.origin}/auth?invite=${inviteCode}`;
    }

    const body = encodeURIComponent(bodyText);
    const mailtoLink = `mailto:?subject=${subject}&body=${body}`;
    window.location.href = mailtoLink;
    setShowShareMenu(false);
  };

  const handleShareWhatsApp = () => {
    if (!match) return;

    let matchInfo = `🎾 Join me for Padel!\n\n`;
    matchInfo += `📍 ${match.location}\n`;
    matchInfo += `${LOCATION_DATA[match.location]?.address || ''}\n\n`;
    matchInfo += `📅 ${formatDate(match.date)}\n`;
    matchInfo += `⏰ ${formatTime(match.time)}\n`;
    matchInfo += `⏱️ ${formatDuration(match.duration)}\n`;

    if (match.required_level !== null && match.required_level !== undefined) {
      matchInfo += `🎯 ${getRankingLabel(match.required_level.toString())} and above\n`;
    }

    if (match.gender_requirement && match.gender_requirement !== 'all') {
      matchInfo += `${match.gender_requirement === 'male_only' ? '♂' : '♀'} ${match.gender_requirement === 'male_only' ? 'Lads only' : 'Ladies only'}\n`;
    }

    matchInfo += `\n👥 ${match.available_slots} slots available\n\n`;
    matchInfo += `Book here: ${getShareUrl()}`;

    if (inviteCode) {
      matchInfo += `\n\n🔑 New to Apex Padel? Join here:\n${window.location.origin}/auth?invite=${inviteCode}`;
    }

    const text = encodeURIComponent(matchInfo);
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

    let details = `Padel match at ${match.location}\n`;
    details += `Address: ${LOCATION_DATA[match.location]?.address || ''}\n\n`;
    details += `Players: ${match.bookings.length}/${match.max_players}\n`;
    details += `Duration: ${formatDuration(match.duration)}\n`;

    if (match.required_level !== null && match.required_level !== undefined) {
      details += `Minimum Level: ${getRankingLabel(match.required_level.toString())} and above\n`;
    }

    if (match.gender_requirement && match.gender_requirement !== 'all') {
      details += `${match.gender_requirement === 'male_only' ? 'Lads only' : 'Ladies only'}\n`;
    }

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `${match.title || 'Padel Match'} - ${match.location}`,
      dates: `${formatGoogleDate(startDateTime)}/${formatGoogleDate(endDateTime)}`,
      details: details,
      location: LOCATION_DATA[match.location]?.address || match.location,
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const handlePayVenmo = () => {
    if (!matchCreator?.venmo_username || !perPersonCost) return;

    const matchInfo = `${match?.title || 'Padel Match'} on ${formatDate(match!.date)}`;
    const amount = perPersonCost.toFixed(2);

    // Check if on mobile device
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
      // Use deep link on mobile (opens Venmo app)
      const venmoUrl = `venmo://pay?txn=charge&recipients=${matchCreator.venmo_username}&amount=${amount}&note=${encodeURIComponent(matchInfo)}`;
      window.location.href = venmoUrl;
    } else {
      // Use web URL on desktop
      const venmoWebUrl = `https://venmo.com/${matchCreator.venmo_username}?txn=charge&amount=${amount}&note=${encodeURIComponent(matchInfo)}`;
      window.open(venmoWebUrl, '_blank');
    }
  };

  const handleCopyZelle = () => {
    if (!matchCreator?.zelle_handle) return;

    navigator.clipboard.writeText(matchCreator.zelle_handle).then(() => {
      alert(`Zelle handle copied: ${matchCreator.zelle_handle}`);
    });
  };

  const handleTogglePayment = async () => {
    try {
      const newStatus = !currentUserPayment?.marked_as_paid;
      await togglePaymentMutation.mutateAsync(newStatus);
      if (newStatus) {
        alert('Payment marked as sent! The match creator will verify.');
      } else {
        alert('Payment status cleared. You can mark it again when you pay.');
      }
    } catch (error: any) {
      alert(error.message || 'Failed to update payment status');
    }
  };

  const downloadICS = () => {
    if (!match) return;

    const startDateTime = new Date(`${match.date}T${match.time}`);
    const endDateTime = new Date(startDateTime.getTime() + match.duration * 60000);

    const formatDateTime = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    let description = `Padel match at ${match.location}\\n`;
    description += `Address: ${LOCATION_DATA[match.location]?.address || ''}\\n\\n`;
    description += `Players: ${match.bookings.length}/${match.max_players}\\n`;
    description += `Duration: ${formatDuration(match.duration)}\\n`;

    if (match.required_level !== null && match.required_level !== undefined) {
      description += `Minimum Level: ${getRankingLabel(match.required_level.toString())} and above\\n`;
    }

    if (match.gender_requirement && match.gender_requirement !== 'all') {
      description += `${match.gender_requirement === 'male_only' ? 'Lads only' : 'Ladies only'}\\n`;
    }

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `DTSTART:${formatDateTime(startDateTime)}`,
      `DTEND:${formatDateTime(endDateTime)}`,
      `SUMMARY:${match.title || 'Padel Match'} - ${match.location}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${LOCATION_DATA[match.location]?.address || match.location}`,
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
    // Parse date as local time to avoid timezone issues
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  const getMatchStatus = (dateStr: string, timeStr: string, duration: number) => {
    const now = new Date();
    const matchStartTime = new Date(`${dateStr}T${timeStr}`);
    const matchEndTime = new Date(matchStartTime.getTime() + (duration * 60 * 1000));

    if (now < matchStartTime) {
      // Match hasn't started yet - upcoming
      return 'upcoming';
    } else if (now >= matchStartTime && now < matchEndTime) {
      // Match has started but hasn't ended - in progress (no bookings allowed)
      return 'in-progress';
    } else {
      // now >= matchEndTime - Match has ended - completed (no bookings allowed)
      return 'completed';
    }
  };

  const isMatchStartingSoon = (dateStr: string, timeStr: string) => {
    const now = new Date();
    const matchStartTime = new Date(`${dateStr}T${timeStr}`);
    const minutesUntilStart = (matchStartTime.getTime() - now.getTime()) / (1000 * 60);
    return minutesUntilStart > 0 && minutesUntilStart <= 90;
  };

  const matchStatus = match ? getMatchStatus(match.date, match.time, match.duration) : 'upcoming';

  const handleBookSlot = async () => {
    if (!currentUser || !match) return;

    try {
      const isUnbooking = isBooked;
      const userIsCreator = match.created_by === currentUser.id;

      if (isUnbooking) {
        // Unbook the slot
        await deleteBookingByUserAndMatch(match.id, currentUser.id);

        // Notify creator if someone else cancelled
        // TODO: Implement server-side email via Supabase Edge Function
        // if (!userIsCreator && matchCreator?.email) {
        //   const updatedMatch = await refetch();
        //   const newAvailableSlots = updatedMatch.data?.available_slots || 0;
        //   await sendCreatorCancellationNotification({
        //     creatorEmail: matchCreator.email,
        //     creatorName: matchCreator.name,
        //     playerName: currentUser.name,
        //     matchTitle: match.title || 'Padel Match',
        //     matchDate: new Date(match.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
        //     matchTime: formatTime(match.time),
        //     location: match.location,
        //     availableSlots: newAvailableSlots,
        //     maxPlayers: match.max_players,
        //   });
        // }
      } else {
        // Check if user meets the level requirement (unless they're the creator)
        if (!userIsCreator && match.required_level !== null && match.required_level !== undefined) {
          const userRanking = parseFloat(currentUser.ranking || '0');
          if (userRanking < match.required_level) {
            alert(`This match requires a minimum ranking of ${formatRanking(match.required_level)} or above. Your current ranking is ${formatRanking(currentUser.ranking)}.`);
            return;
          }
        }

        // Check if user meets the gender requirement (unless they're the creator)
        if (!userIsCreator && match.gender_requirement && match.gender_requirement !== 'all') {
          const userGender = currentUser.gender;
          if (match.gender_requirement === 'male_only' && userGender !== 'male') {
            alert('This match is for male players only.');
            return;
          }
          if (match.gender_requirement === 'female_only' && userGender !== 'female') {
            alert('This match is for female players only.');
            return;
          }
        }

        // Check tournament gender quota (unless they're the creator)
        if (!userIsCreator && match.is_tournament) {
          const quotaCheck = await checkTournamentGenderQuota(match, currentUser.gender);
          if (!quotaCheck.canBook) {
            alert(quotaCheck.reason || 'Cannot book this tournament slot.');
            return;
          }
        }

        // Book the slot
        await createBooking(match.id, currentUser.id);

        // Notify creator if someone else joined
        // TODO: Implement server-side email via Supabase Edge Function
        // if (!userIsCreator && matchCreator?.email) {
        //   const updatedMatch = await refetch();
        //   const newAvailableSlots = updatedMatch.data?.available_slots || 0;
        //   await sendCreatorBookingNotification({
        //     creatorEmail: matchCreator.email,
        //     creatorName: matchCreator.name,
        //     playerName: currentUser.name,
        //     matchTitle: match.title || 'Padel Match',
        //     matchDate: new Date(match.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
        //     matchTime: formatTime(match.time),
        //     location: match.location,
        //     availableSlots: newAvailableSlots,
        //     maxPlayers: match.max_players,
        //   });
        // }
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
      {isAuthenticated && (
        <Link to="/matches" className="text-primary hover:underline mb-6 inline-block">
          ← Back to matches
        </Link>
      )}

      {/* Unauthenticated User Banner */}
      {!isAuthenticated && (
        <div className="mb-6 p-6 bg-gradient-to-r from-primary to-primary-dark text-white rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-2">Join Apex Padel!</h2>
          <p className="mb-4">Sign up to book matches and join our community.</p>
          <Link
            to={inviteCode ? `/auth?invite=${inviteCode}` : '/auth'}
            className="inline-block bg-white text-primary px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition"
          >
            Sign Up / Sign In
          </Link>
        </div>
      )}

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
              <div className="flex items-center gap-2 mt-2">
                {match && isMatchStartingSoon(match.date, match.time) && matchStatus !== 'in-progress' && matchStatus !== 'completed' && (
                  <span className="inline-block px-3 py-1 bg-orange-100 text-orange-700 text-sm font-bold rounded-full animate-pulse border border-orange-300">
                    ⏰ Starting Soon
                  </span>
                )}
                {matchStatus === 'in-progress' && (
                  <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-700 text-sm font-medium rounded-full">
                    🔴 In Progress
                  </span>
                )}
                {matchStatus === 'completed' && (
                  <span className="inline-block px-3 py-1 bg-gray-200 text-gray-600 text-sm font-medium rounded-full">
                    ✓ Completed
                  </span>
                )}
                {match.is_private && (
                  <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-full">
                    🔒<span className="hidden sm:inline"> Private Match</span>
                  </span>
                )}
                {match.required_level !== null && match.required_level !== undefined && (
                  <span className={`inline-block px-3 py-1 ${getRankingColor(match.required_level.toString())} text-white text-sm font-medium rounded-full`}>
                    <span className="sm:hidden">{getAbbreviatedRankingLabel(match.required_level.toString())}</span>
                    <span className="hidden sm:inline">{getRankingLabel(match.required_level.toString())} and above</span>
                  </span>
                )}
                {match.gender_requirement && match.gender_requirement !== 'all' && (
                  <span className={`inline-flex items-center gap-1 px-3 py-1 text-white text-sm font-medium rounded-full ${match.gender_requirement === 'male_only' ? 'bg-blue-500' : 'bg-pink-500'}`}>
                    <span>{match.gender_requirement === 'male_only' ? '♂' : '♀'}</span>
                    <span>{match.gender_requirement === 'male_only' ? 'Lads' : 'Ladies'}</span>
                  </span>
                )}
                {(match.total_cost || 0) > 0 && (
                  <span className="inline-block px-3 py-1 bg-orange-100 text-orange-700 text-sm font-medium rounded-full">
                    💵<span className="hidden sm:inline"> Paid</span>
                  </span>
                )}
              </div>
            </div>
            {/* Desktop buttons */}
            {isAuthenticated && (
              <div className="hidden md:flex gap-2">
                {matchStatus !== 'completed' && (
                  <div className="relative group">
                  <button
                    onClick={() => setShowShareMenu(!showShareMenu)}
                    className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg font-medium transition flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                  </button>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-100 pointer-events-none z-10 whitespace-nowrap">
                    <div className="bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg">
                      Share
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                        <div className="border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  </div>

                {showShareMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowShareMenu(false)}
                    />
                    <div className="absolute left-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                      {isBooked && (
                        <>
                          <a
                            href={getGoogleCalendarUrl()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition"
                            onClick={() => setShowShareMenu(false)}
                          >
                            <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/>
                            </svg>
                            <span className="text-sm font-medium text-gray-700">Google Calendar</span>
                          </a>
                          <button
                            onClick={() => {
                              downloadICS();
                              setShowShareMenu(false);
                            }}
                            className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition w-full text-left"
                          >
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span className="text-sm font-medium text-gray-700">Apple/Outlook (.ics)</span>
                          </button>
                          <div className="border-t border-gray-100 my-1"></div>
                        </>
                      )}
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
              )}

              {(isCreator || isAdmin) && matchStatus !== 'completed' && (
                <>
                  <div className="relative group">
                    <button
                      onClick={() => setIsEditModalOpen(true)}
                      className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-100 pointer-events-none z-10 whitespace-nowrap">
                      <div className="bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg">
                        Edit Match
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                          <div className="border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {isCreator && matchStatus !== 'in-progress' && (
                    <div className="relative group">
                      <button
                        onClick={handleCancelMatch}
                        className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-100 pointer-events-none z-10 whitespace-nowrap">
                        <div className="bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg">
                          Cancel Match
                          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                            <div className="border-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              {isAdmin && matchStatus === 'completed' && (
                <div className="relative group">
                  <button
                    onClick={handleCancelMatch}
                    className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-100 pointer-events-none z-10 whitespace-nowrap">
                    <div className="bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg">
                      Cancel Match
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                        <div className="border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              </div>
            )}

            {/* Mobile hamburger menu */}
            {isAuthenticated && (
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
                    {matchStatus !== 'completed' && (
                      <>
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
                      </>
                    )}

                    {isBooked && (
                      <>
                        <div className="my-1 border-t border-gray-200"></div>
                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Add to Calendar
                        </div>
                        <a
                          href={getGoogleCalendarUrl()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition"
                          onClick={() => setShowMobileMenu(false)}
                        >
                          <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/>
                          </svg>
                          <span className="text-sm font-medium text-gray-700">Google Calendar</span>
                        </a>
                        <button
                          onClick={() => {
                            downloadICS();
                            setShowMobileMenu(false);
                          }}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition w-full text-left"
                        >
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          <span className="text-sm font-medium text-gray-700">Apple/Outlook (.ics)</span>
                        </button>
                      </>
                    )}

                    {(isCreator || isAdmin) && matchStatus !== 'completed' && (
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
                        {isCreator && matchStatus !== 'in-progress' && (
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
                        )}
                      </>
                    )}
                    {isAdmin && matchStatus === 'completed' && (
                      <>
                        <div className="my-1 border-t border-gray-200"></div>
                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Admin
                        </div>
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
            )}
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

        {/* Location Map */}
        {LOCATION_DATA[match.location]?.coordinates && (
          <div className="mb-8">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                LOCATION_DATA[match.location].address
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <div className="relative bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-primary transition group cursor-pointer">
                <Map
                  height={192}
                  center={LOCATION_DATA[match.location].coordinates}
                  zoom={15}
                  attribution={false}
                  mouseEvents={false}
                  touchEvents={false}
                >
                  <Marker
                    width={40}
                    anchor={LOCATION_DATA[match.location].coordinates}
                    color="#ef4444"
                  />
                </Map>
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-10 transition pointer-events-none">
                  <div className="bg-white px-4 py-2 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Open in Google Maps
                    </div>
                  </div>
                </div>
              </div>
            </a>
          </div>
        )}

        {/* Tournament Badge */}
        {match.is_tournament && (
          <div className="mb-4">
            <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-800 px-4 py-2 rounded-lg font-semibold border-2 border-orange-300">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 00-.584.859 6.753 6.753 0 006.138 5.6 6.73 6.73 0 002.743 1.346A6.707 6.707 0 019.279 15H8.54c-1.036 0-1.875.84-1.875 1.875V19.5h-.75a2.25 2.25 0 100 4.5h12a2.25 2.25 0 100-4.5h-.75v-2.625c0-1.036-.84-1.875-1.875-1.875h-.739a6.706 6.706 0 00-1.112-3.173 6.73 6.73 0 002.743-1.347 6.753 6.753 0 006.139-5.6.75.75 0 00-.585-.858 47.077 47.077 0 00-3.07-.543V2.62a.75.75 0 00-.658-.744 49.22 49.22 0 00-6.093-.377c-2.063 0-4.096.128-6.093.377a.75.75 0 00-.657.744zm0 2.629c0 1.196.312 2.32.857 3.294A5.266 5.266 0 013.16 5.337a45.6 45.6 0 012.006-.343v.256zm13.5 0v-.256c.674.1 1.343.214 2.006.343a5.265 5.265 0 01-2.863 3.207 6.72 6.72 0 00.857-3.294z"/>
              </svg>
              Tournament
            </div>
            {match.prize_first && match.prize_first > 0 && (
              <div className="mt-3 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 00-.584.859 6.753 6.753 0 006.138 5.6 6.73 6.73 0 002.743 1.346A6.707 6.707 0 019.279 15H8.54c-1.036 0-1.875.84-1.875 1.875V19.5h-.75a2.25 2.25 0 100 4.5h12a2.25 2.25 0 100-4.5h-.75v-2.625c0-1.036-.84-1.875-1.875-1.875h-.739a6.706 6.706 0 00-1.112-3.173 6.73 6.73 0 002.743-1.347 6.753 6.753 0 006.139-5.6.75.75 0 00-.585-.858 47.077 47.077 0 00-3.07-.543V2.62a.75.75 0 00-.658-.744 49.22 49.22 0 00-6.093-.377c-2.063 0-4.096.128-6.093.377a.75.75 0 00-.657.744zm0 2.629c0 1.196.312 2.32.857 3.294A5.266 5.266 0 013.16 5.337a45.6 45.6 0 012.006-.343v.256zm13.5 0v-.256c.674.1 1.343.214 2.006.343a5.265 5.265 0 01-2.863 3.207 6.72 6.72 0 00.857-3.294z"/>
                  </svg>
                  <span className="font-bold text-yellow-900">Prize Money</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-yellow-800">🥇 1st Place:</span>
                    <span className="text-lg font-bold text-yellow-900">${match.prize_first.toFixed(2)}</span>
                  </div>
                  {match.prize_second != null && match.prize_second > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-yellow-800">🥈 2nd Place:</span>
                      <span className="text-lg font-semibold text-yellow-800">${match.prize_second.toFixed(2)}</span>
                    </div>
                  )}
                  {match.prize_third != null && match.prize_third > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-yellow-800">🥉 3rd Place:</span>
                      <span className="text-lg font-semibold text-yellow-700">${match.prize_third.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">
              {matchStatus === 'completed' ? 'Total Slots' : 'Available Slots'}
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {matchStatus === 'completed'
                ? match.max_players
                : `${match.available_slots}/${match.max_players}`
              }
            </div>
          </div>

          {match.required_level !== null && match.required_level !== undefined && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Minimum Player Level</div>
              <div className={`inline-flex items-center gap-2 ${getRankingColor(match.required_level.toString())} text-white px-4 py-2 rounded-lg font-semibold`}>
                {getRankingLabel(match.required_level.toString())} and above
              </div>
            </div>
          )}
        </div>

        {/* Tournament Gender Distribution */}
        {match.is_tournament && (match.required_ladies || match.required_lads) && (
          <div className="mb-8 p-4 bg-orange-50 rounded-lg border-2 border-orange-200">
            <div className="text-sm font-semibold text-gray-900 mb-3">Gender Distribution</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {match.required_ladies && (
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Ladies</span>
                    <span className="font-semibold">
                      {match.bookings.filter(b => b.user?.gender === 'female').length} / {match.required_ladies}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-pink-500 h-3 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (match.bookings.filter(b => b.user?.gender === 'female').length / match.required_ladies) * 100)}%`
                      }}
                    />
                  </div>
                </div>
              )}
              {match.required_lads && (
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Lads</span>
                    <span className="font-semibold">
                      {match.bookings.filter(b => b.user?.gender === 'male').length} / {match.required_lads}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-500 h-3 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (match.bookings.filter(b => b.user?.gender === 'male').length / match.required_lads) * 100)}%`
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Players ({match.bookings.length + guestBookings.length}/{match.max_players})
          </h2>
          <div className="space-y-3">
            {[...match.bookings].sort((a, b) => {
              // Creator always first
              if (a.user.id === match.created_by) return -1;
              if (b.user.id === match.created_by) return 1;
              return 0;
            }).map((booking) => {
              const hasPaid = isBookingPaid(booking.id);
              const showPaymentStatus = (match.total_cost || 0) > 0 && (isCreator || isBooked);

              return (
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
                      {formatRanking(booking.user.ranking)}
                    </div>
                    {/* Creator badge icon on avatar */}
                    {booking.user.id === match.created_by && (
                      <div className="absolute -top-1 -left-1 bg-blue-500 text-white rounded-full p-0.5 border-2 border-white shadow-sm" title="Match Creator">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                          <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    {/* Payment status badge */}
                    {showPaymentStatus && (
                      <button
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!isCreator) return;

                          const newStatus = !hasPaid;
                          if (perPersonCost) {
                            await createOrUpdatePayment(booking.id, perPersonCost, newStatus);
                            queryClient.invalidateQueries({ queryKey: ['payments', match?.id] });
                          }
                        }}
                        disabled={!isCreator}
                        className={`absolute -top-1 -right-1 ${hasPaid ? 'bg-green-500' : 'bg-yellow-500'} rounded-full p-1 border-2 border-white shadow-sm ${isCreator ? 'cursor-pointer hover:opacity-80' : ''}`}
                        title={isCreator ? 'Click to toggle payment status' : hasPaid ? 'Paid' : 'Pending'}
                      >
                        {hasPaid ? (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    )}
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
                      {showPaymentStatus && (
                        <button
                          onClick={async (e) => {
                            e.preventDefault();
                            if (!isCreator) return; // Only creator can toggle others' payment status

                            const newStatus = !hasPaid;
                            if (perPersonCost) {
                              await createOrUpdatePayment(booking.id, perPersonCost, newStatus);
                              queryClient.invalidateQueries({ queryKey: ['payments', match?.id] });
                            }
                          }}
                          disabled={!isCreator}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 ${hasPaid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'} text-xs font-medium rounded-full ${isCreator ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                          title={isCreator ? 'Click to toggle payment status' : ''}
                        >
                          {hasPaid ? '✓ Paid' : '⏱ Pending'}
                        </button>
                      )}
                    </div>
                    <div className={`text-sm ${getRankingColor(booking.user.ranking || '0')} bg-opacity-10 inline-block px-2 py-0.5 rounded`}>
                      Rank: {formatRanking(booking.user.ranking)}
                    </div>
                    {/* Creator sees amount owed per player */}
                    {isCreator && perPersonCost && (
                      <div className={`text-sm mt-1 ${hasPaid ? 'text-green-600 font-medium' : 'text-gray-600'}`}>
                        {hasPaid ? 'Paid:' : 'Owes:'} ${perPersonCost.toFixed(2)}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}

            {/* Guest Players */}
            {guestBookings.map((guestBooking) => {
              const hasGuestPaid = isGuestBookingPaid(guestBooking.id);
              const showPaymentStatus = (match.total_cost || 0) > 0 && (isCreator || isBooked);

              return (
                <div
                  key={guestBooking.id}
                  className="flex items-center gap-4 p-3 bg-purple-50 rounded-lg border border-purple-200"
                >
                  <div className="relative group">
                    <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center text-purple-700">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    </div>
                    {/* Payment status badge for guests */}
                    {showPaymentStatus && (
                      <button
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!isCreator) return;

                          const newStatus = !hasGuestPaid;
                          if (perPersonCost) {
                            await createOrUpdateGuestPayment(guestBooking.id, perPersonCost, newStatus);
                            queryClient.invalidateQueries({ queryKey: ['guestPayments', match?.id] });
                          }
                        }}
                        disabled={!isCreator}
                        className={`absolute -top-1 -right-1 ${hasGuestPaid ? 'bg-green-500' : 'bg-yellow-500'} rounded-full p-1 border-2 border-white shadow-sm ${isCreator ? 'cursor-pointer hover:opacity-80' : ''}`}
                        title={isCreator ? 'Click to toggle payment status' : hasGuestPaid ? 'Paid' : 'Pending'}
                      >
                        {hasGuestPaid ? (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    )}
                    {/* Instant tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-100 pointer-events-none z-10">
                      <div className="bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
                        {guestBooking.guest_name}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                          <div className="border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-gray-900">{guestBooking.guest_name}</div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                        Guest
                      </span>
                      {showPaymentStatus && (
                        <button
                          onClick={async (e) => {
                            e.preventDefault();
                            if (!isCreator) return;

                            const newStatus = !hasGuestPaid;
                            if (perPersonCost) {
                              await createOrUpdateGuestPayment(guestBooking.id, perPersonCost, newStatus);
                              queryClient.invalidateQueries({ queryKey: ['guestPayments', match?.id] });
                            }
                          }}
                          disabled={!isCreator}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 ${hasGuestPaid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'} text-xs font-medium rounded-full ${isCreator ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                          title={isCreator ? 'Click to toggle payment status' : ''}
                        >
                          {hasGuestPaid ? '✓ Paid' : '⏱ Pending'}
                        </button>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">Guest Player</div>
                    {/* Creator sees amount owed per guest player */}
                    {isCreator && perPersonCost && (
                      <div className={`text-sm mt-1 ${hasGuestPaid ? 'text-green-600 font-medium' : 'text-gray-600'}`}>
                        {hasGuestPaid ? 'Paid:' : 'Owes:'} ${perPersonCost.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

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

        {isAuthenticated && (
          <div className="flex gap-3 items-center">
            {matchStatus === 'upcoming' && (match.available_slots > 0 || isBooked) && (
              <button
              onClick={handleBookSlot}
              className={`flex-1 py-3 rounded-lg font-medium transition ${
                isBooked
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-primary hover:bg-primary-dark text-white'
              }`}
            >
              {isBooked ? 'Give Up My Spot' : (
                <>
                  Book a Slot{(match.total_cost || 0) > 0 && match.price_per_player && (
                    <> for 💵${match.price_per_player.toFixed(2)}</>
                  )}
                </>
              )}
            </button>
          )}
          {matchStatus === 'in-progress' && (
            <div className="flex-1 py-3 rounded-lg font-medium bg-gray-200 text-gray-600 text-center">
              Match in progress - No bookings allowed
            </div>
          )}
          {matchStatus === 'completed' && (
            <div className="flex-1 py-3 rounded-lg font-medium bg-gray-200 text-gray-600 text-center">
              Match completed
            </div>
          )}

          {match.available_slots === 0 && !isBooked && (
            <div className="flex-1 text-center py-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-600 font-medium">This match is fully booked</p>
            </div>
          )}
          </div>
        )}

        {/* Payment Section */}
        {(match.total_cost || 0) > 0 && perPersonCost && isBooked && !isCreator && matchStatus !== 'completed' && (
          <div className="mt-6 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">💵 Payment Required</h3>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600">Price per player:</p>
                <p className="text-2xl font-bold text-gray-900">${perPersonCost.toFixed(2)}</p>
              </div>
              {currentUserPayment?.marked_as_paid && (
                <div className="flex items-center gap-2 text-green-600">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">Marked as Paid</span>
                </div>
              )}
            </div>

            <p className="text-sm text-gray-700 mb-4">Pay {matchCreator?.name}:</p>
            <div className="space-y-3">
              {matchCreator?.venmo_username && (
                <button
                  onClick={handlePayVenmo}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.83 4.18c.84 1.3 1.17 2.58 1.17 4.16 0 5.2-4.42 11.96-8.03 16.66H7.5L4.16 4.66h5.7l1.76 10.9c1.46-2.4 3.24-5.87 3.24-8.49 0-1.4-.27-2.37-.71-3.06l5.68-1.83z"/>
                  </svg>
                  Pay with Venmo
                </button>
              )}
              {matchCreator?.zelle_handle && (
                <button
                  onClick={handleCopyZelle}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Zelle Info
                </button>
              )}
              <div className="pt-3 border-t border-blue-200">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentUserPayment?.marked_as_paid || false}
                    onChange={handleTogglePayment}
                    disabled={togglePaymentMutation.isPending}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    {currentUserPayment?.marked_as_paid ? 'I sent the payment' : 'Mark as sent when you pay'}
                  </span>
                </label>
              </div>
            </div>

            {!matchCreator?.venmo_username && !matchCreator?.zelle_handle && (
              <p className="text-sm text-gray-600 italic">The match creator hasn't set up payment information yet.</p>
            )}
          </div>
        )}

        {/* Creator Payment View */}
        {(match.total_cost || 0) > 0 && (isCreator || isAdmin) && (
          <div className="mt-6 p-6 bg-gray-50 border border-gray-200 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Payment Summary</h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600">Price Per Player:</p>
              <p className="text-2xl font-bold text-gray-900">💵${match.price_per_player?.toFixed(2) || '0.00'}</p>
              <p className="text-sm text-gray-600 mt-1">
                {bookings.length + guestBookings.length} of {match.max_players} slots booked
              </p>
            </div>
            <div className="mb-4 pt-4 border-t border-gray-300">
              <p className="text-sm text-gray-600">Total Amount Marked as Paid:</p>
              <p className="text-2xl font-bold text-green-600">
                ${(() => {
                  const paidCount = allPayments.filter(p => p.marked_as_paid).length +
                                    allGuestPayments.filter(p => p.marked_as_paid).length;
                  return ((match.price_per_player || 0) * paidCount).toFixed(2);
                })()}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {allPayments.filter(p => p.marked_as_paid).length + allGuestPayments.filter(p => p.marked_as_paid).length} of {bookings.length + guestBookings.length} players marked as paid
              </p>
            </div>
            {isCreator && !currentUser?.venmo_username && !currentUser?.zelle_handle && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <Link to={`/profile/${currentUser?.id}/edit`} className="font-medium underline">
                    Add your payment info
                  </Link> to receive payments from players.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {(isCreator || isAdmin) && matchStatus !== 'completed' && (
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
