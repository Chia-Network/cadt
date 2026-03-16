import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { OrganizationsV2, MetaV2 } from '../models/v2/index.js';
import { getConfig } from '../utils/config-loader.js';
import { loggerV2 } from '../config/logger.js';
import {
  ORG_CREATION_STATES,
  ORG_CREATION_CONFIG,
  loadCreationState,
  saveCreationState,
  clearCreationState,
  incrementRetryCount,
  hasExceededMaxRetries,
  markAsFailed,
  getStatusSummary,
} from '../utils/organization-creation-state.js';
import { tryAcquireOrgLock, releaseOrgLock } from '../utils/org-operation-lock.js';

const CONFIG = getConfig().APP;

/**
 * Attempts to recover an in-progress V2 organization creation.
 * Will retry up to 3 times (MAX_RETRIES) before giving up.
 *
 * @returns {Promise<{success: boolean, message: string, orgUid?: string}>}
 */
const attemptRecovery = async () => {
  let state = await loadCreationState(MetaV2, 'v2');

  if (!state) {
    // No pending creation, check for orphaned PENDING record
    const pendingOrg = await OrganizationsV2.findOne({
      where: { org_uid: 'PENDING' },
      raw: true,
    });

    if (pendingOrg) {
      loggerV2.info('[v2]: [Recovery] Found orphaned PENDING record without state, cleaning up');
      await OrganizationsV2.destroy({ where: { org_uid: 'PENDING' } });
      return { success: true, message: 'Cleaned up orphaned PENDING record' };
    }

    return { success: true, message: 'No pending organization creation to recover' };
  }

  // Check if creation is already complete or failed
  if (state.state === ORG_CREATION_STATES.COMPLETE) {
    loggerV2.info('[v2]: [Recovery] Previous creation was complete, clearing state');
    await clearCreationState(MetaV2, 'v2');
    return { success: true, message: 'Previous creation was already complete' };
  }

  if (state.state === ORG_CREATION_STATES.FAILED) {
    loggerV2.info('[v2]: [Recovery] Previous creation had failed, clearing state');
    await clearCreationState(MetaV2, 'v2');
    await OrganizationsV2.destroy({ where: { org_uid: 'PENDING' } });
    return { success: false, message: `Previous creation failed: ${state.error}` };
  }

  // There's an in-progress creation - attempt to resume
  const status = getStatusSummary(state);
  loggerV2.info(
    `[v2]: [Recovery] Found in-progress organization creation at ${status.progress}% - ${status.message}`,
  );

  // Increment retry count
  state = incrementRetryCount(state);
  await saveCreationState(state, MetaV2);

  if (hasExceededMaxRetries(state)) {
    loggerV2.error(
      `[v2]: [Recovery] Organization creation has exceeded max retries (${ORG_CREATION_CONFIG.MAX_RETRIES}). Marking as failed.`,
    );
    state = markAsFailed(
      state,
      `Organization creation failed after ${ORG_CREATION_CONFIG.MAX_RETRIES} recovery attempts`,
    );
    await saveCreationState(state, MetaV2);
    await OrganizationsV2.destroy({ where: { org_uid: 'PENDING' } });
    // Clear the failed state after recording it
    await clearCreationState(MetaV2, 'v2');
    return {
      success: false,
      message: `Organization creation failed after ${ORG_CREATION_CONFIG.MAX_RETRIES} recovery attempts`,
    };
  }

  loggerV2.info(
    `[v2]: [Recovery] Attempting recovery (attempt ${state.retryCount}/${ORG_CREATION_CONFIG.MAX_RETRIES})`,
  );

  const token = tryAcquireOrgLock('V2 organization recovery');
  if (!token) {
    loggerV2.warn('[v2]: [Recovery] Cannot acquire lock - another operation is in progress');
    return { success: false, message: 'Cannot acquire lock for recovery' };
  }

  try {
    const orgUid = await OrganizationsV2.createHomeOrganization(
      state.name,
      state.icon,
      state.dataVersion,
      token,
    );

    loggerV2.info(`[v2]: [Recovery] Successfully recovered organization creation. orgUid: ${orgUid}`);
    return {
      success: true,
      message: 'Successfully recovered organization creation',
      orgUid,
    };
  } catch (error) {
    loggerV2.error(`[v2]: [Recovery] Recovery attempt failed: ${error.message}`);

    state = await loadCreationState(MetaV2, 'v2');
    if (state && hasExceededMaxRetries(state)) {
      loggerV2.error('[v2]: [Recovery] Max retries exceeded after failed attempt. Giving up.');
      state = markAsFailed(state, `Recovery failed: ${error.message}`);
      await saveCreationState(state, MetaV2);
      await OrganizationsV2.destroy({ where: { org_uid: 'PENDING' } });
      await clearCreationState(MetaV2, 'v2');
    }

    return {
      success: false,
      message: `Recovery attempt ${state?.retryCount || 'unknown'}/${ORG_CREATION_CONFIG.MAX_RETRIES} failed: ${error.message}`,
    };
  } finally {
    releaseOrgLock(token);
  }
};

// Flag to track if task has already run
let hasRun = false;

const task = new Task('recover-org-creation-v2', async () => {
  // Only run once on startup
  if (hasRun) {
    loggerV2.debug('[v2]: [Recovery] Skipping - recovery task has already run');
    return;
  }
  hasRun = true;

  loggerV2.info('[v2]: [Recovery] Running startup recovery check for V2 organization creation');

  try {
    // Skip in simulator mode (organizations are created instantly)
    if (CONFIG.USE_SIMULATOR) {
      // Still clean up any PENDING records in simulator mode
      await OrganizationsV2.destroy({ where: { org_uid: 'PENDING' } });
      await clearCreationState(MetaV2, 'v2');
      loggerV2.debug('[v2]: [Recovery] Simulator mode - cleaned up any pending records');
      return;
    }

    const result = await attemptRecovery();
    loggerV2.info(`[v2]: [Recovery] Result: ${result.message}`);
  } catch (error) {
    loggerV2.error(
      `[v2]: [Recovery] Unexpected error during recovery: ${error.message}`,
    );
    // Clean up to prevent infinite loops
    try {
      await OrganizationsV2.destroy({ where: { org_uid: 'PENDING' } });
      await clearCreationState(MetaV2, 'v2');
    } catch (cleanupError) {
      loggerV2.error(`[v2]: [Recovery] Failed to clean up: ${cleanupError.message}`);
    }
  }
});

/**
 * V2 organization creation recovery task.
 *
 * This task runs once on startup to check for and recover any interrupted
 * organization creation processes. It will:
 *
 * 1. Check if there's a pending organization creation state
 * 2. If found, attempt to resume the creation
 * 3. Retry up to 3 times before giving up
 * 4. Clean up any orphaned PENDING records
 *
 * The task only runs once on startup (not periodically) to avoid interfering
 * with normal operations.
 *
 * @type {SimpleIntervalJob}
 */
const job = new SimpleIntervalJob(
  {
    // Set to 7 days (within toad-scheduler's ~24.85 day limit)
    // The hasRun flag prevents subsequent runs anyway
    days: 7,
    runImmediately: true,
  },
  task,
  { id: 'clean-up-failed-org-v2', preventOverrun: true },
);

export default job;
