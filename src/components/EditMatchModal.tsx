import { useState, useEffect } from 'react';
import { MatchWithDetails, User } from '@/types';
import { LOCATION_DATA } from '@/lib/locations';
import { getRankingColor } from '@/lib/utils';
import { updateMatch, getUsers, updateMatchPlayers } from '@/lib/api';
import UserAvatar from './UserAvatar';

const LOCATIONS = Object.keys(LOCATION_DATA);
const DURATIONS = [
  { value: 60, label: '1 hour' },
  { value: 90, label: '1 hour 30 minutes' },
  { value: 120, label: '2 hours' },
  { value: 150, label: '2 hours 30 minutes' },
  { value: 180, label: '3 hours' },
];
const MAX_PLAYERS_OPTIONS = [4, 5, 6, 7, 8];

// Generate time options in 30-minute increments
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2);
  const minutes = (i % 2) * 30;
  const time24 = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  const timeDisplay = `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  return { value: time24, label: timeDisplay };
});

interface EditMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  match: MatchWithDetails;
}

export default function EditMatchModal({ isOpen, onClose, onSuccess, match }: EditMatchModalProps) {
  const [formData, setFormData] = useState({
    title: match.title || '',
    date: match.date,
    time: match.time,
    duration: match.duration,
    maxPlayers: match.max_players,
    location: match.location,
    isPrivate: match.is_private || false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>(
    match.bookings.map((b) => b.user_id)
  );
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: match.title || '',
        date: match.date,
        time: match.time,
        duration: match.duration,
        maxPlayers: match.max_players,
        location: match.location,
        isPrivate: match.is_private || false,
      });
      setSelectedPlayers(match.bookings.map((b) => b.user_id));

      // Load all users
      getUsers().then(setAllUsers).catch(console.error);
    }
  }, [isOpen, match]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.date) {
      newErrors.date = 'Date is required';
    } else {
      // Parse date string as local date (YYYY-MM-DD)
      const [year, month, day] = formData.date.split('-').map(Number);
      const selectedDate = new Date(year, month - 1, day);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        newErrors.date = 'Date cannot be in the past';
      }
    }

    if (!formData.time) {
      newErrors.time = 'Time is required';
    }

    if (selectedPlayers.length > formData.maxPlayers) {
      newErrors.players = `Cannot have more than ${formData.maxPlayers} players`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Update match details
      await updateMatch(match.id, {
        title: formData.title || undefined,
        date: formData.date,
        time: formData.time,
        duration: formData.duration,
        max_players: formData.maxPlayers,
        location: formData.location,
        is_private: formData.isPrivate,
      });

      // Update players
      await updateMatchPlayers(match.id, selectedPlayers);

      setErrors({});
      onSuccess();
      onClose();
    } catch (error: any) {
      setErrors({ submit: error.message || 'Failed to update match' });
    } finally {
      setLoading(false);
    }
  };

  const togglePlayer = (userId: string) => {
    if (selectedPlayers.includes(userId)) {
      setSelectedPlayers(selectedPlayers.filter((id) => id !== userId));
    } else {
      if (selectedPlayers.length < formData.maxPlayers) {
        setSelectedPlayers([...selectedPlayers, userId]);
      }
    }
  };

  // Get currently booked players
  const bookedPlayers = allUsers.filter((user) => selectedPlayers.includes(user.id));

  // Filter available users based on search query (excluding already selected players)
  const filteredAvailableUsers = allUsers.filter((user) => {
    if (selectedPlayers.includes(user.id)) return false;
    if (!searchQuery) return false;
    const query = searchQuery.toLowerCase();
    return (
      user.name.toLowerCase().includes(query) ||
      (user.email && user.email.toLowerCase().includes(query))
    );
  });

  const handleClose = () => {
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Edit Match</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Match Title (optional)
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Evening Doubles, Advanced Players Only"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
                Date *
              </label>
              <input
                type="date"
                id="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer ${
                  errors.date ? 'border-red-500' : 'border-gray-300'
                }`}
                onFocus={(e) => {
                  // Show calendar picker when field gets focus
                  setTimeout(() => {
                    (e.target as HTMLInputElement).showPicker?.();
                  }, 0);
                }}
              />
              {errors.date && <p className="mt-1 text-sm text-red-600">{errors.date}</p>}
            </div>

            <div>
              <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-2">
                Start Time *
              </label>
              <select
                id="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                  errors.time ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                {TIME_OPTIONS.map((timeOption) => (
                  <option key={timeOption.value} value={timeOption.value}>
                    {timeOption.label}
                  </option>
                ))}
              </select>
              {errors.time && <p className="mt-1 text-sm text-red-600">{errors.time}</p>}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
              Duration
            </label>
            <select
              id="duration"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {DURATIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
              Location
            </label>
            <select
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* Max Players */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Maximum Players
            </label>
            <div className="flex gap-4">
              {MAX_PLAYERS_OPTIONS.map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setFormData({ ...formData, maxPlayers: num })}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${
                    formData.maxPlayers === num
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Privacy Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <label htmlFor="isPrivate" className="block text-sm font-medium text-gray-900 cursor-pointer">
                Make this match private
              </label>
              <p className="text-xs text-gray-600 mt-1">
                Private matches are only visible to you and invited players. You can share a link to let others join.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={formData.isPrivate}
              onClick={() => setFormData({ ...formData, isPrivate: !formData.isPrivate })}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                formData.isPrivate ? 'bg-primary' : 'bg-gray-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  formData.isPrivate ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Player Management */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Manage Players ({selectedPlayers.length}/{formData.maxPlayers})
            </label>
            {errors.players && <p className="mb-2 text-sm text-red-600">{errors.players}</p>}

            {/* Currently Booked Players */}
            {bookedPlayers.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Booked Players</h3>
                <div className="space-y-2">
                  {bookedPlayers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 p-3 bg-green-50 border-2 border-green-200 rounded-lg"
                    >
                      <div className="relative">
                        <UserAvatar
                          name={user.name}
                          photoUrl={user.photo_url}
                          size="md"
                        />
                        <div
                          className={`absolute -bottom-1 -right-1 ${getRankingColor(
                            user.ranking || '0'
                          )} text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[26px] h-5 flex items-center justify-center border-2 border-white shadow-sm`}
                        >
                          {user.ranking}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">Rank: {user.ranking}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => togglePlayer(user.id)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Players Search */}
            {selectedPlayers.length < formData.maxPlayers && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Add Players</h3>
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent mb-2"
                />
                {searchQuery && (
                  <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                    {filteredAvailableUsers.length > 0 ? (
                      <div className="space-y-1 p-2">
                        {filteredAvailableUsers.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => {
                              togglePlayer(user.id);
                              setSearchQuery('');
                            }}
                            className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition"
                          >
                            <div className="relative">
                              <UserAvatar
                                name={user.name}
                                photoUrl={user.photo_url}
                                size="md"
                              />
                              <div
                                className={`absolute -bottom-1 -right-1 ${getRankingColor(
                                  user.ranking || '0'
                                )} text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[26px] h-5 flex items-center justify-center border-2 border-white shadow-sm`}
                              >
                                {user.ranking}
                              </div>
                            </div>
                            <div className="flex-1 text-left">
                              <div className="font-medium text-gray-900">{user.name}</div>
                              <div className="text-sm text-gray-500">Rank: {user.ranking}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        No users found matching "{searchQuery}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error Message */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{errors.submit}</p>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary hover:bg-primary-dark text-white py-3 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
