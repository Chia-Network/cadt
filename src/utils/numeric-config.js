'use strict';

import _ from 'lodash';

import { defaultConfig } from './defaultConfig.js';

// APP config values arrive from YAML, which happily yields a string when the
// value was quoted. `docker-entrypoint.sh` quoted every env-provided value, and
// hand-edited config files can do the same. A string then breaks arithmetic:
// `DEFAULT_COIN_AMOUNT + DEFAULT_FEE` concatenates "300" and "300" into
// "300300" instead of adding to 600. Joi's `.max()` likewise requires a number.
//
// Coercing once here keeps every consumer of getConfig()/getConfigV2() free of
// per-call-site Number() calls.

/**
 * APP-relative paths whose values must be numbers.
 *
 * TRUST_PROXY is deliberately absent: `resolveTrustProxyHops`
 * (src/utils/trust-proxy.js) owns its coercion and logs warnings for inputs
 * (booleans, "loopback") that this helper would silently replace with 0.
 */
export const NUMERIC_APP_CONFIG_PATHS = Object.freeze([
  'CW_PORT',
  'DEFAULT_FEE',
  'DEFAULT_COIN_AMOUNT',
  'TASKS.GOVERNANCE_SYNC_TASK_INTERVAL',
  'TASKS.ORGANIZATION_META_SYNC_TASK_INTERVAL',
  'TASKS.PICKLIST_SYNC_TASK_INTERVAL',
  'TASKS.MIRROR_CHECK_TASK_INTERVAL',
  'TASKS.VALIDATE_ORGANIZATION_TABLE_TASK_INTERVAL',
  'TASKS.COIN_MANAGEMENT_TASK_INTERVAL',
  'REQUEST_CONTENT_LIMITS.STAGING.EDIT_DATA_LEN',
  'REQUEST_CONTENT_LIMITS.UNITS.INCLUDE_COLUMNS_LEN',
  'REQUEST_CONTENT_LIMITS.UNITS.MARKETPLACE_IDENTIFIERS_LEN',
  'REQUEST_CONTENT_LIMITS.PROJECTS.INCLUDE_COLUMNS_LEN',
  'REQUEST_CONTENT_LIMITS.PROJECTS.PROJECT_IDS_LEN',
]);

// A complete decimal literal and nothing else, so "1e3", "300 mojos", "0x12"
// and "" are rejected rather than partially parsed. Number() would accept
// booleans, arrays and whitespace, hence the explicit type checks below.
const DECIMAL_LITERAL = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;

/**
 * Coerce a raw config value to a finite number, falling back to the documented
 * default when the value is missing or not numeric. Never returns NaN: NaN
 * would make every `>=` threshold comparison false without raising an error.
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
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    return rawValue;
  }

  if (typeof rawValue === 'string' && DECIMAL_LITERAL.test(rawValue.trim())) {
    const parsed = Number(rawValue.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  // undefined/null mean "not configured", which the default already covers.
  if (rawValue !== undefined && rawValue !== null) {
    log.warn(
      `[config]: ${label}=${JSON.stringify(rawValue)} is not a number; ` +
        `falling back to the default of ${fallback}.`,
    );
  }

  return fallback;
};

/**
 * Return a copy of an APP config section with every numeric key coerced to a
 * number. Non-numeric keys are passed through untouched.
 *
 * @param {object} appConfig
 * @param {{warn: (msg: string) => void}} [log]
 * @returns {object}
 */
export const coerceNumericAppConfig = (appConfig, log = console) => {
  if (!appConfig || typeof appConfig !== 'object') {
    return appConfig;
  }

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
