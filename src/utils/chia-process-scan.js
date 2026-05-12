/**
 * Best-effort scan for Chia processes running on the local machine.
 *
 * POSIX-only: shells out to `ps -eo pid=,command=` and filters for `chia`
 * binaries. On Windows we report `supported: false` and skip the scan; the
 * diagnostics endpoint surfaces this clearly so callers know the field is
 * intentionally empty.
 *
 * "multipleVersionsDetected" is a heuristic that flags when two or more
 * distinct install paths host running chia processes (e.g. a system
 * `/usr/bin/chia` alongside a `~/chia-blockchain/venv/bin/chia`). It's not
 * authoritative — process inspection is inherently fragile under Docker,
 * systemd, and various sandbox managers — but it's a useful smoke signal.
 */

import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { logger } from '../config/logger.js';

// `ps -eo command=` on a container or build host with thousands of processes
// can occasionally take a second or two; 5s leaves plenty of headroom.
const PS_TIMEOUT_MS = 5000;
const MAX_OUTPUT_BYTES = 1024 * 1024; // 1 MiB is more than enough for a `ps` listing

/**
 * Return entries that look like a chia process. We match on the executable
 * basename (`chia`, `chia_full_node`, `chia_wallet`, `chia_data_layer`,
 * `chia-tools`, etc.) rather than full path so renamed/wrapped installs
 * still match. We filter out our own `ps | grep` pipeline below the
 * call site.
 */
const isChiaCommand = (commandLine) => {
  if (!commandLine) return false;
  const tokens = commandLine.trim().split(/\s+/);
  const firstToken = tokens[0] || '';
  const basename = path.basename(firstToken);
  return /^chia(?:[_-]|$)/i.test(basename);
};

const parsePsLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) return null;
  const pid = Number.parseInt(trimmed.slice(0, spaceIdx), 10);
  if (!Number.isFinite(pid)) return null;
  const command = trimmed.slice(spaceIdx + 1).trim();
  return { pid, command };
};

const runPs = () =>
  new Promise((resolve, reject) => {
    execFile(
      'ps',
      ['-eo', 'pid=,command='],
      { timeout: PS_TIMEOUT_MS, maxBuffer: MAX_OUTPUT_BYTES },
      (error, stdout) => {
        if (error) return reject(error);
        resolve(stdout || '');
      },
    );
  });

/**
 * Scan running processes for chia binaries.
 * @returns {Promise<{supported: boolean, platform: string, matches: Array, multipleVersionsDetected: boolean, error?: string}>}
 */
export const scanChiaProcesses = async () => {
  const platform = os.platform();

  if (platform === 'win32') {
    return {
      supported: false,
      platform,
      matches: [],
      multipleVersionsDetected: false,
      note: 'process scan is not supported on Windows',
    };
  }

  try {
    const output = await runPs();
    const matches = output
      .split('\n')
      .map(parsePsLine)
      .filter((entry) => entry && isChiaCommand(entry.command))
      // We use execFile (not a shell pipe) so the ps process itself appears in
      // the output too -- excluding our own pid keeps the list clean.
      .filter((entry) => entry.pid !== process.pid);

    const installPaths = new Set();
    for (const match of matches) {
      const firstToken = match.command.split(/\s+/)[0] || '';
      // We classify by the directory the binary lives in. Two chia processes
      // out of the same directory are almost certainly the same install
      // (different services); distinct directories suggest distinct installs.
      const dir = path.dirname(firstToken);
      if (dir && dir !== '.') installPaths.add(dir);
    }

    return {
      supported: true,
      platform,
      matches,
      installPaths: Array.from(installPaths),
      multipleVersionsDetected: installPaths.size > 1,
    };
  } catch (error) {
    logger.debug(`[diagnostics]: chia process scan failed: ${error.message}`);
    return {
      supported: true,
      platform,
      matches: [],
      multipleVersionsDetected: false,
      error: error.message,
    };
  }
};

export const __test = { isChiaCommand, parsePsLine };
