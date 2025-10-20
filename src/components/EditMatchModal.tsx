import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MatchWithDetails, User, GuestBooking } from '@/types';
import { LOCATION_DATA } from '@/lib/locations';
import { getRankingColor, formatRanking } from '@/lib/utils';
import { updateMatch, getUsers, updateMatchPlayers, createGuestBooking, deleteGuestBooking, updateGuestBooking, updateBookingMatchGender } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import UserAvatar from './UserAvatar';

const LOCATIONS = Object.keys(LOCATION_DATA);
const DURATIONS = [
  { value: 60, label: '1 hour' },
  { value: 90, label: '1 hour 30 minutes' },
  { value: 120, label: '2 hours' },
  { value: 150, label: '2 hours 30 minutes' },
  { value: 180, label: '3 hours' },
  { value: 210, label: '3 hours 30 minutes' },
  { value: 240, label: '4 hours' },
  { value: 270, label: '4 hours 30 minutes' },
  { value: 300, label: '5 hours' },
  { value: 330, label: '5 hours 30 minutes' },
  { value: 360, label: '6 hours' },
  { value: 390, label: '6 hours 30 minutes' },
  { value: 420, label: '7 hours' },
  { value: 450, label: '7 hours 30 minutes' },
  { value: 480, label: '8 hours' },
];
const MAX_PLAYERS_OPTIONS = [4, 5, 6, 7, 8];

const PLAYER_LEVELS = [
  { value: null, label: 'All Levels', minRank: 0, maxRank: 7 },
  { value: 0, label: 'Beginner (0.0 - 1.5)', minRank: 0, maxRank: 1.5 },
  { value: 1.5, label: 'High Beginner (1.5 - 2.5)', minRank: 1.5, maxRank: 2.5 },
  { value: 2.5, label: 'Intermediate (2.5 - 4.0)', minRank: 2.5, maxRank: 4.0 },
  { value: 4.0, label: 'High Intermediate (4.0 - 5.0)', minRank: 4.0, maxRank: 5.0 },
  { value: 5.0, label: 'Advanced (5.0 - 6.0)', minRank: 5.0, maxRank: 6.0 },
  { value: 6.0, label: 'Pro / Elite (6.0 - 7.0)', minRank: 6.0, maxRank: 7.0 },
];

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
  const navigate = useNavigate();

  // Ensure time is in HH:MM format (remove seconds if present)
  const normalizeTime = (time: string) => {
    return time.split(':').slice(0, 2).join(':');
  };

  const [formData, setFormData] = useState({
    title: match.title || '',
    date: match.date,
    time: normalizeTime(match.time),
    duration: match.duration,
    maxPlayers: match.max_players,
    location: match.location,
    isPrivate: match.is_private || false,
    isTournament: match.is_tournament || false,
    requiredLevel: (match.required_level !== null && match.required_level !== undefined) ? match.required_level : null,
    requiredLadies: match.required_ladies || 0,
    requiredLads: match.required_lads || 0,
    genderRequirement: match.gender_requirement || 'all',
    pricePerPlayer: match.price_per_player ? String(match.price_per_player) : '',
    prizeFirst: match.prize_first ? String(match.prize_first) : '',
    prizeSecond: match.prize_second ? String(match.prize_second) : '',
    prizeThird: match.prize_third ? String(match.prize_third) : '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>(
    match.bookings.map((b) => b.user_id)
  );
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [guestBookings, setGuestBookings] = useState<GuestBooking[]>([]);
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestGender, setNewGuestGender] = useState<'female' | 'male' | 'rather_not_say'>('female');
  const [addingGuest, setAddingGuest] = useState(false);
  // Track match_gender for each user (userId -> gender)
  const [playerMatchGenders, setPlayerMatchGenders] = useState<Record<string, 'male' | 'female' | null>>(
    Object.fromEntries(
      match.bookings.map(b => [b.user_id, b.match_gender || null])
    )
  );

  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: match.title || '',
        date: match.date,
        time: normalizeTime(match.time),
        duration: match.duration,
        maxPlayers: match.max_players,
        location: match.location,
        isPrivate: match.is_private || false,
        isTournament: match.is_tournament || false,
        requiredLevel: (match.required_level !== null && match.required_level !== undefined) ? match.required_level : null,
        requiredLadies: match.required_ladies || 0,
        requiredLads: match.required_lads || 0,
        genderRequirement: match.gender_requirement || 'all',
        pricePerPlayer: match.price_per_player ? String(match.price_per_player) : '',
        prizeFirst: match.prize_first ? String(match.prize_first) : '',
        prizeSecond: match.prize_second ? String(match.prize_second) : '',
        prizeThird: match.prize_third ? String(match.prize_third) : '',
      });
      setSelectedPlayers(match.bookings.map((b) => b.user_id));
      setGuestBookings(match.guest_bookings || []);
      setPlayerMatchGenders(
        Object.fromEntries(
          match.bookings.map(b => [b.user_id, b.match_gender || null])
        )
      );

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

    const totalPlayers = selectedPlayers.length + guestBookings.length;
    if (totalPlayers > formData.maxPlayers) {
      newErrors.players = `Cannot have more than ${formData.maxPlayers} players (currently have ${selectedPlayers.length} registered + ${guestBookings.length} guests)`;
    }

    // Tournament validation
    if (formData.isTournament) {
      const totalRequired = formData.requiredLadies + formData.requiredLads;
      if (totalRequired > formData.maxPlayers) {
        newErrors.tournament = `Gender requirements (${formData.requiredLadies} ladies + ${formData.requiredLads} lads = ${totalRequired}) cannot exceed max players (${formData.maxPlayers})`;
      }
      if (totalRequired === 0) {
        newErrors.tournament = 'Tournaments must specify gender requirements';
      }
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
      // Check if we're marking the match as private and current user is not the creator
      const markingAsPrivate = formData.isPrivate && !match.is_private;
      const currentUser = await getCurrentUser();
      const isNotCreator = currentUser?.id !== match.created_by;

      // Calculate total cost from price per player
      const pricePerPlayer = formData.pricePerPlayer ? parseFloat(formData.pricePerPlayer) : undefined;
      const totalCost = pricePerPlayer ? pricePerPlayer * formData.maxPlayers : undefined;

      // Update match details
      await updateMatch(match.id, {
        title: formData.title || undefined,
        date: formData.date,
        time: formData.time,
        duration: formData.duration,
        max_players: formData.maxPlayers,
        location: formData.location,
        is_private: formData.isPrivate,
        is_tournament: formData.isTournament || undefined,
        required_level: formData.requiredLevel !== null ? formData.requiredLevel : undefined,
        required_ladies: formData.isTournament && formData.requiredLadies > 0 ? formData.requiredLadies : undefined,
        required_lads: formData.isTournament && formData.requiredLads > 0 ? formData.requiredLads : undefined,
        gender_requirement: formData.genderRequirement,
        price_per_player: pricePerPlayer,
        total_cost: totalCost,
        prize_first: formData.isTournament && formData.prizeFirst ? parseFloat(formData.prizeFirst) : undefined,
        prize_second: formData.isTournament && formData.prizeSecond ? parseFloat(formData.prizeSecond) : undefined,
        prize_third: formData.isTournament && formData.prizeThird ? parseFloat(formData.prizeThird) : undefined,
      });

      // Update players
      await updateMatchPlayers(match.id, selectedPlayers);

      setErrors({});
      onClose();

      // If admin marked someone else's match as private, navigate to matches list
      if (markingAsPrivate && isNotCreator) {
        navigate('/matches');
      } else {
        onSuccess();
      }
    } catch (error: any) {
      setErrors({ submit: error.message || 'Failed to update match' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddGuest = async () => {
    const totalPlayers = selectedPlayers.length + guestBookings.length;
    if (totalPlayers >= formData.maxPlayers) {
      alert('Match is full. Remove a player or increase max players to add guests.');
      return;
    }

    setAddingGuest(true);
    try {
      // Pass gender only for tournaments
      const gender = formData.isTournament ? newGuestGender : undefined;
      const newGuest = await createGuestBooking(match.id, newGuestName || undefined, gender);
      setGuestBookings([...guestBookings, newGuest]);
      setNewGuestName('');
      setNewGuestGender('female'); // Reset to default
      onSuccess(); // Refresh match data
    } catch (error: any) {
      alert('Failed to add guest: ' + error.message);
    } finally {
      setAddingGuest(false);
    }
  };

  const handleRemoveGuest = async (guestId: string) => {
    try {
      await deleteGuestBooking(guestId);
      setGuestBookings(guestBookings.filter(g => g.id !== guestId));
      onSuccess(); // Refresh match data
    } catch (error: any) {
      alert('Failed to remove guest: ' + error.message);
    }
  };

  const handleUpdateGuestGender = async (guestId: string, gender: 'female' | 'male' | 'rather_not_say' | null) => {
    try {
      await updateGuestBooking(guestId, { gender });
      setGuestBookings(guestBookings.map(g =>
        g.id === guestId ? { ...g, gender } : g
      ));
      onSuccess(); // Refresh match data
    } catch (error: any) {
      alert('Failed to update guest: ' + error.message);
    }
  };

  const togglePlayer = (userId: string) => {
    if (selectedPlayers.includes(userId)) {
      setSelectedPlayers(selectedPlayers.filter((id) => id !== userId));
    } else {
      // Check if adding a new player
      const totalPlayers = selectedPlayers.length + guestBookings.length;
      if (totalPlayers < formData.maxPlayers) {
        const player = allUsers.find(u => u.id === userId);
        if (player) {
          // Check if player meets the level requirement
          if (formData.requiredLevel !== null && formData.requiredLevel !== undefined) {
            const playerRanking = parseFloat(player.ranking || '0');
            if (playerRanking < formData.requiredLevel) {
              alert(`${player.name} does not meet the minimum ranking requirement of ${formatRanking(formData.requiredLevel)}. Their current ranking is ${formatRanking(player.ranking)}.`);
              return;
            }
          }

          // Check if player meets the gender requirement
          if (formData.genderRequirement && formData.genderRequirement !== 'all') {
            const playerGender = player.gender;
            if (formData.genderRequirement === 'male_only' && playerGender !== 'male') {
              alert(`${player.name} cannot be added. This match is for male players only.`);
              return;
            }
            if (formData.genderRequirement === 'female_only' && playerGender !== 'female') {
              alert(`${player.name} cannot be added. This match is for female players only.`);
              return;
            }
          }
        }
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

    // Check if user meets the level requirement
    if (formData.requiredLevel !== null && formData.requiredLevel !== undefined) {
      const userRanking = parseFloat(user.ranking || '0');
      if (userRanking < formData.requiredLevel) return false;
    }

    // Check if user meets the gender requirement
    if (formData.genderRequirement && formData.genderRequirement !== 'all') {
      const userGender = user.gender;
      if (formData.genderRequirement === 'male_only' && userGender !== 'male') return false;
      if (formData.genderRequirement === 'female_only' && userGender !== 'female') return false;
    }

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

          {/* Tournament Mode Toggle */}
          <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border-2 border-orange-200">
            <div className="flex-1">
              <label htmlFor="isTournament" className="block text-sm font-medium text-gray-900 cursor-pointer">
                Tournament Mode
              </label>
              <p className="text-xs text-gray-600 mt-1">
                Tournaments allow more players and require gender distribution (ladies/lads quotas).
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={formData.isTournament}
              onClick={() => {
                const newIsTournament = !formData.isTournament;
                const newMaxPlayers = newIsTournament ? Math.max(12, formData.maxPlayers) : Math.min(8, formData.maxPlayers);
                const half = Math.floor(newMaxPlayers / 2);
                setFormData({
                  ...formData,
                  isTournament: newIsTournament,
                  maxPlayers: newMaxPlayers,
                  requiredLadies: newIsTournament ? half : 0,
                  requiredLads: newIsTournament ? half : 0,
                });
              }}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                formData.isTournament ? 'bg-orange-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  formData.isTournament ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Max Players */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Maximum Players
            </label>
            {formData.isTournament ? (
              <input
                type="number"
                min="4"
                max="100"
                value={formData.maxPlayers}
                onChange={(e) => {
                  const newMax = parseInt(e.target.value) || 4;
                  const half = Math.floor(newMax / 2);
                  setFormData({
                    ...formData,
                    maxPlayers: newMax,
                    requiredLadies: half,
                    requiredLads: half,
                  });
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            ) : (
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
            )}
          </div>

          {/* Tournament Gender Requirements */}
          {formData.isTournament && (
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200 space-y-4">
              <div className="text-sm font-medium text-gray-900 mb-3">
                Gender Distribution
              </div>
              {errors.tournament && (
                <p className="text-sm text-red-600 mb-2">{errors.tournament}</p>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Required Ladies
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={formData.maxPlayers}
                    value={formData.requiredLadies}
                    onChange={(e) => setFormData({ ...formData, requiredLadies: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Required Lads
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={formData.maxPlayers}
                    value={formData.requiredLads}
                    onChange={(e) => setFormData({ ...formData, requiredLads: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Total: {formData.requiredLadies + formData.requiredLads} / {formData.maxPlayers} players
              </p>

              {/* Prize Money */}
              <div className="pt-4 border-t border-orange-300">
                <div className="text-sm font-medium text-gray-900 mb-3">
                  Prize Money 🏆
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      1st Place Prize (required)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.prizeFirst}
                        onChange={(e) => setFormData({ ...formData, prizeFirst: e.target.value })}
                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        2nd Place (optional)
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.prizeSecond}
                          onChange={(e) => setFormData({ ...formData, prizeSecond: e.target.value })}
                          className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        3rd Place (optional)
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.prizeThird}
                          onChange={(e) => setFormData({ ...formData, prizeThird: e.target.value })}
                          className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Player Level Requirement */}
          <div>
            <label htmlFor="requiredLevel" className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Player Level
            </label>
            <select
              id="requiredLevel"
              value={formData.requiredLevel === null ? '' : String(formData.requiredLevel)}
              onChange={(e) => setFormData({ ...formData, requiredLevel: e.target.value === '' ? null : parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {PLAYER_LEVELS.map((level) => (
                <option key={level.label} value={level.value === null ? '' : String(level.value)}>
                  {level.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Players at this level or above can join. Select "All Levels" to allow everyone.
            </p>
          </div>

          {/* Gender Requirement */}
          <div>
            <label htmlFor="genderRequirement" className="block text-sm font-medium text-gray-700 mb-2">
              Player Gender
            </label>
            <select
              id="genderRequirement"
              value={formData.genderRequirement}
              onChange={(e) => setFormData({ ...formData, genderRequirement: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="all">All Genders</option>
              <option value="male_only">Male Only</option>
              <option value="female_only">Female Only</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Select which genders can join this match.
            </p>
          </div>

          {/* Price Per Player */}
          <div>
            <label htmlFor="pricePerPlayer" className="block text-sm font-medium text-gray-700 mb-2">
              Price Per Player (optional)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                id="pricePerPlayer"
                step="0.01"
                min="0"
                value={formData.pricePerPlayer}
                onChange={(e) => setFormData({ ...formData, pricePerPlayer: e.target.value })}
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="0.00"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Enter the amount each player will pay.
            </p>
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
              Manage Players ({selectedPlayers.length + guestBookings.length}/{formData.maxPlayers})
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
                          {formatRanking(user.ranking)}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">Rank: {formatRanking(user.ranking)}</div>
                        {/* Show gender selector for tournament matches if user has 'rather_not_say' or null gender */}
                        {formData.isTournament && (!user.gender || user.gender === 'rather_not_say') && (
                          <div className="mt-2">
                            <label className="text-xs text-gray-600">Match Gender:</label>
                            <select
                              value={playerMatchGenders[user.id] || ''}
                              onChange={async (e) => {
                                const newGender = e.target.value as 'male' | 'female' | '';
                                const genderValue = newGender || null;

                                console.log('Updating match gender:', {
                                  matchId: match.id,
                                  userId: user.id,
                                  newGender: genderValue
                                });

                                // Update local state immediately
                                setPlayerMatchGenders(prev => ({
                                  ...prev,
                                  [user.id]: genderValue as 'male' | 'female' | null
                                }));

                                // Persist to database
                                try {
                                  await updateBookingMatchGender(
                                    match.id,
                                    user.id,
                                    genderValue
                                  );
                                  console.log('Match gender updated successfully');
                                } catch (error) {
                                  console.error('Failed to update match gender:', error);
                                  alert(`Failed to save gender: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                  // Revert local state on error
                                  setPlayerMatchGenders(prev => ({
                                    ...prev,
                                    [user.id]: match.bookings.find(b => b.user_id === user.id)?.match_gender || null
                                  }));
                                }
                              }}
                              className="ml-2 text-xs border border-gray-300 rounded px-2 py-1"
                            >
                              <option value="">Not Set</option>
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                            </select>
                          </div>
                        )}
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
            {(selectedPlayers.length + guestBookings.length) < formData.maxPlayers && (
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
                                {formatRanking(user.ranking)}
                              </div>
                            </div>
                            <div className="flex-1 text-left">
                              <div className="font-medium text-gray-900">{user.name}</div>
                              <div className="text-sm text-gray-500">Rank: {formatRanking(user.ranking)}</div>
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

          {/* Guest Players Management */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Guest Players
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Add guests who don't have an account. They'll count toward the total player limit.
            </p>

            {/* Current Guests */}
            {guestBookings.length > 0 && (
              <div className="mb-4 space-y-2">
                {guestBookings.map((guest) => (
                  <div
                    key={guest.id}
                    className="p-3 bg-purple-50 border-2 border-purple-200 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-200 flex items-center justify-center text-purple-700">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{guest.guest_name}</div>
                        <div className="text-sm text-gray-500">
                          Guest Player
                          {guest.gender && (
                            <span className="ml-2">
                              • {guest.gender === 'female' ? 'Female' : guest.gender === 'male' ? 'Male' : 'Rather not say'}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveGuest(guest.id)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Remove
                      </button>
                    </div>

                    {/* Gender selector for tournaments */}
                    {formData.isTournament && (
                      <div className="mt-3 pt-3 border-t border-purple-200">
                        <label className="block text-xs font-medium text-gray-700 mb-2">
                          Gender {!guest.gender && <span className="text-orange-600">(Required for tournaments)</span>}
                        </label>
                        <div className="flex gap-3">
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="radio"
                              name={`guest-gender-${guest.id}`}
                              value="female"
                              checked={guest.gender === 'female'}
                              onChange={() => handleUpdateGuestGender(guest.id, 'female')}
                              className="mr-2"
                            />
                            <span className="text-sm">Female</span>
                          </label>
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="radio"
                              name={`guest-gender-${guest.id}`}
                              value="male"
                              checked={guest.gender === 'male'}
                              onChange={() => handleUpdateGuestGender(guest.id, 'male')}
                              className="mr-2"
                            />
                            <span className="text-sm">Male</span>
                          </label>
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="radio"
                              name={`guest-gender-${guest.id}`}
                              value="rather_not_say"
                              checked={guest.gender === 'rather_not_say'}
                              onChange={() => handleUpdateGuestGender(guest.id, 'rather_not_say')}
                              className="mr-2"
                            />
                            <span className="text-sm">Rather not say</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add Guest */}
            {(selectedPlayers.length + guestBookings.length) < formData.maxPlayers && (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Guest name (optional)"
                  value={newGuestName}
                  onChange={(e) => setNewGuestName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddGuest();
                    }
                  }}
                />

                {/* Gender selector for tournaments */}
                {formData.isTournament && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Gender
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="guestGender"
                          value="female"
                          checked={newGuestGender === 'female'}
                          onChange={(e) => setNewGuestGender(e.target.value as 'female' | 'male' | 'rather_not_say')}
                          className="mr-2"
                        />
                        <span className="text-sm">Female</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="guestGender"
                          value="male"
                          checked={newGuestGender === 'male'}
                          onChange={(e) => setNewGuestGender(e.target.value as 'female' | 'male' | 'rather_not_say')}
                          className="mr-2"
                        />
                        <span className="text-sm">Male</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="guestGender"
                          value="rather_not_say"
                          checked={newGuestGender === 'rather_not_say'}
                          onChange={(e) => setNewGuestGender(e.target.value as 'female' | 'male' | 'rather_not_say')}
                          className="mr-2"
                        />
                        <span className="text-sm">Rather not say</span>
                      </label>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleAddGuest}
                  disabled={addingGuest}
                  className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingGuest ? 'Adding...' : '+ Add Guest'}
                </button>
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
