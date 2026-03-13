let currentOperation = null;
let currentStatus = null;
let startedAt = null;

export const tryAcquireOrgLock = (operationName) => {
  if (currentOperation) return false;
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
