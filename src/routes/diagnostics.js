/**
 * System-wide /diagnostics endpoint builder.
 *
 * Returns a single JSON object summarizing CADT, Chia, DataLayer, and the
 * underlying machine. Designed to degrade gracefully when subsystems are
 * unreachable -- the whole point of a diagnostics endpoint is to be useful
 * when something is broken, so every external call is fenced behind
 * `Promise.allSettled` with a per-call timeout. The route never throws.
 *
 * In read-only mode the same shape is returned but with sensitive fields
 * (balances, transaction details, peer host details, subscription IDs,
 * home org IDs) stripped, matching the convention from wallet-health.js.
 */

import os from 'os';

import _ from 'lodash';

import { getConfig, getConfigV2 } from '../utils/config-loader.js';
import { getChiaRoot } from '../utils/chia-root.js';
import { getWalletHealthResponse } from './wallet-health.js';
import { getSystemInfo } from '../utils/system-info.js';
import { scanChiaProcesses } from '../utils/chia-process-scan.js';
import { probeChiaTools } from '../utils/chia-tools-probe.js';
import { logger } from '../config/logger.js';
import packageJson from '../../package.json' with { type: 'json' };

// Timeouts deliberately err on the generous side: /diagnostics is allowed to
// be slow if the goal is a comprehensive snapshot. A busy-but-healthy wallet
// (e.g. long-syncing while operators are debugging) regularly takes several
// seconds to answer get_wallet_balance, so tighter values would falsely flag
// healthy subsystems as broken. Worst-case wall-clock response is roughly
// max(DEFAULT_TIMEOUT_MS, SUBSCRIPTION_BUDGET_MS) ~= 30s when something
// upstream is wedged.
const DEFAULT_TIMEOUT_MS = 10000;
const SUBSCRIPTION_BUDGET_MS = 30000;
const SUBSCRIPTION_CONCURRENCY = 10;

/**
 * Run an async producer with a hard wall-clock timeout. The returned promise
 * always resolves -- success becomes `{ ok: true, value }`, failure or
 * timeout becomes `{ ok: false, error }`.
 */
const settle = async (label, producer, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  let timer;
  try {
    const timeoutPromise = new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    const value = await Promise.race([producer(), timeoutPromise]);
    return { ok: true, value };
  } catch (error) {
    logger.debug(`[diagnostics]: ${label} failed: ${error.message}`);
    return { ok: false, error: error.message };
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const readHomeOrgId = async (Model, getter = 'getHomeOrg') => {
  try {
    // includeAddress=false avoids a wallet RPC call inside getHomeOrg --
    // /diagnostics must keep working when the wallet is unreachable.
    const homeOrg = await Model[getter](false);
    if (!homeOrg) return null;
    // V1 uses `orgUid`, V2 uses `org_uid`
    return homeOrg.orgUid || homeOrg.org_uid || null;
  } catch (error) {
    logger.debug(`[diagnostics]: home org lookup failed: ${error.message}`);
    return null;
  }
};

/**
 * Resolve datalayer subscriptions plus per-store sync status, with overall
 * budget. Returns `{ available, subscriptions, truncated, totalSubscriptions }`.
 */
const collectSubscriptions = async (persistance) => {
  const startedAt = Date.now();
  let storeIds = [];
  let available = false;
  try {
    const result = await persistance.getSubscriptions();
    available = result.success === true;
    storeIds = result.storeIds || [];
  } catch (error) {
    logger.debug(`[diagnostics]: getSubscriptions failed: ${error.message}`);
    return { available: false, subscriptions: [], truncated: false, totalSubscriptions: 0 };
  }

  if (storeIds.length === 0) {
    return { available, subscriptions: [], truncated: false, totalSubscriptions: 0 };
  }

  const results = new Array(storeIds.length);
  let truncated = false;

  const processOne = async (storeId, index) => {
    if (Date.now() - startedAt >= SUBSCRIPTION_BUDGET_MS) {
      truncated = true;
      return;
    }
    try {
      const data = await persistance.getDataLayerStoreSyncStatus(storeId);
      const syncStatus = data?.sync_status;
      if (!syncStatus) {
        results[index] = { storeId, synced: null, error: 'no sync status returned' };
        return;
      }
      const { generation, target_generation: targetGeneration } = syncStatus;
      // Guard against generation/target_generation being undefined together,
      // which would otherwise compare equal and falsely report synced=true.
      const synced =
        Number.isFinite(generation) &&
        Number.isFinite(targetGeneration) &&
        generation === targetGeneration;
      results[index] = {
        storeId,
        synced,
        generation: generation ?? null,
        targetGeneration: targetGeneration ?? null,
      };
    } catch (error) {
      results[index] = { storeId, synced: null, error: error.message };
    }
  };

  // Bounded-concurrency worker pool.
  let nextIndex = 0;
  const worker = async () => {
    while (true) {
      const i = nextIndex++;
      if (i >= storeIds.length) return;
      if (Date.now() - startedAt >= SUBSCRIPTION_BUDGET_MS) {
        truncated = true;
        return;
      }
      await processOne(storeIds[i], i);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(SUBSCRIPTION_CONCURRENCY, storeIds.length) }, () => worker()),
  );

  const subscriptions = results.filter(Boolean);

  return {
    available,
    subscriptions,
    truncated,
    totalSubscriptions: storeIds.length,
  };
};

/**
 * Normalize a chia peer node_id for comparison: strip a leading 0x and
 * lowercase. Both the chia config's `wallet.trusted_peers` keys and the
 * `get_connections` RPC values are hex, but they differ on the 0x prefix
 * and case, so we have to normalize before comparing.
 */
const normalizeNodeId = (id) => {
  if (id == null) return '';
  const s = String(id).toLowerCase();
  return s.startsWith('0x') ? s.slice(2) : s;
};

/**
 * Cross-reference connected wallet peers against the trusted_peers map in
 * the chia config.yaml. Returns a small object suitable for embedding in
 * the diagnostics response, including whether at least one connection is
 * trusted.
 */
const buildTrustedPeerView = (connectionsResult, chiaConfigResult) => {
  const view = {
    configuredTrustedNodeIds: [],
    connected: [],
    hasTrustedConnection: false,
  };

  let normalizedTrustedSet = null;
  if (chiaConfigResult?.ok) {
    const trustedPeerMap = _.get(chiaConfigResult.value, 'wallet.trusted_peers', null);
    if (trustedPeerMap && typeof trustedPeerMap === 'object') {
      // trusted_peers is `{ <peer_node_id>: <cert_path or 'Does_not_matter'> }`
      // -- lowercase hex without 0x. We keep the node-id keys so callers can
      // spot misconfigurations.
      const keys = Object.keys(trustedPeerMap);
      view.configuredTrustedNodeIds = keys;
      normalizedTrustedSet = new Set(keys.map(normalizeNodeId));
    }
  } else if (chiaConfigResult) {
    view.chiaConfigError = chiaConfigResult.error;
  }

  if (connectionsResult?.ok) {
    const connections = connectionsResult.value?.connections || [];
    view.connected = connections.map((c) => {
      const trusted = !!(
        normalizedTrustedSet && normalizedTrustedSet.has(normalizeNodeId(c.nodeId))
      );
      if (trusted) view.hasTrustedConnection = true;
      return { peerHost: c.peerHost, peerPort: c.peerPort, type: c.type, trusted };
    });
  } else if (connectionsResult) {
    view.connectionsError = connectionsResult.error;
  }

  return view;
};

/**
 * Build the full /diagnostics response payload.
 *
 * Heavy module dependencies (database models, datalayer RPC clients) are
 * loaded dynamically so this file is safe to import from contexts where
 * those modules aren't ready yet (tests, early startup).
 *
 * In read-only mode we deliberately skip the expensive wallet/datalayer/
 * full-node RPC fan-out -- read-only ("public observer") deployments
 * should not be making per-request authenticated wallet RPC calls on
 * unauthenticated public hits. This matches the precedent in
 * src/routes/wallet-health.js, which also short-circuits before fetch.
 */
export const getDiagnosticsResponse = async ({ readOnly = false } = {}) => {
  const timestamp = new Date().toISOString();

  const configV1 = getConfig();
  const configV2 = getConfigV2();
  const appConfig = configV1.APP || {};

  // Short-circuit BEFORE pulling in the heavy wallet/datalayer/model
  // dependencies. The read-only path only needs system-info / process-scan /
  // chia-tools probes plus the synchronously-available config, so importing
  // wallet.js or models/v2/index.js here would (a) defeat the "no
  // authenticated RPC on unauthenticated public hits" property and (b)
  // make /diagnostics itself fail whenever the DB/wallet modules can't
  // initialize -- which is precisely the failure mode this endpoint exists
  // to diagnose.
  if (readOnly) {
    return buildReadOnlyResponse({ timestamp, configV1, configV2, appConfig });
  }

  const wallet = (await import('../datalayer/wallet.js')).default;
  const fullNodeRpc = (await import('../datalayer/fullNodeRpc.js')).default;
  const persistance = await import('../datalayer/persistance.js');
  const { Organization } = await import('../models/index.js');
  const { OrganizationsV2 } = await import('../models/v2/index.js');
  const fullNodeModule = await import('../datalayer/fullNode.js');

  // Kick off every external call in parallel. None of these can throw.
  const [
    activeNetworkRes,
    walletSyncedRes,
    walletBalanceRes,
    walletConnectionsRes,
    walletHealthRes,
    fullNodeStateRes,
    fullNodeConnectionsRes,
    chiaConfigRes,
    datalayerAvailableRes,
    subscriptionsRes,
    homeOrgV1Res,
    homeOrgV2Res,
    systemInfoRes,
    chiaProcessesRes,
    chiaToolsRes,
  ] = await Promise.all([
    settle('wallet.getActiveNetwork', () => wallet.getActiveNetwork(), DEFAULT_TIMEOUT_MS),
    settle('wallet.walletIsSynced', () => wallet.walletIsSynced(), DEFAULT_TIMEOUT_MS),
    settle('wallet.getWalletBalance', () => wallet.getWalletBalance(), DEFAULT_TIMEOUT_MS),
    settle('wallet.getWalletConnections', () => wallet.getWalletConnections(), DEFAULT_TIMEOUT_MS),
    settle(
      'getWalletHealthResponse',
      () => getWalletHealthResponse(wallet, { readOnly: false }),
      DEFAULT_TIMEOUT_MS,
    ),
    settle('fullNode.getBlockchainState', () => fullNodeRpc.getBlockchainState(), DEFAULT_TIMEOUT_MS),
    settle(
      'fullNode.getFullNodeConnections',
      () => fullNodeRpc.getFullNodeConnections(),
      DEFAULT_TIMEOUT_MS,
    ),
    settle('getChiaConfig', () => Promise.resolve(fullNodeModule.getChiaConfig()), 1000),
    settle('persistance.dataLayerAvailable', () => persistance.dataLayerAvailable(), DEFAULT_TIMEOUT_MS),
    settle(
      'collectSubscriptions',
      () => collectSubscriptions(persistance),
      SUBSCRIPTION_BUDGET_MS + 1000,
    ),
    settle('Organization.getHomeOrg', () => readHomeOrgId(Organization), DEFAULT_TIMEOUT_MS),
    settle('OrganizationsV2.getHomeOrg', () => readHomeOrgId(OrganizationsV2), DEFAULT_TIMEOUT_MS),
    settle('getSystemInfo', () => getSystemInfo(), DEFAULT_TIMEOUT_MS),
    settle('scanChiaProcesses', () => scanChiaProcesses(), DEFAULT_TIMEOUT_MS),
    settle('probeChiaTools', () => probeChiaTools(), DEFAULT_TIMEOUT_MS),
  ]);

  // walletReachable: derived from the get_network_info RPC return value, NOT
  // from settle().ok -- walletIsSynced and getWalletBalance both swallow
  // errors and return `false`, so settle().ok would be `true` even when the
  // wallet is unreachable. getActiveNetwork returns the response object on
  // success and literal `false` on any failure, so we use that as the
  // ground-truth reachability probe.
  const walletReachable = activeNetworkRes.ok && activeNetworkRes.value !== false;

  // lastWalletSyncError is a module-level slot in wallet.js that walletIsSynced
  // overwrites on every call. It's our best signal for the SPECIFIC connection
  // error (ECONNREFUSED, ETIMEDOUT, etc.) but it can be `null` if a
  // concurrent caller cleared it after our walletIsSynced returned. When the
  // wallet is unreachable but the slot is empty, we fall back to a synthetic
  // message so operators looking at the JSON always know unreachability is
  // distinct from "reachable but unsynced".
  const walletConnectionError = wallet.getLastWalletSyncError?.();

  const enableV1 = configV1?.ENABLE !== false;
  const enableV2 = configV2?.ENABLE !== false;
  const chiaRoot = getChiaRoot();

  // ---- CADT section -------------------------------------------------------
  const cadtSection = {
    version: packageJson.version,
    configDir: `${chiaRoot}/cadt`,
    configFile: `${chiaRoot}/cadt/config.yaml`,
    datalayerUrl: appConfig.DATALAYER_URL || null,
    datalayerFileServerUrl: appConfig.DATALAYER_FILE_SERVER_URL || null,
    walletRpcUrl: appConfig.WALLET_URL || null,
    useSimulator: appConfig.USE_SIMULATOR === true,
    databases: {
      v1: enableV1 ? `${chiaRoot}/cadt/v1/data.sqlite3` : null,
      v2: enableV2 ? `${chiaRoot}/cadt/v2/data.sqlite3` : null,
    },
    v1: {
      enabled: enableV1,
      readOnly: configV1.READ_ONLY === true,
      isGovernanceBody: configV1.IS_GOVERNANCE_BODY === true,
      apiKeyConfigured: !!(configV1.CADT_API_KEY && configV1.CADT_API_KEY !== ''),
      governanceBodyId: configV1.GOVERNANCE?.GOVERNANCE_BODY_ID || null,
      homeOrgId: homeOrgV1Res.ok ? homeOrgV1Res.value : null,
    },
    v2: {
      enabled: enableV2,
      readOnly: configV2.READ_ONLY === true,
      isGovernanceBody: configV2.IS_GOVERNANCE_BODY === true,
      apiKeyConfigured: !!(configV2.CADT_API_KEY && configV2.CADT_API_KEY !== ''),
      governanceBodyId: configV2.GOVERNANCE?.GOVERNANCE_BODY_ID || null,
      homeOrgId: homeOrgV2Res.ok ? homeOrgV2Res.value : null,
    },
  };

  // ---- Chia: network match ------------------------------------------------
  // CADT's CHIA_NETWORK config is a binary mainnet-vs-testnet flag, NOT an
  // exact chia network name. Cross-referenced against every use in the
  // codebase:
  //   - default is 'mainnet' (defaultConfig.js)
  //   - simulator forces it to the literal string 'testnet' (config-loader.js)
  //   - currency selection is `=== 'mainnet' ? 'XCH' : 'TXCH'` (coin-management.js)
  //   - the existing assertion accepts any chia network whose name contains
  //     CHIA_NETWORK as a substring (data-assertions.js)
  // So `mainnet` should match chia's `mainnet`, and `testnet` should match
  // any chia testnet variant (`testneta`, `testnet10`, `testnet11`, ...). We
  // normalise both sides to that binary before comparing -- this is both
  // strictly more correct than the substring rule (no `testnet1`/`testnet10`
  // false positive) and operationally aligned with how CADT itself decides
  // what to do.
  const actualNetwork = activeNetworkRes.ok
    ? activeNetworkRes.value?.network_name || null
    : null;
  const configuredNetwork = appConfig.CHIA_NETWORK || null;
  const normalizeChiaNetwork = (n) => (n === 'mainnet' ? 'mainnet' : 'testnet');
  const networkMatches =
    actualNetwork && configuredNetwork
      ? normalizeChiaNetwork(actualNetwork) === normalizeChiaNetwork(configuredNetwork)
      : null;

  // ---- Chia: wallet -------------------------------------------------------
  // connectionError is non-empty whenever the wallet is unreachable, even
  // for AggregateError-style failures whose `.message` is empty -- otherwise
  // an operator looking at the JSON can't tell "wallet is reachable but
  // unsynced" from "wallet RPC refused our connection".
  let walletConnectionErrorMessage = null;
  if (!walletReachable) {
    walletConnectionErrorMessage =
      walletConnectionError?.message ||
      `Wallet RPC at ${walletConnectionError?.walletRpcUrl || appConfig.WALLET_URL || 'configured URL'} did not respond`;
  }

  const walletSection = {
    rpcUrl: appConfig.WALLET_URL || null,
    reachable: walletReachable,
    connectionError: walletConnectionErrorMessage,
    synced: walletSyncedRes.ok ? walletSyncedRes.value === true : false,
    balanceXch:
      walletReachable && walletBalanceRes.ok && walletBalanceRes.value !== false
        ? walletBalanceRes.value
        : null,
    pendingTransactions: walletHealthRes.ok ? walletHealthRes.value : { error: walletHealthRes.error },
    trustedFullNodePeers: buildTrustedPeerView(walletConnectionsRes, chiaConfigRes),
  };

  // ---- Chia: full node ----------------------------------------------------
  const fullNodeSection = (() => {
    const base = fullNodeStateRes.ok
      ? fullNodeStateRes.value
      : { reachable: false, error: fullNodeStateRes.error };
    const connections = fullNodeConnectionsRes.ok
      ? fullNodeConnectionsRes.value
      : { reachable: false, error: fullNodeConnectionsRes.error };
    return {
      ...base,
      peerCount: connections.connections ? connections.connections.length : null,
      connectionsError: connections.error || null,
    };
  })();

  // ---- Chia: datalayer ---------------------------------------------------
  const datalayerSection = (() => {
    const reachable = datalayerAvailableRes.ok ? datalayerAvailableRes.value === true : false;
    const subscriptionsValue = subscriptionsRes.ok
      ? subscriptionsRes.value
      : { available: false, subscriptions: [], truncated: false, totalSubscriptions: 0, error: subscriptionsRes.error };
    return {
      rpcUrl: appConfig.DATALAYER_URL || null,
      reachable,
      subscriptions: subscriptionsValue.subscriptions,
      totalSubscriptions: subscriptionsValue.totalSubscriptions,
      truncated: subscriptionsValue.truncated,
      ...(subscriptionsValue.error ? { subscriptionsError: subscriptionsValue.error } : {}),
    };
  })();

  // ---- Chia: services / chia-tools / processes ---------------------------
  const servicesSection = {
    walletReachable,
    fullNodeReachable: fullNodeStateRes.ok ? !!fullNodeStateRes.value?.reachable : false,
    datalayerReachable: datalayerAvailableRes.ok ? datalayerAvailableRes.value === true : false,
  };

  const chiaToolsSection = chiaToolsRes.ok
    ? chiaToolsRes.value
    : { installed: false, version: null, error: chiaToolsRes.error, note: 'probe failed' };

  const processesSection = chiaProcessesRes.ok
    ? chiaProcessesRes.value
    : {
        supported: false,
        platform: os.platform(),
        matches: [],
        multipleVersionsDetected: false,
        error: chiaProcessesRes.error,
      };

  // ---- System -------------------------------------------------------------
  const systemSection = systemInfoRes.ok
    ? systemInfoRes.value
    : { error: systemInfoRes.error };

  // ---- Full response ------------------------------------------------------
  const fullResponse = {
    timestamp,
    readOnly: false,
    cadt: cadtSection,
    chia: {
      network: {
        actual: actualNetwork,
        configured: configuredNetwork,
        matches: networkMatches,
      },
      wallet: walletSection,
      fullNode: fullNodeSection,
      datalayer: datalayerSection,
      services: servicesSection,
      chiaTools: chiaToolsSection,
      processes: processesSection,
    },
    system: systemSection,
  };

  return fullResponse;
};

/**
 * Read-only diagnostics: only cheap, public-safe data. We short-circuit
 * BEFORE the wallet/datalayer/full-node RPC fan-out so a read-only
 * deployment doesn't make per-request authenticated wallet RPC calls on
 * unauthenticated public hits.
 */
const buildReadOnlyResponse = async ({ timestamp, configV1, configV2, appConfig }) => {
  const enableV1 = configV1?.ENABLE !== false;
  const enableV2 = configV2?.ENABLE !== false;
  const chiaRoot = getChiaRoot();

  const [systemInfoRes, chiaProcessesRes, chiaToolsRes] = await Promise.all([
    settle('getSystemInfo', () => getSystemInfo(), DEFAULT_TIMEOUT_MS),
    settle('scanChiaProcesses', () => scanChiaProcesses(), DEFAULT_TIMEOUT_MS),
    settle('probeChiaTools', () => probeChiaTools(), DEFAULT_TIMEOUT_MS),
  ]);

  const processesSection = chiaProcessesRes.ok
    ? chiaProcessesRes.value
    : { supported: false, matches: [], multipleVersionsDetected: false, error: chiaProcessesRes.error };
  const chiaToolsSection = chiaToolsRes.ok
    ? chiaToolsRes.value
    : { installed: false, version: null, error: chiaToolsRes.error };
  const systemSection = systemInfoRes.ok ? systemInfoRes.value : { error: systemInfoRes.error };

  return {
    timestamp,
    readOnly: true,
    message: 'Operational details are not available on read-only nodes',
    cadt: {
      version: packageJson.version,
      configDir: `${chiaRoot}/cadt`,
      configFile: `${chiaRoot}/cadt/config.yaml`,
      datalayerUrl: appConfig.DATALAYER_URL || null,
      datalayerFileServerUrl: appConfig.DATALAYER_FILE_SERVER_URL || null,
      useSimulator: appConfig.USE_SIMULATOR === true,
      v1: {
        enabled: enableV1,
        readOnly: configV1.READ_ONLY === true,
        isGovernanceBody: configV1.IS_GOVERNANCE_BODY === true,
        apiKeyConfigured: !!(configV1.CADT_API_KEY && configV1.CADT_API_KEY !== ''),
        governanceBodyId: configV1.GOVERNANCE?.GOVERNANCE_BODY_ID || null,
      },
      v2: {
        enabled: enableV2,
        readOnly: configV2.READ_ONLY === true,
        isGovernanceBody: configV2.IS_GOVERNANCE_BODY === true,
        apiKeyConfigured: !!(configV2.CADT_API_KEY && configV2.CADT_API_KEY !== ''),
        governanceBodyId: configV2.GOVERNANCE?.GOVERNANCE_BODY_ID || null,
      },
    },
    chia: {
      network: { configured: appConfig.CHIA_NETWORK || null },
      chiaTools: { installed: chiaToolsSection.installed, version: chiaToolsSection.version },
      processes: {
        supported: processesSection.supported,
        platform: processesSection.platform || null,
        multipleVersionsDetected: processesSection.multipleVersionsDetected,
      },
    },
    system: systemSection,
  };
};

export const __test = {
  settle,
  collectSubscriptions,
  buildTrustedPeerView,
  normalizeNodeId,
};
