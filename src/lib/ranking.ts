export function getRankingLevel(ranking: string): string {
  const rank = parseFloat(ranking);

  if (rank < 1.5) {
    return 'Beginner';
  } else if (rank >= 1.5 && rank < 2.5) {
    return 'High Beginner';
  } else if (rank >= 2.5 && rank < 4.0) {
    return 'Intermediate';
  } else if (rank >= 4.0 && rank < 5.0) {
    return 'High Intermediate';
  } else if (rank >= 5.0 && rank < 6.0) {
    return 'Advanced';
  } else if (rank >= 6.0 && rank <= 7.0) {
    return 'Pro / Elite';
  } else {
    return 'Unknown';
  }
}

export function getRankingColor(ranking: string): string {
  const rank = parseFloat(ranking);

  if (rank < 1.5) {
    return 'bg-gray-500'; // Beginner
  } else if (rank >= 1.5 && rank < 2.5) {
    return 'bg-green-500'; // High Beginner
  } else if (rank >= 2.5 && rank < 4.0) {
    return 'bg-blue-500'; // Intermediate
  } else if (rank >= 4.0 && rank < 5.0) {
    return 'bg-blue-600'; // High Intermediate
  } else if (rank >= 5.0 && rank < 6.0) {
    return 'bg-orange-500'; // Advanced
  } else if (rank >= 6.0 && rank <= 7.0) {
    return 'bg-purple-600'; // Pro / Elite
  } else {
    return 'bg-gray-500';
  }
}

export function validateRanking(ranking: string): { valid: boolean; message?: string } {
  const rank = parseFloat(ranking);

  if (isNaN(rank)) {
    return { valid: false, message: 'Please enter a valid number' };
  }

  if (rank < 0 || rank > 7.0) {
    return { valid: false, message: 'Ranking must be between 0.0 and 7.0' };
  }

  // Check if it has at most 2 decimal places
  const decimalPlaces = (ranking.split('.')[1] || '').length;
  if (decimalPlaces > 2) {
    return { valid: false, message: 'Maximum 2 decimal places allowed' };
  }

  return { valid: true };
}
