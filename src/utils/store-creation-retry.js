import { ORG_CREATION_CONFIG } from './organization-creation-state.js';
import wallet from '../datalayer/wallet.js';

const { isTransientWalletError, isCoinShortageError } = wallet;

/**
 * Create one DataLayer store, retrying transient wallet errors.
 *
 * Coin shortages are retried on a time budget: with fewer spendable coins
 * than parallel creations, each creation waits for an earlier spend's change
 * to confirm, so scarce coins serialize the creations instead of failing
 * them. The budget must cover several block confirmations, hence time-based.
 * Other transient wallet errors keep an attempt-based budget.
 *
 * @param {string} storeType - Which store this creation is for (used in logs and the result)
 * @param {Object} deps
 * @param {() => Promise<string>} deps.createStore - Performs one creation attempt, resolves the store id
 * @param {(storeId: string) => Promise<void>} deps.persistStoreCreated - Persists incremental progress
 * @param {(message: string, level?: string) => void} deps.log - State-aware logger
 * @returns {Promise<{storeType: string, storeId: string|null, success: boolean, error?: string}>}
 */
export const createStoreWithRetryBudget = async (
  storeType,
  { createStore, persistStoreCreated, log },
) => {
  const retryDelayMs = ORG_CREATION_CONFIG.STORE_CREATE_RETRY_DELAY_MS;
  const maxAttempts = ORG_CREATION_CONFIG.STORE_CREATE_MAX_ATTEMPTS;
  const coinShortageDeadline =
    Date.now() + ORG_CREATION_CONFIG.COIN_SHORTAGE_RETRY_DEADLINE_MS;
  let transientAttempts = 0;

  for (let attempt = 1; ; attempt++) {
    try {
      log(`Creating ${storeType} store (attempt ${attempt})`);
      const storeId = await createStore();
      log(`Created ${storeType} store: ${storeId}`);
      try {
        // The persist call is wrapped in its own try so that a transient
        // persistence failure (DB busy, sequelize hiccup) does NOT mask a
        // successful on-chain store creation as a creation failure; the
        // caller reconciles any missing persist from the returned result.
        await persistStoreCreated(storeId);
      } catch (persistError) {
        log(
          `Created ${storeType} store ${storeId} but failed to persist incremental progress: ` +
            `${persistError.message}. Store id retained in result; final save will reconcile.`,
          'warn',
        );
      }
      return { storeType, storeId, success: true };
    } catch (error) {
      const retryable = isCoinShortageError(error)
        ? Date.now() + retryDelayMs < coinShortageDeadline
        : isTransientWalletError(error) && ++transientAttempts < maxAttempts;

      if (!retryable) {
        log(`Failed to create ${storeType} store: ${error.message}`, 'error');
        return {
          storeType,
          storeId: null,
          success: false,
          error: error.message,
        };
      }

      log(
        `Transient error creating ${storeType} store ` +
          `(attempt ${attempt}): ${error.message}. ` +
          `Retrying in ${retryDelayMs / 1000}s...`,
        'warn',
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
};
