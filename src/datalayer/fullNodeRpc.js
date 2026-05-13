/**
 * Minimal RPC client for the locally-running chia full-node, used only by
 * the /diagnostics endpoint. CADT does not depend on the full node for any
 * other functionality; this client exists so we can answer "is the full
 * node running locally, and if so is it synced?".
 *
 * Like the wallet client, we use mTLS with the standard chia SSL files
 * under `${chiaRoot}/config/ssl/full_node/`. If those files are missing
 * (e.g. on a CADT-only host), the helpers return `{ reachable: false }`
 * instead of throwing.
 */

import fs from 'fs';
import path from 'path';
import superagent from 'superagent';

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

import _ from 'lodash';

import { getChiaConfig } from './fullNode.js';
import { getChiaRoot } from '../utils/chia-root.js';
import { getActiveConfig } from '../utils/config-loader.js';
import { logger } from '../config/logger.js';

const DEFAULT_FULL_NODE_RPC_PORT = 8555;
// 10s matches the outer settle() default in routes/diagnostics.js. A full node
// catching up under heavy load can take several seconds to answer
// get_blockchain_state, and falsely tagging it unreachable is worse than
// waiting a bit longer.
const DEFAULT_TIMEOUT_MS = 10000;

const getCertificateFolderPath = () => {
  const chiaRoot = getChiaRoot();
  const overridden = getActiveConfig()?.APP?.CERTIFICATE_FOLDER_PATH;
  return overridden || `${chiaRoot}/config/ssl`;
};

const getRpcPort = () => {
  try {
    const chiaConfig = getChiaConfig();
    return _.get(chiaConfig, 'full_node.rpc_port', DEFAULT_FULL_NODE_RPC_PORT);
  } catch (error) {
    logger.debug(`[diagnostics]: could not read chia config for full-node rpc_port: ${error.message}`);
    return DEFAULT_FULL_NODE_RPC_PORT;
  }
};

const buildRpcUrl = () => `https://localhost:${getRpcPort()}`;

const loadFullNodeCerts = () => {
  const certificateFolderPath = getCertificateFolderPath();
  const certFile = path.resolve(`${certificateFolderPath}/full_node/private_full_node.crt`);
  const keyFile = path.resolve(`${certificateFolderPath}/full_node/private_full_node.key`);
  return {
    cert: fs.readFileSync(certFile),
    key: fs.readFileSync(keyFile),
  };
};

const callRpc = async (endpoint, payload = {}, { timeout = DEFAULT_TIMEOUT_MS } = {}) => {
  const url = `${buildRpcUrl()}${endpoint}`;
  const { cert, key } = loadFullNodeCerts();
  const response = await superagent
    .post(url)
    .key(key)
    .cert(cert)
    .timeout(timeout)
    .send(payload);
  return response.body || JSON.parse(response.text);
};

/**
 * Fetch full-node blockchain state.
 * @returns {Promise<Object>} `{ reachable, synced, syncing, peakHeight, syncMode, error? }`
 */
export const getBlockchainState = async (options = {}) => {
  const rpcUrl = buildRpcUrl();
  try {
    const data = await callRpc('/get_blockchain_state', {}, options);
    if (!data?.success) {
      return { rpcUrl, reachable: true, error: data?.error || 'unknown error' };
    }
    const state = data.blockchain_state || {};
    return {
      rpcUrl,
      reachable: true,
      synced: state.sync?.synced === true,
      syncing: state.sync?.sync_mode === true,
      peakHeight: state.peak?.height ?? null,
      syncMode: state.sync?.sync_mode === true ? 'syncing' : state.sync?.synced === true ? 'synced' : 'not_synced',
      genesisChallengeInitialized: state.genesis_challenge_initialized ?? null,
    };
  } catch (error) {
    logger.debug(`[diagnostics]: full-node get_blockchain_state failed: ${error.message}`);
    return { rpcUrl, reachable: false, error: error.message };
  }
};

/**
 * Fetch full-node peer connections. We only return the host strings; CADT
 * never needs to act on peer details. Used to count outbound peers for the
 * diagnostics view.
 * @returns {Promise<{rpcUrl: string, reachable: boolean, connections?: Array, error?: string}>}
 */
export const getFullNodeConnections = async (options = {}) => {
  const rpcUrl = buildRpcUrl();
  try {
    const data = await callRpc('/get_connections', {}, options);
    if (!data?.success) {
      return { rpcUrl, reachable: true, error: data?.error || 'unknown error' };
    }
    const connections = (data.connections || []).map((c) => ({
      peerHost: c.peer_host,
      peerPort: c.peer_port,
      type: c.type,
    }));
    return { rpcUrl, reachable: true, connections };
  } catch (error) {
    logger.debug(`[diagnostics]: full-node get_connections failed: ${error.message}`);
    return { rpcUrl, reachable: false, error: error.message };
  }
};

export default {
  getBlockchainState,
  getFullNodeConnections,
};
