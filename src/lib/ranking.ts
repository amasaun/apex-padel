export function getRankingLevel(ranking: string): string {
  const rank = parseFloat(ranking);

  if (rank < 1.0) {
    return 'Initiation';
  } else if (rank >= 1.0 && rank <= 1.49) {
    return 'Beginner';
  } else if (rank >= 1.5 && rank <= 2.4) {
    return 'Initiation Intermediate';
  } else if (rank >= 2.5 && rank <= 3.4) {
    return 'Intermediate';
  } else if (rank >= 3.5 && rank <= 4.4) {
    return 'Intermediate High';
  } else if (rank >= 4.5 && rank <= 5.3) {
    return 'Intermediate Advanced';
  } else if (rank >= 5.4 && rank <= 5.9) {
    return 'Competition';
  } else if (rank >= 6.0 && rank <= 7.0) {
    return 'Professional';
  } else {
    return 'Unknown';
  }
}

export function getRankingColor(ranking: string): string {
  const rank = parseFloat(ranking);

  if (rank < 1.0) {
    return 'bg-gray-500'; // Initiation
  } else if (rank >= 1.0 && rank <= 1.49) {
    return 'bg-green-500'; // Beginner
  } else if (rank >= 1.5 && rank <= 2.4) {
    return 'bg-green-600'; // Initiation Intermediate
  } else if (rank >= 2.5 && rank <= 3.4) {
    return 'bg-blue-500'; // Intermediate
  } else if (rank >= 3.5 && rank <= 4.4) {
    return 'bg-blue-600'; // Intermediate High
  } else if (rank >= 4.5 && rank <= 5.3) {
    return 'bg-orange-500'; // Intermediate Advanced
  } else if (rank >= 5.4 && rank <= 5.9) {
    return 'bg-orange-600'; // Competition
  } else if (rank >= 6.0 && rank <= 7.0) {
    return 'bg-purple-600'; // Professional
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
