export const getRateLimitRetryAfterSeconds = (resetTime, now = Date.now()) => {
  if (!(resetTime instanceof Date)) {
    return 0;
  }

  const resetTimestamp = resetTime.getTime();
  if (Number.isNaN(resetTimestamp)) {
    return 0;
  }

  return Math.max(0, Math.ceil((resetTimestamp - now) / 1000));
};
