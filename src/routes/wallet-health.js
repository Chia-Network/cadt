/**
 * Build a wallet health diagnostic response.
 * Gracefully degrades if wallet or RPC is unreachable.
 *
 * When readOnly is true (public observer node), only sync status is returned
 * to avoid exposing transaction IDs, peer details, and wallet internals on
 * unauthenticated public endpoints.
 *
 * @param {Object} wallet - The wallet module from datalayer/wallet.js
 * @param {Object} [options]
 * @param {boolean} [options.readOnly=false] - If true, omit transaction details
 * @returns {Promise<Object>} Wallet health status
 */
export const getWalletHealthResponse = async (wallet, { readOnly = false } = {}) => {
  const timestamp = new Date().toISOString();

  let synced;
  try {
    synced = await wallet.walletIsSynced();
  } catch {
    synced = false;
  }

  if (readOnly) {
    return {
      synced,
      timestamp,
      readOnly: true,
      message: 'Transaction details are not available on read-only nodes',
    };
  }

  const formatTxSummary = (tx) => ({
    txId: truncateTxId(tx.name),
    age: wallet.formatDuration(tx.age),
    error: tx.rejectionReason || null,
  });

  const result = {
    synced,
    timestamp,
    standardWallet: {
      walletId: 1,
      unconfirmedCount: 0,
      rejected: [],
      stuck: [],
    },
    dataLayerWallet: {
      walletId: null,
      available: false,
      unconfirmedCount: 0,
      rejected: [],
      stuck: [],
    },
  };

  // Standard wallet (id 1)
  try {
    const health = await wallet.getTransactionHealth('1');
    result.standardWallet.unconfirmedCount =
      health.rejected.length + health.inMempool.length + health.pending.length;
    result.standardWallet.rejected = health.rejected.map(formatTxSummary);
    result.standardWallet.stuck = [
      ...health.inMempool.filter((tx) => tx.age && tx.age > 900),
      ...health.pending.filter((tx) => tx.age && tx.age > 900),
    ].map(formatTxSummary);
  } catch {
    result.standardWallet.error = 'Could not retrieve standard wallet health';
  }

  // DataLayer wallet
  try {
    const dlWalletId = await wallet.getDLWalletId();
    if (dlWalletId) {
      result.dataLayerWallet.walletId = Number(dlWalletId);
      result.dataLayerWallet.available = true;

      const health = await wallet.getTransactionHealth(dlWalletId);
      result.dataLayerWallet.unconfirmedCount =
        health.rejected.length + health.inMempool.length + health.pending.length;
      result.dataLayerWallet.rejected = health.rejected.map(formatTxSummary);
      result.dataLayerWallet.stuck = [
        ...health.inMempool.filter((tx) => tx.age && tx.age > 900),
        ...health.pending.filter((tx) => tx.age && tx.age > 900),
      ].map(formatTxSummary);
    }
  } catch {
    result.dataLayerWallet.error = 'Could not retrieve DataLayer wallet health';
  }

  return result;
};

const truncateTxId = (txId) => {
  if (!txId || txId.length <= 16) return txId;
  return `${txId.slice(0, 10)}...${txId.slice(-4)}`;
};
