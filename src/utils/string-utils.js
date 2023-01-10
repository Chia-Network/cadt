export function isPluralized(name) {
  if (name == null || typeof name !== 'string') return false;
  return name.endsWith('s');
}

export const genericFilterRegex = /(\w+):(.+):(in|eq|not|lt|gt|lte|gte|like)/;
export const isArrayRegex = /\[.+\]/;
export const genericSortColumnRegex = /(\w+):(ASC|DESC)/;
