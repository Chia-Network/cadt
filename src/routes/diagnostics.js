/**
 * System-wide /diagnostics endpoint builder.
 *
 * Returns a single JSON object summarizing CADT, Chia, DataLayer, and the
 * underlying machine. Designed to degrade gracefully when subsystems are
 * unreachable -- the whole point of a diagnostics endpoint is to be useful
 * when something is broken, so every external call is fenced behind
 * `Promise.allSettled` with a per-call timeout. The route never throws.
 *
 * The endpoint is disabled entirely in read-only mode (handled by
 * middleware returning 403), so there is no reduced-information path.
 */

import _ from 'lodash';

import { getConfig, getConfigV2 } from '../utils/config-loader.js';
import { getChiaRoot } from '../utils/chia-root.js';
import { getWalletHealthResponse } from './wallet-health.js';
import { getSystemInfo } from '../utils/system-info.js';
import { scanChiaProcesses } from '../utils/chia-process-scan.js';
import { probeChiaTools } from '../utils/chia-tools-probe.js';
import { logger } from '../config/logger.js';
import packageJson from '../../package.json' with { type: 'json' };

/**
 * Accumulates a worst-case status across multiple checks.  Severity only
 * escalates: ok → warning → critical.  Messages are joined with two-space
 * separation into a single string.
 */
class StatusAccumulator {
  static #levels = { ok: 0, warning: 1, critical: 2 };
  static #names = ['ok', 'warning', 'critical'];

  #level = 0;
  #messages = [];

  escalate(severity, message) {
    const target = StatusAccumulator.#levels[severity];
    if (target === undefined) throw new Error(`unknown severity: ${severity}`);
    if (target > this.#level) this.#level = target;
    if (message) this.#messages.push(message);
  }

  result() {
    const status = StatusAccumulator.#names[this.#level];
    if (this.#messages.length === 0) return { status };
    return { status, message: this.#messages.join('  ') };
  }
}

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

  if (connectionsResult?.ok && connectionsResult.value?.success !== false) {
    const connections = connectionsResult.value?.connections || [];
    view.connected = connections.map((c) => {
      const trusted = !!(
        normalizedTrustedSet && normalizedTrustedSet.has(normalizeNodeId(c.nodeId))
      );
      if (trusted) view.hasTrustedConnection = true;
      return { peerHost: c.peerHost, peerPort: c.peerPort, type: c.type, trusted };
    });
  } else if (connectionsResult) {
    view.connectionsError = connectionsResult.ok
      ? connectionsResult.value?.error || 'wallet connections unavailable'
      : connectionsResult.error;
  }

  return view;
};

/**
 * Build the full /diagnostics response payload.
 *
 * Heavy module dependencies (database models, datalayer RPC clients) are
 * loaded dynamically so this file is safe to import from contexts where
 * those modules aren't ready yet (tests, early startup).
 */
export const getDiagnosticsResponse = async () => {
  const timestamp = new Date().toISOString();

  const configV1 = getConfig();
  const configV2 = getConfigV2();
  const appConfig = configV1.APP || {};

  const wallet = (await import('../datalayer/wallet.js')).default;
  const fullNodeRpc = (await import('../datalayer/fullNodeRpc.js')).default;
  const persistance = await import('../datalayer/persistance.js');
  const { Organization } = await import('../models/index.js');
  const { OrganizationsV2 } = await import('../models/v2/index.js');
  const fullNodeModule = await import('../datalayer/fullNode.js');

  // Phase 1: fast local probes (process scan, system info, chia-tools).
  // We need the process scan result before deciding whether to probe the
  // full node RPC, so these run first.
  const [chiaProcessesRes, systemInfoRes, chiaToolsRes] = await Promise.all([
    settle('scanChiaProcesses', () => scanChiaProcesses(), DEFAULT_TIMEOUT_MS),
    settle('getSystemInfo', () => getSystemInfo(), DEFAULT_TIMEOUT_MS),
    settle('probeChiaTools', () => probeChiaTools(), DEFAULT_TIMEOUT_MS),
  ]);

  const processesValue = chiaProcessesRes.ok
    ? chiaProcessesRes.value
    : { matches: [], installPaths: [], multipleVersionsDetected: false, error: chiaProcessesRes.error };

  // If the scan succeeded and found processes, check for chia_full_node.
  // If the scan failed or is unsupported (Windows, minimal Docker image
  // without ps, /proc restrictions), we can't tell whether the full node
  // is running, so default to true and let the RPC timeout be the backstop.
  const scanReliable = chiaProcessesRes.ok && !processesValue.note && !processesValue.error;
  const fullNodeRunningLocally = scanReliable
    ? processesValue.matches.some((m) => /chia_full_node/i.test(m.command))
    : true;

  // Phase 2: network RPCs in parallel. Full-node RPCs are skipped when the
  // process scan shows no local full node — the calls would just timeout or
  // ECONNREFUSED, wasting wall-clock for no diagnostic value.
  const rpcSettles = [
    settle('wallet.getActiveNetwork', () => wallet.getActiveNetwork(), DEFAULT_TIMEOUT_MS),
    settle('wallet.getChiaVersion', () => wallet.getChiaVersion(), DEFAULT_TIMEOUT_MS),
    settle('wallet.getWalletBalance', () => wallet.getWalletBalance(), DEFAULT_TIMEOUT_MS),
    settle('wallet.getWalletConnections', () => wallet.getWalletConnections(), DEFAULT_TIMEOUT_MS),
    settle(
      'getWalletHealthResponse',
      () => getWalletHealthResponse(wallet, { readOnly: false }),
      DEFAULT_TIMEOUT_MS,
    ),
    fullNodeRunningLocally
      ? settle('fullNode.getBlockchainState', () => fullNodeRpc.getBlockchainState(), DEFAULT_TIMEOUT_MS)
      : Promise.resolve({ ok: false, error: 'full node not running locally' }),
    fullNodeRunningLocally
      ? settle('fullNode.getFullNodeConnections', () => fullNodeRpc.getFullNodeConnections(), DEFAULT_TIMEOUT_MS)
      : Promise.resolve({ ok: false, error: 'full node not running locally' }),
    settle('getChiaConfig', () => Promise.resolve(fullNodeModule.getChiaConfig()), 1000),
    settle('persistance.dataLayerAvailable', () => persistance.dataLayerAvailable(), DEFAULT_TIMEOUT_MS),
    settle(
      'collectSubscriptions',
      () => collectSubscriptions(persistance),
      SUBSCRIPTION_BUDGET_MS + 1000,
    ),
    settle('Organization.getHomeOrg', () => readHomeOrgId(Organization), DEFAULT_TIMEOUT_MS),
    settle('OrganizationsV2.getHomeOrg', () => readHomeOrgId(OrganizationsV2), DEFAULT_TIMEOUT_MS),
  ];

  const [
    activeNetworkRes,
    chiaVersionRes,
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
  ] = await Promise.all(rpcSettles);

  // walletReachable: derived from the get_network_info RPC return value, NOT
  // from settle().ok -- walletIsSynced and getWalletBalance both swallow
  // errors and return `false`, so settle().ok would be `true` even when the
  // wallet is unreachable. getActiveNetwork returns the response object on
  // success and literal `false` on any failure, so we use that as the
  // ground-truth reachability probe.
  const walletReachable = activeNetworkRes.ok && activeNetworkRes.value !== false;

  // walletIsSynced() is called internally by getWalletHealthResponse, which
  // populates the module-level lastWalletSyncError slot. We read it here for
  // the specific error message (ECONNREFUSED, ETIMEDOUT, etc.) and fall back
  // to a synthetic message when the slot is empty.
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
    synced: walletHealthRes.ok ? walletHealthRes.value?.synced === true : false,
    balanceXch:
      walletReachable && walletBalanceRes.ok && walletBalanceRes.value !== false
        ? walletBalanceRes.value
        : null,
    pendingTransactions: walletHealthRes.ok ? walletHealthRes.value : { error: walletHealthRes.error },
    trustedFullNodePeers: buildTrustedPeerView(walletConnectionsRes, chiaConfigRes),
  };

  // ---- Chia: full node ----------------------------------------------------
  const fullNodeSection = (() => {
    if (!fullNodeRunningLocally) {
      return { runningLocally: false, reachable: false };
    }
    const base = fullNodeStateRes.ok
      ? fullNodeStateRes.value
      : { reachable: false, error: fullNodeStateRes.error };
    const connections = fullNodeConnectionsRes.ok
      ? fullNodeConnectionsRes.value
      : { reachable: false, error: fullNodeConnectionsRes.error };
    return {
      runningLocally: true,
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

  // ---- Chia: chia-tools / processes ---------------------------------------
  const chiaToolsSection = chiaToolsRes.ok
    ? chiaToolsRes.value
    : { installed: false, version: null, error: chiaToolsRes.error, note: 'probe failed' };

  // ---- System -------------------------------------------------------------
  const systemSection = systemInfoRes.ok
    ? systemInfoRes.value
    : { error: systemInfoRes.error };

  // ---- Status computation -------------------------------------------------

  // Precompute process-running booleans for status checks below.
  const chiaRunningLocally = processesValue.matches.some(
    (m) => /chia_/i.test(m.command),
  );
  const fullNodeProcessRunning = processesValue.matches.some(
    (m) => /chia_full_node/i.test(m.command),
  );
  const dlProcessRunning = processesValue.matches.some(
    (m) => /chia_data_layer/i.test(m.command),
  );
  const walletProcessRunning = processesValue.matches.some(
    (m) => /chia_wallet/i.test(m.command),
  );

  // system.disk
  if (systemSection.disk) {
    const diskStatus = new StatusAccumulator();
    const pct = systemSection.disk.percentUsed;
    if (pct != null) {
      if (pct > 96) diskStatus.escalate('critical', 'Disk usage above 96%');
      else if (pct > 90) diskStatus.escalate('warning', 'Disk usage above 90%');
    }
    Object.assign(systemSection.disk, diskStatus.result());
  }

  // system.memory
  if (systemSection.memory) {
    const memStatus = new StatusAccumulator();
    const pct = systemSection.memory.percentUsed;
    if (pct != null) {
      if (pct > 99) memStatus.escalate('critical', 'Memory usage above 99%');
      else if (pct > 90) memStatus.escalate('warning', 'Memory usage above 90%');
    }
    Object.assign(systemSection.memory, memStatus.result());
  }

  // system.cpu
  if (systemSection.cpu) {
    const cpuStatus = new StatusAccumulator();
    const cores = systemSection.cpu.cores;
    if (cores != null && chiaRunningLocally) {
      const msg =
        'Both CADT and Chia are heavy on CPU and a 4 core or greater system is recommended when running them together';
      if (cores === 1) cpuStatus.escalate('critical', msg);
      else if (cores < 4) cpuStatus.escalate('warning', msg);
    } else if (cores != null) {
      if (cores === 1) {
        cpuStatus.escalate(
          'warning',
          'CADT can often use 100% of a single CPU core, so a 2 core or greater system is recommended when running CADT by itself',
        );
      }
    }
    Object.assign(systemSection.cpu, cpuStatus.result());
  }

  // chiaTools
  {
    const ctStatus = new StatusAccumulator();
    if (!chiaToolsSection.installed) {
      ctStatus.escalate('warning', 'chia-tools is recommended to help manage Chia');
    }
    Object.assign(chiaToolsSection, ctStatus.result());
  }

  // datalayer
  {
    const dlStatus = new StatusAccumulator();
    if (dlProcessRunning && !datalayerSection.reachable) {
      dlStatus.escalate(
        'critical',
        'Chia DataLayer service unreachable - this usually indicates a crashed or stuck process that needs to be killed',
      );
    }
    if (datalayerSection.subscriptions?.some((s) => s.synced === false)) {
      dlStatus.escalate('warning', 'One or more DataLayer subscriptions are not synced');
    }
    Object.assign(datalayerSection, dlStatus.result());
  }

  // fullNode — use fullNodeProcessRunning (from matches) rather than
  // fullNodeRunningLocally (which defaults true on unreliable scans) to
  // avoid false-positive criticals on Windows / minimal Docker images.
  {
    const fnStatus = new StatusAccumulator();
    if (fullNodeProcessRunning && !fullNodeSection.reachable) {
      fnStatus.escalate(
        'critical',
        'Chia full node service unreachable - this usually indicates a crashed or stuck process that needs to be killed',
      );
    }
    Object.assign(fullNodeSection, fnStatus.result());
  }

  // wallet
  {
    const walletStatus = new StatusAccumulator();

    if (walletProcessRunning && !walletReachable) {
      walletStatus.escalate(
        'critical',
        'Chia wallet service unreachable - this usually indicates a crashed or stuck process that needs to be killed',
      );
    }

    if (walletReachable && !walletSection.synced) {
      walletStatus.escalate('warning', 'Wallet syncing');
    }

    const coinAmount = appConfig.DEFAULT_COIN_AMOUNT ?? 300;
    const fee = appConfig.DEFAULT_FEE ?? 3000;
    const minMirrorXch = (coinAmount + fee) / 1_000_000_000_000;
    if (walletSection.balanceXch != null && walletSection.balanceXch < minMirrorXch) {
      walletStatus.escalate('critical', 'Wallet balance too low to create mirrors');
    }

    const pendingTx = walletSection.pendingTransactions;
    if (pendingTx && !pendingTx.error) {
      const hasStuck =
        pendingTx.standardWallet?.stuck?.length > 0 ||
        pendingTx.dataLayerWallet?.stuck?.length > 0;
      if (hasStuck) {
        walletStatus.escalate('critical', 'Stuck transactions detected that need manual intervention');
      }
      const hasRejected =
        pendingTx.standardWallet?.rejected?.length > 0 ||
        pendingTx.dataLayerWallet?.rejected?.length > 0;
      if (hasRejected) {
        walletStatus.escalate('critical', 'Rejected transactions detected that need attention');
      }
    }

    if (walletReachable && walletSection.trustedFullNodePeers?.hasTrustedConnection === false) {
      walletStatus.escalate(
        'warning',
        'Performance is severely degraded when the Chia wallet is not connected to a trusted full node peer',
      );
    }

    Object.assign(walletSection, walletStatus.result());
  }

  // network
  const networkStatus = new StatusAccumulator();
  if (networkMatches === false) {
    networkStatus.escalate('warning', 'CADT configured network does not match Chia network');
  }
  const networkSection = {
    chia: actualNetwork,
    cadt: configuredNetwork,
    matches: networkMatches,
    ...networkStatus.result(),
  };

  // ---- Full response ------------------------------------------------------
  return {
    timestamp,
    cadt: cadtSection,
    network: networkSection,
    chia: {
      version: chiaVersionRes.ok ? chiaVersionRes.value : null,
      wallet: walletSection,
      fullNode: fullNodeSection,
      datalayer: datalayerSection,
      chiaTools: chiaToolsSection,
      runningProcesses: processesValue,
    },
    system: systemSection,
  };
};

export const __test = {
  settle,
  collectSubscriptions,
  buildTrustedPeerView,
  normalizeNodeId,
  StatusAccumulator,
};
