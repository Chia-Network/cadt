'use strict';

import fs from 'fs';
import path from 'path';

import { getChiaRoot } from './chia-root.js';
import { logger } from '../config/logger.js';

const BYTES_PER_MB = 1024 * 1024;

// Hardcoded thresholds (intentionally not user-configurable).
//
// Sized for the existing 100 MB filestore upload limit + typical SQLite
// WAL growth during batch operations. Lowering BLOCK_BYTES risks
// SQLITE_FULL mid-transaction (which can corrupt the WAL); raising it
// wastes disk for no operational benefit. WARN_BYTES gives operators
// advance notice before writes are blocked.
//
// Exported so tests (and any future callers like /health) can reference
// the same source of truth instead of duplicating the literals.
export const BLOCK_BYTES = 512 * BYTES_PER_MB;
export const WARN_BYTES = 1024 * BYTES_PER_MB;

// Cache statfs results to avoid hammering the filesystem on every
// request. 30 s is a comfortable trade-off: short enough that operators
// see the severity flip soon after they free or fill the disk, long
// enough that even a request flood adds at most one statfs per 30 s.
const CHECK_INTERVAL_MS = 30_000;

let cachedStatus = null;
let cachedAt = 0;
let inflight = null;

// Transition-based logging: emit a log line ONLY when severity changes
// (e.g. ok→warn, warn→block, block→ok, anything→unknown). Earlier
// revisions used a time-windowed debounce, but that interacted badly
// with k8s-style /health scrapes: a 5 s scrape interval keeps the
// debounce timestamps fresh, which silenced the operator-facing error
// log the first time a real write hit the block threshold. Tracking
// the previously-logged severity instead of a timestamp is immune to
// scrape rate.
let lastLoggedSeverity = null;

// Test-only override: when set, checkDiskSpace returns this value verbatim
// and the underlying statfs is skipped entirely. null = real behaviour.
let testOverride = null;

// Helper that won't throw if existsSync rejects (rare - EACCES on the
// path itself, weird FUSE filesystems, etc.). Used by getDirsToCheck so
// the dir resolution never makes computeStatus reject.
const safeExists = (p) => {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
};

// CADT writes to ${CHIA_ROOT}/cadt/v{1,2}/. Both usually live on the
// same partition, but checking both keeps us correct if someone mounts
// them separately. Returns absolute, already-existing parent dirs - we
// don't try to mkdir here because the data dir owners are responsible
// for creation and we don't want to mask a permissions problem.
const getDirsToCheck = () => {
  const chiaRoot = getChiaRoot();
  const candidates = [
    path.join(chiaRoot, 'cadt', 'v1'),
    path.join(chiaRoot, 'cadt', 'v2'),
  ];
  const existing = candidates.filter(safeExists);
  // Fallback: if neither v1 nor v2 dir exists yet (very early startup),
  // statfs the cadt root or the chia root itself. statfs only needs the
  // path to resolve to *some* file in the filesystem, so this keeps us
  // returning a sensible "free bytes" number from the very first request.
  if (existing.length === 0) {
    const cadtRoot = path.join(chiaRoot, 'cadt');
    if (safeExists(cadtRoot)) return [cadtRoot];
    if (safeExists(chiaRoot)) return [chiaRoot];
    return [path.parse(chiaRoot).root];
  }
  return existing;
};

// Mirrors the math used by src/utils/system-info.js so /health and
// /diagnostics agree on the same disk's free-byte count. Per POSIX
// statvfs(3), `bavail` is denominated in `frsize` (fundamental block
// size), not `bsize` (optimal transfer block size). Node's libuv
// wrapper currently only exposes `bsize`, and on Linux+ext4 the two
// are equal, but on Docker+VirtioFS or future Node versions that
// expose `frsize` they can differ - hence the `?? bsize` fallback.
const statfsBytes = async (dir) => {
  const stat = await fs.promises.statfs(dir);
  const blockSize = stat.frsize ?? stat.bsize;
  // bavail is "free blocks for unprivileged users" - what user-space
  // writes actually see. Some filesystems reserve 5% for root, so
  // bfree (raw free blocks) would over-report by that margin.
  return stat.bavail * blockSize;
};

const computeStatus = async () => {
  const dirs = getDirsToCheck();

  let worstFreeBytes = Number.POSITIVE_INFINITY;
  let worstPath = dirs[0];
  let statfsError = null;

  for (const dir of dirs) {
    try {
      const free = await statfsBytes(dir);
      if (free < worstFreeBytes) {
        worstFreeBytes = free;
        worstPath = dir;
      }
    } catch (err) {
      // Don't let a transient statfs failure block writes - that would
      // fail closed in a way operators can't recover from without code
      // changes. Record the error, treat the directory as if it had
      // plenty of space, and surface the problem in /health and logs.
      statfsError = err;
      logger.debug(
        `disk-space-guard: statfs(${dir}) failed: ${err.message}; skipping this path`,
      );
    }
  }

  if (!Number.isFinite(worstFreeBytes)) {
    // All statfs calls failed. Fail open (allow writes) so a buggy or
    // un-statfs-able filesystem doesn't take CADT down. The "unknown"
    // log line is emitted by logDiskSpaceStatus on the transition, not
    // here, so a steady-state EACCES on the data dir doesn't spam logs.
    return Object.freeze({
      severity: 'unknown',
      freeBytes: null,
      blockBytes: BLOCK_BYTES,
      warnBytes: WARN_BYTES,
      path: worstPath,
      error: statfsError?.message || null,
    });
  }

  let severity = 'ok';
  if (worstFreeBytes < BLOCK_BYTES) severity = 'block';
  else if (worstFreeBytes < WARN_BYTES) severity = 'warn';

  // Freeze the cached object so callers can't mutate the live cache by
  // accident (peekDiskSpaceStatus returns the same reference).
  return Object.freeze({
    severity,
    freeBytes: worstFreeBytes,
    blockBytes: BLOCK_BYTES,
    warnBytes: WARN_BYTES,
    path: worstPath,
    error: null,
  });
};

/**
 * Non-blocking peek at the current disk-space status. Returns the cached
 * value if one exists, otherwise null. Never triggers a statfs.
 *
 * Used by /health endpoints so liveness probes never block on a slow
 * filesystem (statfs can hang for seconds on NFS/EBS hiccups, and k8s'
 * default livenessProbe.timeoutSeconds is 1 s — a full statfs round trip
 * can trigger spurious pod restarts precisely when operators most need
 * /health to respond).
 *
 * The cache is kept fresh by checkDiskSpace() calls from the write-path
 * middleware (every 30 s of write traffic) and by the periodic refresh
 * driven from refreshDiskSpaceStatus() below. As a fallback, /health
 * handlers should also kick off an async refresh (and ignore the
 * promise) so a quiet, mostly-idle instance still gets timely updates.
 */
export const peekDiskSpaceStatus = () => {
  if (testOverride !== null) {
    return testOverride;
  }
  return cachedStatus;
};

/**
 * Fire-and-forget refresh of the cached disk-space status. Used by
 * /health and similar non-blocking callers that want the cache to stay
 * warm without paying statfs latency on the request path. Failures are
 * swallowed (computeStatus already logs them).
 */
export const refreshDiskSpaceStatus = () => {
  // Reuse the same in-flight de-dup as checkDiskSpace so callers don't
  // accidentally schedule overlapping statfs calls.
  void checkDiskSpace().catch(() => {});
};

/**
 * Returns the current disk-space status, using a cached value when
 * available (refreshed every CHECK_INTERVAL_MS - 30 s).
 *
 * Shape: { severity, freeBytes, blockBytes, warnBytes, path, error }
 *   severity: 'ok' | 'warn' | 'block' | 'unknown'
 *   freeBytes: bytes available to unprivileged users on the tightest
 *              data directory (null when statfs failed everywhere)
 *
 * Concurrent callers within the same refresh window share the in-flight
 * promise so we only statfs once per refresh interval no matter how
 * many requests arrive simultaneously.
 */
export const checkDiskSpace = async () => {
  if (testOverride !== null) {
    return testOverride;
  }

  const now = Date.now();
  if (cachedStatus && now - cachedAt < CHECK_INTERVAL_MS) {
    return cachedStatus;
  }
  if (inflight) {
    return inflight;
  }
  inflight = computeStatus()
    .then((status) => {
      cachedStatus = status;
      cachedAt = Date.now();
      return status;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
};

/**
 * Emit a log line on every severity transition (e.g. ok→warn,
 * warn→block, block→ok, anything→unknown). Idempotent within a
 * severity: repeat calls with the same severity are no-ops, so callers
 * can drive this from any path (write middleware, /health scrapes,
 * periodic tasks) without flooding the log.
 *
 * Operators get a clear "we crossed into trouble" alert and a matching
 * "we recovered" alert without a time-windowed debounce that scrape
 * traffic could refresh.
 */
export const logDiskSpaceStatus = (status) => {
  if (!status) return;
  if (status.severity === lastLoggedSeverity) return;

  const free =
    status.freeBytes == null
      ? 'unknown'
      : `${(status.freeBytes / BYTES_PER_MB).toFixed(1)} MiB`;
  const block = `${(status.blockBytes / BYTES_PER_MB).toFixed(0)} MiB`;
  const warn = `${(status.warnBytes / BYTES_PER_MB).toFixed(0)} MiB`;
  const previous = lastLoggedSeverity ?? 'unset';

  switch (status.severity) {
    case 'block':
      logger.error(
        `disk-space-guard: severity transitioned ${previous} -> block. Free space ${free} on ${status.path} is below BLOCK threshold (${block}); rejecting POST/PUT/PATCH writes (GET reads and DELETE still allowed).`,
      );
      break;
    case 'warn':
      logger.warn(
        `disk-space-guard: severity transitioned ${previous} -> warn. Free space ${free} on ${status.path} is below WARN threshold (${warn}); free disk space before reaching the BLOCK threshold (${block}).`,
      );
      break;
    case 'unknown':
      logger.warn(
        `disk-space-guard: severity transitioned ${previous} -> unknown. Could not statfs ${status.path}${status.error ? ` (${status.error})` : ''}; failing open and allowing writes.`,
      );
      break;
    case 'ok':
      // Only announce recovery; suppress the initial "ok" on first
      // observation to avoid a noisy log line on every cold start.
      if (lastLoggedSeverity !== null) {
        logger.info(
          `disk-space-guard: severity transitioned ${previous} -> ok. Free space ${free} on ${status.path}.`,
        );
      }
      break;
    default:
      break;
  }
  lastLoggedSeverity = status.severity;
};

/**
 * Build the 507 Insufficient Storage response body. Shape mirrors
 * READ_ONLY_ERROR in src/utils/read-only-response.js so clients can
 * branch on `error` uniformly. Intentionally does NOT include
 * freeBytes/thresholdBytes - the disk-space middleware runs before the
 * API-key check, so this body is reachable by anonymous callers and we
 * don't want to leak operational state. Authenticated operators can see
 * the full numeric status on /health, /v1/health, and /v2/health.
 */
export const buildInsufficientDiskSpaceError = () => ({
  message: 'Server is low on disk space; write operations are temporarily disabled',
  error: 'INSUFFICIENT_DISK_SPACE',
  success: false,
});

// Test-only. DO NOT call from production code. Pass null to restore
// real statfs-backed behaviour.
export const __setDiskSpaceForTests = (status) => {
  testOverride = status;
  cachedStatus = null;
  cachedAt = 0;
  inflight = null;
};

// Test-only. Reset the last-logged severity so transition-log
// assertions don't leak between specs running in the same mocha
// session. Kept under the previous name so older specs don't break.
export const __resetDiskSpaceLogDebounceForTests = () => {
  lastLoggedSeverity = null;
};

// Test-only. Force the next checkDiskSpace() call to re-statfs even if
// it's still within the cache window.
export const __invalidateDiskSpaceCacheForTests = () => {
  cachedStatus = null;
  cachedAt = 0;
  inflight = null;
};

// Methods that should be rejected when severity === 'block'. DELETE is
// intentionally omitted so operators can free space without restarting.
// Note: a pathological large CASCADE DELETE can still trigger SQLITE_FULL
// because DELETE writes deleted pages into the WAL before checkpoint
// reclaims space. The 512 MiB BLOCK threshold is sized to keep typical
// DELETEs safe; a full operator escape hatch (skip the guard entirely)
// would require a config flag we have intentionally avoided here.
const BLOCKED_METHODS = Object.freeze(['POST', 'PUT', 'PATCH']);

export const isWriteRejectedByDiskGuard = (method) =>
  BLOCKED_METHODS.includes(String(method || '').toUpperCase());
