export function isPluralized(name) {
  if (name == null || typeof name !== 'string') return false;
  return name.endsWith('s');
}

// Anchored regex to prevent ReDoS: matches field:value:operator format
// The .+ in the middle is greedy but anchored regex prevents catastrophic backtracking
// Length validation (10000 chars) provides additional protection
export const genericFilterRegex = /^(\w+):(.+):(in|eq|not|lt|gt|lte|gte|like)$/;
// Safer regex: anchored to prevent catastrophic backtracking
// Matches strings that start with '[' and end with ']' with any content in between
export const isArrayRegex = /^\[.*\]$/;
// Anchored regex to prevent ReDoS: matches column:direction format
// Maximum reasonable length for order parameter is ~200 characters
export const genericSortColumnRegex = /^(\w+):(ASC|DESC)$/;
