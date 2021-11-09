export const keyMirror = (...keys) =>
  keys.reduce((obj, key) => ({ ...obj, [key]: key }), {});
