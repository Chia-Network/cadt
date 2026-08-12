'use strict';

import { getConfig } from './config-loader.js';

// Governance readiness is a freshness signal, not a "sync in progress" flag. It
// answers "was governance data last confirmed good recently enough to destroy
// local state against it?". The off-orglist purge in the
// sync-default-organizations tasks is gated on it, and that purge unsubscribes
// from and deletes every local record for organizations missing from the cached
// orgList, so a wrong answer here is expensive in both directions.
//
// Two rules follow, and both are load-bearing:
//
// 1. Never clear readiness because a sync has *started*. The producer
//    (tasks/sync-governance-body{,-v2}.js) and the consumer
//    (tasks/sync-default-organizations{,-v2}.js) are separate jobs that share a
//    default task interval, so they fire on the same scheduler tick. A value
//    cleared at the start of a sync is what the consumer reads for that entire
//    cycle, which closes the purge gate permanently rather than momentarily.
//    Readiness may only move backwards on evidence that governance is stale,
//    never on the mere fact that a refresh is underway.
//
// 2. Staleness is time-based. A boolean can only express "succeeded at least
//    once since process start", which would let a node whose governance sync
//    has been broken for hours keep purging against a long-stale orgList.
//    Comparing against the last confirmed-good timestamp blocks that node while
//    never dipping false during a healthy refresh.
const lastReadyAt = {
  v1: null,
  v2: null,
};

// Readiness expires after this many governance sync intervals. Several
// intervals rather than one so a single slow or failed sync does not gate the
// purge off. The window is clamped at both ends: the floor keeps an
// aggressively short configured interval from making readiness flap, and the
// ceiling keeps a long one from stretching "recently validated" into days,
// which would defeat rule 2 above.
const STALE_AFTER_SYNC_INTERVALS = 5;
const MIN_READINESS_MAX_AGE_MS = 10 * 60 * 1000;
const MAX_READINESS_MAX_AGE_MS = 60 * 60 * 1000;
// The ceiling itself has a floor, expressed in sync intervals. Without it, an
// interval longer than the ceiling would expire readiness before the next
// scheduled sync could ever renew it, turning the gate into a permanent off
// switch and silently disabling reconciliation instead of merely pausing it.
const MIN_INTERVALS_BEFORE_EXPIRY = 2;
const DEFAULT_SYNC_INTERVAL_SECONDS = 120;

const getReadinessMaxAgeMs = () => {
  // TASKS lives under the shared APP section, which getConfig and getConfigV2
  // populate identically, so this one read serves both versions.
  const configured = Number(
    getConfig()?.APP?.TASKS?.GOVERNANCE_SYNC_TASK_INTERVAL,
  );
  const intervalMs =
    (Number.isFinite(configured) && configured > 0
      ? configured
      : DEFAULT_SYNC_INTERVAL_SECONDS) * 1000;

  const ceiling = Math.max(
    MAX_READINESS_MAX_AGE_MS,
    intervalMs * MIN_INTERVALS_BEFORE_EXPIRY,
  );

  return Math.min(
    Math.max(
      intervalMs * STALE_AFTER_SYNC_INTERVALS,
      MIN_READINESS_MAX_AGE_MS,
    ),
    ceiling,
  );
};

export const markGovernanceReady = (version) => {
  if (Object.prototype.hasOwnProperty.call(lastReadyAt, version)) {
    lastReadyAt[version] = Date.now();
  }
};

// Only for cases where governance data is known to be bad — currently a
// download that carries no orgList, which cannot vouch for the cached one.
// Not for signalling that a refresh has begun; see rule 1 above.
export const markGovernanceNotReady = (version) => {
  if (Object.prototype.hasOwnProperty.call(lastReadyAt, version)) {
    lastReadyAt[version] = null;
  }
};

export const isGovernanceReady = (version) => {
  const readyAt = lastReadyAt[version];

  if (typeof readyAt !== 'number') {
    return false;
  }

  return Date.now() - readyAt <= getReadinessMaxAgeMs();
};

export const resetGovernanceReadiness = () => {
  lastReadyAt.v1 = null;
  lastReadyAt.v2 = null;
};
