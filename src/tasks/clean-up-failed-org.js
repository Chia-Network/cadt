import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Organization, Meta } from '../models';
import { getConfig } from '../utils/config-loader';
import { logger } from '../config/logger.js';
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

const CONFIG = getConfig().APP;

/**
 * Attempts to recover an in-progress V1 organization creation.
 * Will retry up to 3 times (MAX_RETRIES) before giving up.
 *
 * @returns {Promise<{success: boolean, message: string, orgUid?: string}>}
 */
const attemptRecovery = async () => {
  let state = await loadCreationState(Meta, 'v1');

  if (!state) {
    // No pending creation, check for orphaned PENDING record
    const pendingOrg = await Organization.findOne({
      where: { orgUid: 'PENDING' },
      raw: true,
    });

    if (pendingOrg) {
      logger.info('[v1]: [Recovery] Found orphaned PENDING record without state, cleaning up');
      await Organization.destroy({ where: { orgUid: 'PENDING' } });
      return { success: true, message: 'Cleaned up orphaned PENDING record' };
    }

    return { success: true, message: 'No pending organization creation to recover' };
  }

  // Check if creation is already complete or failed
  if (state.state === ORG_CREATION_STATES.COMPLETE) {
    logger.info('[v1]: [Recovery] Previous creation was complete, clearing state');
    await clearCreationState(Meta, 'v1');
    return { success: true, message: 'Previous creation was already complete' };
  }

  if (state.state === ORG_CREATION_STATES.FAILED) {
    logger.info('[v1]: [Recovery] Previous creation had failed, clearing state');
    await clearCreationState(Meta, 'v1');
    await Organization.destroy({ where: { orgUid: 'PENDING' } });
    return { success: false, message: `Previous creation failed: ${state.error}` };
  }

  // There's an in-progress creation - attempt to resume
  const status = getStatusSummary(state);
  logger.info(
    `[v1]: [Recovery] Found in-progress organization creation at ${status.progress}% - ${status.message}`,
  );

  // Increment retry count
  state = incrementRetryCount(state);
  await saveCreationState(state, Meta);

  if (hasExceededMaxRetries(state)) {
    logger.error(
      `[v1]: [Recovery] Organization creation has exceeded max retries (${ORG_CREATION_CONFIG.MAX_RETRIES}). Marking as failed.`,
    );
    state = markAsFailed(
      state,
      `Organization creation failed after ${ORG_CREATION_CONFIG.MAX_RETRIES} recovery attempts`,
    );
    await saveCreationState(state, Meta);
    await Organization.destroy({ where: { orgUid: 'PENDING' } });
    // Clear the failed state after recording it
    await clearCreationState(Meta, 'v1');
    return {
      success: false,
      message: `Organization creation failed after ${ORG_CREATION_CONFIG.MAX_RETRIES} recovery attempts`,
    };
  }

  logger.info(
    `[v1]: [Recovery] Attempting recovery (attempt ${state.retryCount}/${ORG_CREATION_CONFIG.MAX_RETRIES})`,
  );

  try {
    // Resume the creation - this will pick up from where it left off
    const orgUid = await Organization.createHomeOrganization(
      state.name,
      state.icon,
      state.dataVersion,
    );

    logger.info(`[v1]: [Recovery] Successfully recovered organization creation. orgUid: ${orgUid}`);
    return {
      success: true,
      message: 'Successfully recovered organization creation',
      orgUid,
    };
  } catch (error) {
    logger.error(`[v1]: [Recovery] Recovery attempt failed: ${error.message}`);

    // Check if we should try again or give up
    state = await loadCreationState(Meta, 'v1');
    if (state && hasExceededMaxRetries(state)) {
      logger.error('[v1]: [Recovery] Max retries exceeded after failed attempt. Giving up.');
      state = markAsFailed(state, `Recovery failed: ${error.message}`);
      await saveCreationState(state, Meta);
      await Organization.destroy({ where: { orgUid: 'PENDING' } });
      await clearCreationState(Meta, 'v1');
    }

    return {
      success: false,
      message: `Recovery attempt ${state?.retryCount || 'unknown'}/${ORG_CREATION_CONFIG.MAX_RETRIES} failed: ${error.message}`,
    };
  }
};

// Flag to track if task has already run
let hasRun = false;

const task = new Task('recover-org-creation-v1', async () => {
  // Only run once on startup
  if (hasRun) {
    logger.debug('[v1]: [Recovery] Skipping - recovery task has already run');
    return;
  }
  hasRun = true;

  logger.info('[v1]: [Recovery] Running startup recovery check for V1 organization creation');

  try {
    // Skip in simulator mode (organizations are created instantly)
    if (CONFIG.USE_SIMULATOR) {
      // Still clean up any PENDING records in simulator mode
      await Organization.destroy({ where: { orgUid: 'PENDING' } });
      await clearCreationState(Meta, 'v1');
      logger.debug('[v1]: [Recovery] Simulator mode - cleaned up any pending records');
      return;
    }

    const result = await attemptRecovery();
    logger.info(`[v1]: [Recovery] Result: ${result.message}`);
  } catch (error) {
    logger.error(
      `[v1]: [Recovery] Unexpected error during recovery: ${error.message}`,
    );
    // Clean up to prevent infinite loops
    try {
      await Organization.destroy({ where: { orgUid: 'PENDING' } });
      await clearCreationState(Meta, 'v1');
    } catch (cleanupError) {
      logger.error(`[v1]: [Recovery] Failed to clean up: ${cleanupError.message}`);
    }
  }
});

/**
 * V1 organization creation recovery task.
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
  { id: 'clean-up-failed-org', preventOverrun: true },
);

export default job;
