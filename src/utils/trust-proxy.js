'use strict';

import { logger } from '../config/logger.js';

// Express's `trust proxy` accepts booleans, numbers, strings (subnets,
// CIDRs, "loopback", etc.), arrays and functions. CADT's contract is
// intentionally narrower: TRUST_PROXY must be a non-negative integer
// representing the number of reverse-proxy hops, as documented in
// src/utils/defaultConfig.js.
//
// The previous implementation used `parseInt(rawValue, 10)`, which
// silently produced `NaN` for any non-numeric input (`true`, `false`,
// the strings "true"/"false"/"loopback", typos, etc.). Express treats
// `NaN` as falsy and disables proxy trust, so an operator who set
// `TRUST_PROXY=true` believing they were enabling proxy trust would
// actually get the opposite outcome with no log message. Worse,
// `docker-entrypoint.sh` converts the env var "true"/"false" to a YAML
// boolean, so the bug fires for the most plausible "just enable it"
// configuration mistake.
//
// `resolveTrustProxyHops` enforces the integer contract and logs a
// clear warning when the input is outside it, defaulting to 0 (no
// trust) so the failure mode is "rate limiting matches no proxy" rather
// than "rate limiting silently trusts the world".

// Number.isSafeInteger already returns false for NaN, Infinity, and any
// non-integer numeric value, so an explicit isFinite check would be
// redundant.
const isNonNegativeSafeInteger = (value) =>
  Number.isSafeInteger(value) && value >= 0;

/**
 * Coerce a raw TRUST_PROXY config value to a non-negative integer hop
 * count suitable for `app.set('trust proxy', n)`.
 *
 * @param {unknown} rawValue
 * @param {{warn: (msg: string) => void}} [log]  Logger override for tests.
 * @returns {number}
 */
export const resolveTrustProxyHops = (rawValue, log = logger) => {
  if (rawValue === undefined || rawValue === null) {
    return 0;
  }

  if (typeof rawValue === 'number') {
    if (isNonNegativeSafeInteger(rawValue)) {
      return rawValue;
    }
    log.warn(
      `[middleware]: TRUST_PROXY=${rawValue} is not a non-negative integer; ` +
        'falling back to 0 (no proxy trust). See defaultConfig.js for valid values.',
    );
    return 0;
  }

  if (typeof rawValue === 'boolean') {
    // Booleans are explicitly unsupported because the comment in
    // defaultConfig.js says "Never set to `true`; that trusts the
    // user-supplied leftmost IP and defeats rate limiting". We also
    // reject `false` so operators get a clear log when their config
    // does not match the documented contract (instead of getting 0 by
    // accident).
    log.warn(
      `[middleware]: TRUST_PROXY is set to boolean \`${rawValue}\`; ` +
        'only non-negative integers (0, 1, 2, …) are supported. ' +
        'Falling back to 0 (no proxy trust). See defaultConfig.js.',
    );
    return 0;
  }

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (trimmed === '') {
      return 0;
    }
    // Require an exact non-negative integer literal so "loopback",
    // "2 hops", "1.5" and "+2" don't get silently coerced.
    if (/^\d+$/.test(trimmed)) {
      const parsed = Number(trimmed);
      if (isNonNegativeSafeInteger(parsed)) {
        return parsed;
      }
    }
    log.warn(
      `[middleware]: TRUST_PROXY="${rawValue}" is not a non-negative integer string; ` +
        'falling back to 0 (no proxy trust). See defaultConfig.js.',
    );
    return 0;
  }

  log.warn(
    `[middleware]: TRUST_PROXY has unsupported type \`${typeof rawValue}\`; ` +
      'falling back to 0 (no proxy trust).',
  );
  return 0;
};
