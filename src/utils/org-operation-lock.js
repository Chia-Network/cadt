let currentOperation = null;
let currentStatus = null;
let startedAt = null;
let currentToken = null;
let tokenSeq = 0;

const MAX_LOCK_AGE_MS = 60 * 60 * 1000; // 1 hour

/**
 * Attempt to acquire the global org-operation lock.
 * @param {string} operationName - descriptive name for the operation
 * @returns {string|null} an opaque ownership token (truthy) on success, or null on failure
 */
export const tryAcquireOrgLock = (operationName) => {
  if (currentOperation) {
    const ageMs = Date.now() - new Date(startedAt).getTime();
    if (ageMs < MAX_LOCK_AGE_MS) {
      return null;
    }
    console.warn(
      `[org-operation-lock] Lock held by "${currentOperation}" for ${Math.round(ageMs / 1000)}s ` +
      `exceeded max age (${MAX_LOCK_AGE_MS / 1000}s). Force-releasing stale lock.`,
    );
  }
  const token = `orglock-${++tokenSeq}`;
  currentOperation = operationName;
  currentStatus = 'Starting...';
  startedAt = new Date().toISOString();
  currentToken = token;
  return token;
};

/**
 * Release the global org-operation lock.
 * When called with a token, only releases if the token matches the current holder
 * (prevents a stale .finally() from releasing a newer operation's lock).
 * When called without a token, releases unconditionally (for test cleanup only).
 * @param {string} [token] - the ownership token returned by tryAcquireOrgLock
 * @returns {boolean} true if the lock was released, false if the token didn't match
 */
export const releaseOrgLock = (token) => {
  if (token !== undefined && token !== currentToken) {
    return false;
  }
  currentOperation = null;
  currentStatus = null;
  startedAt = null;
  currentToken = null;
  return true;
};

export const updateOrgLockStatus = (status) => { currentStatus = status; };
export const getOrgLockOperation = () => currentOperation;
export const isOrgLocked = () => currentOperation !== null;

export const getOrgLockStatus = () => {
  if (!currentOperation) return null;
  const elapsedMs = Date.now() - new Date(startedAt).getTime();
  return {
    operation: currentOperation,
    status: currentStatus,
    startedAt,
    elapsedSeconds: Math.round(elapsedMs / 1000),
  };
};
