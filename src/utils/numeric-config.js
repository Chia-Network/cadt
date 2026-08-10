'use strict';

import _ from 'lodash';

import { defaultConfig } from './defaultConfig.js';

// YAML preserves quoting, so numeric APP keys can arrive as strings. Coercing
// once here keeps consumers (arithmetic in wallet.js, Joi `.max()` in
// src/validations) free of per-call-site Number() calls.

const numericLeafPaths = (node, prefix = '') =>
  Object.entries(node).flatMap(([key, value]) => {
    const configPath = prefix ? `${prefix}.${key}` : key;
    if (_.isPlainObject(value)) {
      return numericLeafPaths(value, configPath);
    }
    return typeof value === 'number' ? [configPath] : [];
  });

/**
 * APP-relative paths whose values must be numbers, derived from the numeric
 * leaves of defaultConfig.APP so a new numeric key is covered automatically.
 *
 * TRUST_PROXY is deliberately excluded: `resolveTrustProxyHops`
 * (src/utils/trust-proxy.js) owns its coercion and logs warnings for inputs
 * (booleans, "loopback") that this helper would silently replace with 0.
 */
export const NUMERIC_APP_CONFIG_PATHS = Object.freeze(
  numericLeafPaths(defaultConfig.APP).filter((path) => path !== 'TRUST_PROXY'),
);

// Every key above is a non-negative integer by contract: a TCP port, a mojo
// amount, a count of seconds, or a length bound. Matching `resolveTrustProxyHops`,
// signs, fractions and values past MAX_SAFE_INTEGER are rejected rather than
// silently accepted or truncated.
const UNSIGNED_INTEGER_LITERAL = /^\d+$/;

const isNonNegativeSafeInteger = (value) =>
  Number.isSafeInteger(value) && value >= 0;

// String() rather than JSON.stringify(): the latter renders NaN and Infinity as
// `null`, which reads as "not configured", and throws on circular values that
// js-yaml can produce from recursive anchors.
const describeValue = (value) =>
  typeof value === 'string' ? JSON.stringify(value) : String(value);

/**
 * Coerce a raw config value to a non-negative safe integer, falling back to the
 * documented default when the value is missing or out of contract. Never
 * returns NaN: NaN would make every `>=` threshold comparison false without
 * raising an error.
 *
 * @param {unknown} rawValue
 * @param {number} fallback     Value from defaultConfig for this key.
 * @param {string} label        Config path, used in the warning message.
 * @param {{warn: (msg: string) => void}} [log]
 * @returns {number}
 */
export const coerceConfigNumber = (
  rawValue,
  fallback,
  label,
  log = console,
) => {
  if (typeof rawValue === 'number' && isNonNegativeSafeInteger(rawValue)) {
    return rawValue;
  }

  if (
    typeof rawValue === 'string' &&
    UNSIGNED_INTEGER_LITERAL.test(rawValue.trim())
  ) {
    const parsed = Number(rawValue.trim());
    if (isNonNegativeSafeInteger(parsed)) {
      return parsed;
    }
  }

  // undefined/null mean "not configured", which the default already covers.
  if (rawValue !== undefined && rawValue !== null) {
    log.warn(
      `[config]: ${label}=${describeValue(rawValue)} is not a non-negative ` +
        `integer; falling back to ${fallback}.`,
    );
  }

  return fallback;
};

/**
 * Return a copy of an APP config section with every numeric key coerced to a
 * number. Non-numeric keys are passed through untouched; numeric keys absent
 * from the input are materialized from defaultConfig.
 *
 * @param {object} appConfig
 * @param {{warn: (msg: string) => void}} [log]
 * @returns {object}
 */
export const coerceNumericAppConfig = (appConfig, log = console) => {
  // Clone so coercion cannot write through into defaultConfig. When
  // config-loader falls back to `{ ...defaultConfig }`, that shallow spread
  // leaves APP.TASKS and APP.REQUEST_CONTENT_LIMITS pointing at the shared
  // module-level defaults, and mergeObjects keeps the aliases because the keys
  // already exist in the target.
  const coerced = _.cloneDeep(appConfig);

  for (const configPath of NUMERIC_APP_CONFIG_PATHS) {
    _.set(
      coerced,
      configPath,
      coerceConfigNumber(
        _.get(coerced, configPath),
        _.get(defaultConfig.APP, configPath),
        `APP.${configPath}`,
        log,
      ),
    );
  }

  return coerced;
};
