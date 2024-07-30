export function isPluralized(name) {
  if (name == null || typeof name !== 'string') return false;
  return name.endsWith('s');
}

export const genericFilterRegex = /(\w+):(.+):(in|eq|not|lt|gt|lte|gte|like)/;
export const isArrayRegex = /\[.+\]/;
export const genericSortColumnRegex = /(\w+):(ASC|DESC)/;

/**
 * uses levenshtein distance to determine the best fuzzy match to a string out of an array of candidates
 * @param target string to match
 * @param candidates array of strings to try to match to the target
 * @returns {{candidate: string, distance: number, percentMatch: number}}
 */
export function fuzzyStringMatch(target, candidates) {
  if (!candidates?.forEach) {
    candidates = [candidates];
  }

  const bestMatch = { candidate: '', distance: Infinity, percentMatch: 0 };
  candidates.forEach((candidate) => {
    const distance = levenshteinDistance(target, candidate);
    const percentMatch =
      distance > target.length
        ? 0
        : 1 - (distance / target.length ? target.length : 1) * 100;
    if (distance < bestMatch.distance) {
      bestMatch.candidate = candidate;
      bestMatch.distance = distance;
      bestMatch.percentMatch = percentMatch;
    }
  });
  return bestMatch;
}

export function levenshteinDistance(string1, string2) {
  if (!string1.length) return string2.length;
  if (!string2.length) return string1.length;

  const matrix = [];

  let i;
  for (i = 0; i <= string2.length; i++) {
    matrix[i] = [i];
  }

  let j;
  for (j = 0; j <= string1.length; j++) {
    matrix[0][j] = j;
  }

  for (i = 1; i <= string2.length; i++) {
    for (j = 1; j <= string1.length; j++) {
      if (string2.charAt(i - 1) === string1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1),
        );
      }
    }
  }

  return matrix[string2.length][string1.length];
}
