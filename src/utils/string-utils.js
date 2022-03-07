export function isPluralized(name) {
  if (name == null || typeof name !== 'string') return false;
  return name.endsWith('s');
}
