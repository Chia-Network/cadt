/**
 * Wallet health diagnostics for live API tests.
 *
 * Polls /health/wallet to provide:
 * - Rich diagnostic logging during blockchain waits
 * - Detection of stuck recovery (rejected txs that persist across polls)
 *
 * The CADT server handles rejected transactions internally via
 * createDataLayerStoreWithRetry and pushChangesWhenStoreIsAvailable.
 * Tests should NOT fast-fail on seeing rejected txs — they indicate
 * the server's recovery mechanism is active. Tests only fail fast
 * if the recovery appears stuck (same rejected txs for 2+ minutes).
 */

const RECOVERY_STUCK_THRESHOLD_MS = 120000; // 2 minutes

/**
 * Fetch wallet health from the /health/wallet endpoint.
 * Returns null on any failure (non-fatal).
 */
export const getWalletDiagnostics = async (request, apiVersion = 'v2') => {
  try {
    const res = await request.get(`/${apiVersion}/health/wallet`);
    if (res.status === 200 && res.body) {
      return res.body;
    }
  } catch {
    // Health endpoint unreachable — not fatal
  }
  return null;
};

/**
 * Extract rejected transaction IDs from a wallet health response.
 * Returns a sorted array of txId strings, or null if none.
 */
export const getRejectedTxIds = (walletHealth) => {
  if (!walletHealth) return null;
  const ids = [
    ...(walletHealth.standardWallet?.rejected || []),
    ...(walletHealth.dataLayerWallet?.rejected || []),
  ].map((tx) => tx.txId);
  return ids.length > 0 ? ids.sort() : null;
};

/**
 * Format a one-line wallet status summary for log output.
 */
export const formatWalletStatus = (walletHealth) => {
  if (!walletHealth) return 'wallet health unavailable';
  if (walletHealth.readOnly) return `synced: ${walletHealth.synced} (read-only)`;

  const parts = [`synced: ${walletHealth.synced}`];
  const sw = walletHealth.standardWallet;
  const dl = walletHealth.dataLayerWallet;

  if (sw) parts.push(`std: ${sw.unconfirmedCount} unconfirmed`);
  if (dl?.available) parts.push(`dl: ${dl.unconfirmedCount} unconfirmed`);

  const totalRejected =
    (sw?.rejected?.length || 0) + (dl?.rejected?.length || 0);
  const totalStuck = (sw?.stuck?.length || 0) + (dl?.stuck?.length || 0);

  if (totalRejected > 0) parts.push(`⚠ ${totalRejected} REJECTED (recovery in progress)`);
  if (totalStuck > 0) parts.push(`⏳ ${totalStuck} stuck`);

  return parts.join(', ');
};

/**
 * Stateful tracker that detects when rejected transactions persist
 * without being cleared by the server's recovery mechanism.
 *
 * Usage:
 *   const tracker = createRecoveryStuckTracker();
 *   // In poll loop:
 *   tracker.update(walletHealth);  // throws if stuck
 */
export const createRecoveryStuckTracker = () => {
  let lastRejectedKey = null;
  let firstSeenAt = null;

  return {
    /**
     * Update tracker with the latest wallet health.
     * Throws if the same rejected txs persist for > RECOVERY_STUCK_THRESHOLD_MS.
     */
    update(walletHealth) {
      const rejected = getRejectedTxIds(walletHealth);

      if (!rejected) {
        lastRejectedKey = null;
        firstSeenAt = null;
        return;
      }

      const key = rejected.join(',');

      if (key !== lastRejectedKey) {
        lastRejectedKey = key;
        firstSeenAt = Date.now();
        return;
      }

      const elapsed = Date.now() - firstSeenAt;
      if (elapsed > RECOVERY_STUCK_THRESHOLD_MS) {
        const details = [
          ...(walletHealth.standardWallet?.rejected || []),
          ...(walletHealth.dataLayerWallet?.rejected || []),
        ];
        throw new Error(
          `Transaction recovery appears stuck: ${rejected.length} rejected tx(s) ` +
          `have persisted for ${Math.round(elapsed / 1000)}s without being cleared. ` +
          `The server's auto-clear/retry mechanism may not be working.\n` +
          `Rejected: ${JSON.stringify(details, null, 2)}`,
        );
      }
    },
  };
};
