let currentOperation = null;
let currentStatus = null;
let startedAt = null;

const MAX_LOCK_AGE_MS = 60 * 60 * 1000; // 1 hour

export const tryAcquireOrgLock = (operationName) => {
  if (currentOperation) {
    const ageMs = Date.now() - new Date(startedAt).getTime();
    if (ageMs < MAX_LOCK_AGE_MS) {
      return false;
    }
    console.warn(
      `[org-operation-lock] Lock held by "${currentOperation}" for ${Math.round(ageMs / 1000)}s ` +
      `exceeded max age (${MAX_LOCK_AGE_MS / 1000}s). Force-releasing stale lock.`,
    );
  }
  currentOperation = operationName;
  currentStatus = 'Starting...';
  startedAt = new Date().toISOString();
  return true;
};

export const releaseOrgLock = () => {
  currentOperation = null;
  currentStatus = null;
  startedAt = null;
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
