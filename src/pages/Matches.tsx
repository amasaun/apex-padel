import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getMatches } from '@/lib/api';
import { getCurrentUserProfile } from '@/lib/auth';
import { getRankingColor, formatTime, formatDuration, calculateEndTime } from '@/lib/utils';
import { LOCATION_DATA } from '@/lib/locations';
import CreateMatchModal from '@/components/CreateMatchModal';
import UserMenu from '@/components/UserMenu';
import UserAvatar from '@/components/UserAvatar';

export default function Matches() {
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeShareMenu, setActiveShareMenu] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'agenda' | 'calendar'>('agenda');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showMyMatchesOnly, setShowMyMatchesOnly] = useState(false);

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

  // Sort and filter matches
  const filteredMatches = useMemo(() => {
    let result = [...matches].sort((a, b) => {
      const dateTimeA = new Date(`${a.date}T${a.time}`).getTime();
      const dateTimeB = new Date(`${b.date}T${b.time}`).getTime();
      return dateTimeA - dateTimeB;
    });

    // Filter to show only user's matches if toggle is on
    if (showMyMatchesOnly && currentUser) {
      result = result.filter(match =>
        match.created_by === currentUser.id ||
        match.bookings.some(booking => booking.user_id === currentUser.id)
      );
    }

    return result;
  }, [matches, showMyMatchesOnly, currentUser]);


  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
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
    const text = encodeURIComponent(
      `🎾 Join me for Padel!\n\n` +
      `📍 ${match.location}\n` +
      `📅 ${formatDate(match.date)}\n` +
      `⏰ ${formatTime(match.time)}\n` +
      `⏱️ ${formatDuration(match.duration)}\n` +
      `👥 ${match.available_slots} slots available\n\n` +
      `Book here: ${getShareUrl(match.id)}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
    setActiveShareMenu(null);
  };

  const handleShareEmail = (e: React.MouseEvent, match: any) => {
    e.preventDefault();
    e.stopPropagation();
    const subject = encodeURIComponent(`Join me for Padel - ${match.title || 'Match'}`);
    const body = encodeURIComponent(
      `I'm playing padel at ${match.location} on ${formatDate(match.date)} at ${formatTime(match.time)}.\n\n` +
      `Join me! Click here to book: ${getShareUrl(match.id)}\n\n` +
      `Match Details:\n` +
      `- Duration: ${formatDuration(match.duration)}\n` +
      `- Available Slots: ${match.available_slots}/${match.max_players}`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
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
        <h1 className="text-3xl font-bold text-gray-900">Apex Padel</h1>
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

        {/* My Matches Toggle - Visible on all screens */}
        <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg">
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

      {viewMode === 'agenda' && (
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {selectedDate === 'all' ? 'Upcoming Matches' : `Matches on ${formatDate(selectedDate)}`}
        </h2>
      )}

      {viewMode === 'calendar' ? (
        <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-6">
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

              return (
                <Link
                  key={match.id}
                  to={`/matches/${match.id}`}
                  className={`block rounded-lg shadow-sm transition p-6 border ${
                    isFull
                      ? 'bg-gray-100 border-gray-300 opacity-75'
                      : 'bg-white border-gray-200 hover:shadow-md'
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
                      {match.is_private && (
                        <span className="inline-block px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                          🔒 Private
                        </span>
                      )}
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
                            <div className="absolute left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
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
                </div>
              </div>

              {match.bookings.length > 0 && (
                <div>
                  <div className={`text-sm mb-2 ${isFull ? 'text-gray-500' : 'text-gray-600'}`}>
                    Players:
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {match.bookings.slice(0, 8).map((booking) => (
                      <div key={booking.id} className="relative group">
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
                          {booking.user.ranking}
                        </div>
                        {booking.user.id === match.created_by && (
                          <div className="absolute -top-1 -left-1 bg-blue-500 text-white rounded-full p-0.5 border-2 border-white shadow-sm" title="Match Creator">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                              <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                        {/* Instant tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-100 pointer-events-none z-10">
                          <div className="bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
                            {booking.user.name}
                            {booking.user.id === match.created_by && ' (Creator)'}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                              <div className="border-4 border-transparent border-t-gray-900"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {match.available_slots > 0 && (
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
