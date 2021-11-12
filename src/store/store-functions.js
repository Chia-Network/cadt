export const keyMirror = (...keys) => {
  return keys.reduce((obj, key) => ({...obj, [key]: key}), {});
};
