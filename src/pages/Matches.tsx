import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getMatches, getLocations, getPaymentsByMatchId } from '@/lib/api';
import { getCurrentUserProfile } from '@/lib/auth';
import { getRankingColor, formatTime, formatDuration, calculateEndTime, getRankingLabel, formatRanking } from '@/lib/utils';
import { LOCATION_DATA } from '@/lib/locations';
import { getPrimaryInviteCode } from '@/lib/invites';
import CreateMatchModal from '@/components/CreateMatchModal';
import UserMenu from '@/components/UserMenu';
import UserAvatar from '@/components/UserAvatar';
import { useMatchNotifications } from '@/hooks/useMatchNotifications';

export default function Matches() {
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeShareMenu, setActiveShareMenu] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'agenda' | 'calendar'>('agenda');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showMyMatchesOnly, setShowMyMatchesOnly] = useState(false);
  const [showPastMatches, setShowPastMatches] = useState(false);
  const [showFullMatches, setShowFullMatches] = useState(false);
  const [showNotificationBanner, setShowNotificationBanner] = useState(true);

  // Notification hook
  const { permission, requestPermission, isSupported } = useMatchNotifications();

  // Fetch matches from Supabase
  const { data: matches = [], isLoading, error, refetch } = useQuery({
    queryKey: ['matches', selectedDate],
    queryFn: () => getMatches(selectedDate === 'all' ? {} : { date: selectedDate }),
  });

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUserProfile,
  });

  // Fetch locations
  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => getLocations(),
  });

  // Fetch primary invite code for sharing
  const { data: inviteCode } = useQuery({
    queryKey: ['primaryInviteCode'],
    queryFn: getPrimaryInviteCode,
  });

  // Get matches where user is involved (creator or booked) and has payment enabled
  const relevantMatchIds = useMemo(() => {
    if (!currentUser) return [];
    return matches
      .filter(match =>
        match.total_cost &&
        (match.created_by === currentUser.id ||
         match.bookings.some((b: any) => b.user_id === currentUser.id))
      )
      .map(m => m.id);
  }, [matches, currentUser]);

  // Fetch payment data for relevant matches
  const { data: paymentsData } = useQuery({
    queryKey: ['matchesPayments', relevantMatchIds],
    queryFn: async () => {
      const paymentsMap: Record<string, any[]> = {};
      await Promise.all(
        relevantMatchIds.map(async (matchId) => {
          const payments = await getPaymentsByMatchId(matchId);
          paymentsMap[matchId] = payments;
        })
      );
      return paymentsMap;
    },
    enabled: relevantMatchIds.length > 0,
  });

  // Helper to check if a booking has been paid
  const isBookingPaid = (matchId: string, bookingId: string) => {
    if (!paymentsData || !paymentsData[matchId]) return false;
    return paymentsData[matchId].some((p: any) => p.booking_id === bookingId && p.marked_as_paid);
  };

  const getMatchStatus = (dateStr: string, timeStr: string, duration: number) => {
    const now = new Date();
    const matchStartTime = new Date(`${dateStr}T${timeStr}`);
    const matchEndTime = new Date(matchStartTime.getTime() + (duration * 60 * 1000));

    if (now < matchStartTime) {
      // Match hasn't started yet - upcoming
      return 'upcoming';
    } else if (now >= matchStartTime && now < matchEndTime) {
      // Match has started but hasn't ended - in progress
      return 'in-progress';
    } else {
      // now >= matchEndTime - Match has ended - completed
      return 'completed';
    }
  };

  const isMatchStartingSoon = (dateStr: string, timeStr: string) => {
    const now = new Date();
    const matchStartTime = new Date(`${dateStr}T${timeStr}`);
    const minutesUntilStart = (matchStartTime.getTime() - now.getTime()) / (1000 * 60);
    return minutesUntilStart > 0 && minutesUntilStart <= 90;
  };

  // Sort and filter matches
  const filteredMatches = useMemo(() => {
    let result = [...matches].sort((a, b) => {
      const dateTimeA = new Date(`${a.date}T${a.time}`).getTime();
      const dateTimeB = new Date(`${b.date}T${b.time}`).getTime();
      return dateTimeA - dateTimeB;
    });

    // Filter by location if selected
    if (selectedLocation) {
      result = result.filter(match => match.location === selectedLocation);
    }

    // Filter out completed matches by default (but keep in-progress)
    if (!showPastMatches) {
      result = result.filter(match => {
        const status = getMatchStatus(match.date, match.time, match.duration);
        // Keep upcoming and in-progress matches, hide completed ones
        return status !== 'completed';
      });
    }

    // Filter out full matches by default (unless user is creator or has booked)
    if (!showFullMatches) {
      result = result.filter(match => {
        const isFull = match.available_slots === 0;

        // Always show if not full
        if (!isFull) return true;

        // Always show if user is the creator
        if (currentUser && match.created_by === currentUser.id) return true;

        // Always show if user has booked the match
        if (currentUser && match.bookings.some((booking: any) => booking.user_id === currentUser.id)) return true;

        // Otherwise, hide full matches
        return false;
      });
    }

    // Filter to show only user's matches if toggle is on
    if (showMyMatchesOnly && currentUser) {
      result = result.filter(match =>
        match.created_by === currentUser.id ||
        match.bookings.some(booking => booking.user_id === currentUser.id)
      );
    }

    return result;
  }, [matches, selectedLocation, showMyMatchesOnly, currentUser, showPastMatches, showFullMatches]);


  const formatDate = (dateStr: string) => {
    // Parse date as local time to avoid timezone issues
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getTimeUntilMatch = (dateStr: string, timeStr: string) => {
    const matchDateTime = new Date(`${dateStr}T${timeStr}`);
    const now = new Date();
    const hoursUntil = (matchDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntil;
  };

  const getUrgencyStyle = (hoursUntil: number) => {
    if (hoursUntil < 1) {
      return 'text-red-600 font-bold';
    } else if (hoursUntil < 2) {
      return 'text-yellow-600 font-bold';
    } else {
      return 'text-green-600 font-semibold';
    }
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

  const getShareUrl = (matchId: string) => `${window.location.origin}/matches/${matchId}`;

  const handleCopyLink = (e: React.MouseEvent, matchId: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(getShareUrl(matchId)).then(() => {
      alert('Link copied to clipboard!');
      setActiveShareMenu(null);
    });
  };

  const handleShareWhatsApp = (e: React.MouseEvent, match: any) => {
    e.preventDefault();
    e.stopPropagation();

    console.log('Share WhatsApp - inviteCode:', inviteCode);

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
    matchInfo += `Book here: ${getShareUrl(match.id)}`;

    if (inviteCode) {
      console.log('Adding invite link to message');
      matchInfo += `\n\n🔑 New to Apex Padel? Join here:\n${window.location.origin}/auth?invite=${inviteCode}`;
    } else {
      console.log('No invite code available');
    }

    console.log('Final message:', matchInfo);

    const text = encodeURIComponent(matchInfo);
    window.open(`https://wa.me/?text=${text}`, '_blank');
    setActiveShareMenu(null);
  };

  const handleShareEmail = (e: React.MouseEvent, match: any) => {
    e.preventDefault();
    e.stopPropagation();
    const subject = encodeURIComponent(`Join me for Padel - ${match.title || 'Match'}`);

    let bodyText = `I'm playing padel at ${match.location} on ${formatDate(match.date)} at ${formatTime(match.time)}.\n\n`;
    bodyText += `Location: ${LOCATION_DATA[match.location]?.address || ''}\n\n`;
    bodyText += `Join me! Click here to book: ${getShareUrl(match.id)}\n\n`;
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

    // Use a setTimeout to allow the event to finish propagating before changing location
    setTimeout(() => {
      window.location.href = mailtoLink;
    }, 0);

    setActiveShareMenu(null);
  };

  const getGoogleCalendarUrl = (match: any) => {
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

  const downloadICS = (e: React.MouseEvent, match: any) => {
    e.preventDefault();
    e.stopPropagation();

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
    setActiveShareMenu(null);
  };

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Add empty cells for days before the month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const getMatchesForDate = (date: Date | null) => {
    if (!date) return [];
    const dateStr = date.toISOString().split('T')[0];
    return filteredMatches.filter(m => m.date === dateStr);
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };


  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        {/* Logo + Title - Show only text on mobile, logo + text on desktop */}
        <div className="flex items-center gap-3">
          <img src="/apex-logo.svg" alt="Apex Padel" className="hidden sm:block h-10 w-10" />
          <h1 className="text-3xl bg-gradient-to-r from-red-600 to-red-500 bg-clip-text text-transparent" style={{ fontFamily: '"Russo One", sans-serif', fontWeight: 400 }}>
            APEX PADEL
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-primary hover:bg-primary-dark text-white px-3 py-1.5 rounded-lg font-medium transition text-sm"
          >
            + Match
          </button>
          <UserMenu />
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-8">
          <p className="text-gray-500">Loading matches...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">
            <strong>Error:</strong> {(error as Error).message}
          </p>
        </div>
      )}

      {/* Notification Banner */}
      {isSupported && permission === 'default' && showNotificationBanner && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">
                Get notified when new matches are created
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Receive instant browser notifications for new public matches
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const granted = await requestPermission();
                if (granted) {
                  setShowNotificationBanner(false);
                }
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
            >
              Enable
            </button>
            <button
              onClick={() => setShowNotificationBanner(false)}
              className="p-2 hover:bg-blue-100 rounded-lg transition"
              aria-label="Dismiss"
            >
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* View Toggle and Date Filter */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        {/* Date Filter - Hidden on mobile */}
        <div className="hidden sm:flex items-center gap-3">
          <label htmlFor="date-picker" className="text-sm font-medium text-gray-700">
            Filter by date:
          </label>
        <div className="flex gap-3 items-center">
          <div className="relative flex-1 sm:flex-initial">
            <input
              id="date-picker"
              type="date"
              value={selectedDate === 'all' ? '' : selectedDate}
              onChange={(e) => setSelectedDate(e.target.value || 'all')}
              className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          {selectedDate !== 'all' && (
            <button
              onClick={() => setSelectedDate('all')}
              className="text-sm text-primary hover:text-primary-dark font-medium whitespace-nowrap"
            >
              Clear filter
            </button>
          )}
        </div>
        </div>

        {/* My Matches Toggle - Hidden on mobile, shown on desktop */}
        <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg">
          <span className="text-sm font-medium text-gray-700">My Matches Only</span>
          <button
            type="button"
            role="switch"
            aria-checked={showMyMatchesOnly}
            onClick={() => setShowMyMatchesOnly(!showMyMatchesOnly)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
              showMyMatchesOnly ? 'bg-primary' : 'bg-gray-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                showMyMatchesOnly ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* View Mode Toggle - Hidden on mobile */}
        <div className="hidden md:flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('agenda')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              viewMode === 'agenda'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Agenda
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              viewMode === 'calendar'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Calendar
          </button>
        </div>
      </div>

      {/* Location Filter */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedLocation(null)}
            className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all ${
              selectedLocation === null
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Locations
          </button>
          {locations.map((location) => (
            <button
              key={location.id}
              onClick={() => setSelectedLocation(location.name)}
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all ${
                selectedLocation === location.name
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {location.name}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'agenda' && (
        <>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold text-gray-900">
              {selectedDate === 'all' ? 'Upcoming Matches' : `Matches on ${formatDate(selectedDate)}`}
            </h2>
            {/* My Matches Toggle - Mobile only, inline with heading */}
            <div className="sm:hidden flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600">My Matches</span>
              <button
                type="button"
                role="switch"
                aria-checked={showMyMatchesOnly}
                onClick={() => setShowMyMatchesOnly(!showMyMatchesOnly)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                  showMyMatchesOnly ? 'bg-primary' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    showMyMatchesOnly ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
          {/* Show Completed Matches and Full Matches links - Mobile and Desktop */}
          <div className="mb-4 flex gap-4">
            <button
              onClick={() => setShowFullMatches(!showFullMatches)}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium underline"
            >
              {showFullMatches ? 'Hide' : 'Show'} Full Matches
            </button>
            <button
              onClick={() => setShowPastMatches(!showPastMatches)}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium underline"
            >
              {showPastMatches ? 'Hide' : 'Show'} Completed Matches
            </button>
          </div>
        </>
      )}

      {viewMode === 'calendar' ? (
        <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={goToPreviousMonth}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={goToNextMonth}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Show Completed Matches and Full Matches links */}
          <div className="mb-4 flex gap-4">
            <button
              onClick={() => setShowFullMatches(!showFullMatches)}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium underline"
            >
              {showFullMatches ? 'Hide' : 'Show'} Full Matches
            </button>
            <button
              onClick={() => setShowPastMatches(!showPastMatches)}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium underline"
            >
              {showPastMatches ? 'Hide' : 'Show'} Completed Matches
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Day headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {getDaysInMonth(currentMonth).map((date, index) => {
              const dayMatches = getMatchesForDate(date);
              const isToday = date && date.toDateString() === new Date().toDateString();

              return (
                <div
                  key={index}
                  className={`min-h-[100px] border rounded-lg p-2 ${
                    date ? 'bg-white hover:bg-gray-50' : 'bg-gray-50'
                  } ${isToday ? 'border-primary border-2' : 'border-gray-200'}`}
                >
                  {date && (
                    <>
                      <div className={`text-sm font-medium mb-1 ${isToday ? 'text-primary' : 'text-gray-700'}`}>
                        {date.getDate()}
                      </div>
                      <div className="space-y-1">
                        {dayMatches.slice(0, 3).map(match => (
                          <Link
                            key={match.id}
                            to={`/matches/${match.id}`}
                            className="group relative block"
                          >
                            <div className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                              match.available_slots === 0
                                ? 'bg-gray-200 text-gray-600'
                                : match.is_private
                                ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            } truncate`}>
                              {match.is_private && (
                                <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                </svg>
                              )}
                              {formatTime(match.time)}
                            </div>

                            {/* Hover Popup */}
                            <div className="absolute left-full ml-2 top-0 z-30 w-72 bg-white rounded-lg shadow-xl border border-gray-200 p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                              <div className="text-sm font-semibold text-gray-900 mb-2">
                                {match.title || 'Padel Match'}
                              </div>
                              <div className="text-xs text-gray-600 space-y-1 mb-3">
                                <div>📍 {match.location}</div>
                                <div>⏰ {formatTime(match.time)} ({formatDuration(match.duration)})</div>
                                <div>👥 {match.available_slots} / {match.max_players} slots available</div>
                                {match.required_level !== null && match.required_level !== undefined && (
                                  <div className="flex items-center gap-1">
                                    <span>🎯</span>
                                    <span className={`${getRankingColor(match.required_level.toString())} text-white px-2 py-0.5 rounded-full text-[10px] font-medium`}>
                                      {getRankingLabel(match.required_level.toString())} and above
                                    </span>
                                  </div>
                                )}
                                {match.gender_requirement && match.gender_requirement !== 'all' && (
                                  <div className="flex items-center gap-1">
                                    <span className={`${match.gender_requirement === 'male_only' ? 'bg-blue-500' : 'bg-pink-500'} text-white px-2 py-0.5 rounded-full text-[10px] font-medium`}>
                                      {match.gender_requirement === 'male_only' ? '♂ Lads' : '♀ Ladies'}
                                    </span>
                                  </div>
                                )}
                                {match.is_private && (
                                  <div>🔒 Private Match</div>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 italic">
                                Click to view details
                              </div>
                            </div>
                          </Link>
                        ))}
                        {dayMatches.length > 3 && (
                          <div className="text-xs text-gray-500 px-2">
                            +{dayMatches.length - 3} more
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMatches.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <p className="text-gray-500">
                {selectedDate === 'all'
                  ? 'No upcoming matches. Create one to get started!'
                  : 'No matches on this date.'}
              </p>
            </div>
          ) : (
            filteredMatches.map((match) => {
              const isFull = match.available_slots === 0;
              const hoursUntil = getTimeUntilMatch(match.date, match.time);
              const playersNeeded = match.max_players - match.bookings.length;
              const matchStatus = getMatchStatus(match.date, match.time, match.duration);
              const isCompleted = matchStatus === 'completed';
              const isInProgress = matchStatus === 'in-progress';

              return (
                <Link
                  key={match.id}
                  to={`/matches/${match.id}`}
                  className={`block rounded-lg shadow-lg transition-all duration-200 p-6 border ${
                    isCompleted
                      ? 'bg-gray-100 border-gray-300 opacity-60 shadow-md'
                      : isFull
                      ? 'bg-gray-100 border-gray-300 opacity-75 shadow-md'
                      : 'bg-white border-gray-200 hover:shadow-xl hover:-translate-y-1'
                  }`}
                >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {match.title && (
                      <div className={`text-lg font-semibold ${isFull ? 'text-gray-500' : 'text-gray-900'}`}>
                        {match.title}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      {isMatchStartingSoon(match.date, match.time) && !isInProgress && !isCompleted && (
                        <span className="inline-block px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded-full animate-pulse border border-orange-300">
                          ⏰ Starting Soon
                        </span>
                      )}
                      {isInProgress && (
                        <span className="inline-block px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                          🔴 In Progress
                        </span>
                      )}
                      {isCompleted && (
                        <span className="inline-block px-2 py-0.5 bg-gray-200 text-gray-600 text-xs font-medium rounded-full">
                          ✓ Completed
                        </span>
                      )}
                      {match.is_private && (
                        <span className="inline-block px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                          🔒<span className="hidden sm:inline"> Private</span>
                        </span>
                      )}
                      {match.required_level !== null && match.required_level !== undefined && (
                        <span className={`inline-block px-2 py-0.5 ${getRankingColor(match.required_level.toString())} text-white text-xs font-medium rounded-full`}>
                          {getAbbreviatedRankingLabel(match.required_level.toString())}
                        </span>
                      )}
                      {match.gender_requirement && match.gender_requirement !== 'all' && (
                        <span className={`inline-block px-2 py-0.5 text-white text-xs font-medium rounded-full ${match.gender_requirement === 'male_only' ? 'bg-blue-500' : 'bg-pink-500'}`}>
                          {match.gender_requirement === 'male_only' ? '♂' : '♀'}<span className="hidden sm:inline"> {match.gender_requirement === 'male_only' ? 'Lads' : 'Ladies'}</span>
                        </span>
                      )}
                      {(() => {
                        const isBooked = currentUser && match.bookings.some((booking: any) => booking.user_id === currentUser.id);
                        return (
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setActiveShareMenu(activeShareMenu === match.id ? null : match.id);
                              }}
                              className={`p-1 hover:bg-gray-100 rounded transition-colors ${isFull ? 'opacity-60' : ''}`}
                              title="Share match"
                            >
                              <svg className={`w-4 h-4 ${match.is_private ? 'text-purple-700' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                              </svg>
                            </button>

                            {activeShareMenu === match.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-10"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setActiveShareMenu(null);
                                  }}
                                />
                                <div className="absolute left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                                  {isBooked && (
                                    <>
                                      <a
                                        href={getGoogleCalendarUrl(match)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveShareMenu(null);
                                        }}
                                      >
                                        <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                                          <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/>
                                        </svg>
                                        <span className="text-xs font-medium text-gray-700">Google Calendar</span>
                                      </a>
                                      <button
                                        onClick={(e) => {
                                          downloadICS(e, match);
                                          setActiveShareMenu(null);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition w-full text-left"
                                      >
                                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        <span className="text-xs font-medium text-gray-700">Apple/Outlook (.ics)</span>
                                      </button>
                                      <div className="border-t border-gray-100 my-1"></div>
                                    </>
                                  )}
                                  <button
                                    onClick={(e) => handleCopyLink(e, match.id)}
                                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition w-full text-left"
                                  >
                                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    <span className="text-xs font-medium text-gray-700">Copy Link</span>
                                  </button>
                                  <button
                                    onClick={(e) => handleShareWhatsApp(e, match)}
                                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition w-full text-left"
                                  >
                                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                    </svg>
                                    <span className="text-xs font-medium text-gray-700">WhatsApp</span>
                                  </button>
                                  <button
                                    onClick={(e) => handleShareEmail(e, match)}
                                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition w-full text-left"
                                  >
                                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    <span className="text-xs font-medium text-gray-700">Email</span>
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div className={`text-sm mb-1 ${isFull ? 'text-gray-400' : 'text-gray-500'}`}>
                    {formatDate(match.date)}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <div className={`text-2xl font-bold ${isFull ? 'text-gray-500' : 'text-gray-900'}`}>
                      {formatTime(match.time)}
                    </div>
                    <div className={`text-xs ${isFull ? 'text-gray-400' : 'text-gray-500'}`}>
                      Booked for {formatDuration(match.duration)}
                    </div>
                  </div>
                  <div className={`text-xs mt-0.5 ${isFull ? 'text-gray-400' : 'text-gray-500'}`}>
                    Ends at {formatTime(calculateEndTime(match.time, match.duration))}
                  </div>
                  <div className={`mt-2 flex items-center gap-2`}>
                    <div className="relative group">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center p-0.5 ${
                        match.location.includes('The Padel Courts')
                          ? isFull ? 'bg-gray-400' : 'bg-gray-800 border-2 border-gray-700'
                          : isFull ? 'bg-gray-200' : 'bg-white border-2 border-gray-200'
                      }`}>
                        <img
                          src={LOCATION_DATA[match.location]?.logo}
                          alt={match.location}
                          className="w-full h-full object-contain"
                          style={{ filter: isFull ? 'grayscale(100%) opacity(0.5)' : 'none' }}
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
                    <span className={`text-xs ${isFull ? 'text-gray-400' : 'text-gray-600'}`}>
                      {match.location.split(' - ')[1]}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  {!isCompleted && (
                    <>
                      {isFull ? (
                        <div className="inline-block bg-gray-500 text-white px-4 py-2 rounded-lg font-bold text-sm">
                          FULL
                        </div>
                      ) : (
                        <>
                          <div className="text-sm text-gray-500 mb-1">Available Slots</div>
                          <div className="text-2xl font-bold text-primary">
                            {match.available_slots}/{match.max_players}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {match.bookings.length > 0 && (
                <div>
                  <div className={`text-sm mb-2 ${isFull ? 'text-gray-500' : 'text-gray-600'}`}>
                    Players:
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {match.bookings.slice(0, 8).map((booking) => {
                      const hasPaid = isBookingPaid(match.id, booking.id);
                      const showPaymentStatus = match.total_cost && (match.created_by === currentUser?.id || match.bookings.some((b: any) => b.user_id === currentUser?.id));

                      return (
                        <Link
                          key={booking.id}
                          to={`/profile/${booking.user.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="relative group"
                        >
                          <UserAvatar
                            name={booking.user.name}
                            photoUrl={booking.user.photo_url}
                            size="md"
                            className={`border-2 ${
                              isFull ? 'border-gray-300 opacity-60' : 'border-white'
                            }`}
                          />
                          <div
                            className={`absolute -bottom-1 -right-1 ${getRankingColor(
                              booking.user.ranking || '0'
                            )} text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[26px] h-5 flex items-center justify-center border-2 border-white shadow-sm`}
                          >
                            {formatRanking(booking.user.ranking)}
                          </div>
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
                            <div className={`absolute -top-1 -right-1 ${hasPaid ? 'bg-green-500' : 'bg-yellow-500'} rounded-full p-0.5 border-2 border-white shadow-sm`} title={hasPaid ? 'Paid' : 'Pending'}>
                              {hasPaid ? (
                                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          )}
                          {/* Instant tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-100 pointer-events-none z-10">
                            <div className="bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
                              {booking.user.name}
                              {booking.user.id === match.created_by && ' (Creator)'}
                              {showPaymentStatus && (
                                <span className={`ml-1 ${hasPaid ? 'text-green-300' : 'text-yellow-300'}`}>
                                  {hasPaid ? '✓ Paid' : '⏱ Pending'}
                                </span>
                              )}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                                <div className="border-4 border-transparent border-t-gray-900"></div>
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {match.available_slots > 0 && matchStatus === 'upcoming' && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                  <span className={`text-sm ${getUrgencyStyle(hoursUntil)}`}>
                    Need {playersNeeded} more {playersNeeded === 1 ? 'player' : 'players'}
                  </span>
                  <span className="text-primary font-medium text-sm">Click to book →</span>
                </div>
              )}
                </Link>
              );
            })
          )}
        </div>
      )}

      <CreateMatchModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
