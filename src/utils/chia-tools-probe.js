/**
 * Probe for the `chia-tools` CLI on the PATH visible to the CADT process.
 *
 * Returns a clearly-flagged best-effort answer. PATH visibility depends on
 * how CADT was launched (systemd unit, Docker entrypoint, user shell, ...).
 * We always include a `note` describing exactly that so the caller knows
 * "not installed" might mean "not on this PATH".
 */

import { execFile } from 'child_process';
import { logger } from '../config/logger.js';

// Python-based chia-tools installs (venv, pyenv, asdf) can take 1-3s just to
// import the chia-blockchain modules before `--version` prints anything, so
// 2s used to give false "not installed" answers on cold spawns.
const PROBE_TIMEOUT_MS = 5000;

const tryRun = (binary, args) =>
  new Promise((resolve) => {
    execFile(
      binary,
      args,
      { timeout: PROBE_TIMEOUT_MS, maxBuffer: 64 * 1024 },
      (error, stdout, stderr) => {
        if (error) return resolve({ ok: false, error });
        resolve({ ok: true, stdout: stdout || '', stderr: stderr || '' });
      },
    );
  });

const extractVersion = (output) => {
  if (!output) return null;
  const match = output.match(/\bv?(\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?)\b/);
  return match ? match[1] : output.trim().split('\n')[0]?.trim() || null;
};

/**
 * @returns {Promise<{installed: boolean, version: ?string, note: string, error?: string, lastErrorCode?: string}>}
 */
export const probeChiaTools = async () => {
  // We deliberately do NOT echo process.env.PATH back to callers -- on a
  // typical install that includes the running user's home directory and
  // would leak filesystem layout. The note is generic.
  const note = 'based on PATH visible to the CADT process';

  let nonEnoentError = null;
  // Try `--version` first; some chia-tools builds use `version` as a subcommand.
  for (const args of [['--version'], ['version']]) {
    const result = await tryRun('chia-tools', args);
    if (result.ok) {
      return {
        installed: true,
        version: extractVersion(result.stdout || result.stderr),
        note,
      };
    }
    if (result.error && result.error.code !== 'ENOENT') {
      logger.debug(
        `[diagnostics]: chia-tools ${args.join(' ')} failed: ${result.error.message}`,
      );
      // Capture the last non-ENOENT error so callers can distinguish
      // "not installed" from "installed but broken".
      nonEnoentError = result.error;
    }
  }

  const response = {
    installed: false,
    version: null,
    note,
  };
  if (nonEnoentError) {
    response.error = nonEnoentError.message;
    if (nonEnoentError.code) response.lastErrorCode = nonEnoentError.code;
  }
  return response;
};

export const __test = { extractVersion };
