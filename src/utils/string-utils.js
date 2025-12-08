export function isPluralized(name) {
  if (name == null || typeof name !== 'string') return false;
  return name.endsWith('s');
}

export const genericFilterRegex = /(\w+):(.+):(in|eq|not|lt|gt|lte|gte|like)/;
// Safer regex: anchored to prevent catastrophic backtracking
// Matches strings that start with '[' and end with ']' with any content in between
export const isArrayRegex = /^\[.*\]$/;
export const genericSortColumnRegex = /(\w+):(ASC|DESC)/;
