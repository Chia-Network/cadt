'use strict';

import crypto from 'crypto';
import _ from 'lodash';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { V1Router } from './routes/v1';
import { V2Router } from './routes/v2';
import { getConfig, getConfigV2 } from './utils/config-loader';
import {
  assertChiaNetworkMatchInConfiguration,
  assertDataLayerAvailable,
  assertWalletIsAvailable,
} from './utils/data-assertions';
import packageJson from '../package.json' with { type: 'json' };
import datalayer from './datalayer';
import { Organization } from './models';
import { OrganizationsV2 } from './models/v2/index.js';
import { logger } from './config/logger.js';
import { sendReadOnlyError } from './utils/read-only-response.js';
import { getRateLimitRetryAfterSeconds } from './utils/rate-limit.js';
import { resolveTrustProxyHops } from './utils/trust-proxy.js';
import {
  checkDiskSpace,
  logDiskSpaceStatus,
  buildHealthDiskSpacePayload,
  buildInsufficientDiskSpaceError,
  isWriteRejectedByDiskGuard,
} from './utils/disk-space.js';

const { USE_SIMULATOR } = getConfig().APP;

const headerKeys = Object.freeze({
  API_VERSION_HEADER_KEY: 'x-api-version',
  CR_READY_ONLY_HEADER_KEY: 'cw-read-only',
  DATA_MODEL_VERION_HEADER_KEY: 'x-datamodel-version',
  GOVERNANCE_BODY_HEADER_KEY: 'x-governance-body',
  WALLET_SYNCED: 'x-wallet-synced',
  HOME_ORGANIZATION_SYNCED: 'x-home-org-synced',
  ALL_DATA_SYNCED: 'x-data-synced',
  SYNC_REMAINING: 'x-sync-remaining',
});

const HEALTH_ENDPOINTS = new Set([
  '/health',
  '/v1/health',
  '/v2/health',
  '/v1/health/wallet',
  '/v2/health/wallet',
  '/diagnostics',
]);

const isHealthEndpoint = (path) => HEALTH_ENDPOINTS.has(path);
const isReadOnlyMethodBlocked = (method) => !['GET', 'HEAD', 'OPTIONS'].includes(method);

const app = express();

// Configure proxy trust so Express resolves real client IPs from
// X-Forwarded-For headers.  TRUST_PROXY counts reverse-proxy hops:
//   0  – no proxy (default, direct access)
//   1  – one hop  (nginx OR Cloudflare-only)
//   2  – two hops (Cloudflare → nginx, typical k8s ingress setup)
// This also silences the express-rate-limit ValidationError that fires
// when X-Forwarded-For is present but trust proxy is disabled.
// Never use `true`; it trusts the user-supplied leftmost IP.
//
// resolveTrustProxyHops enforces the non-negative integer contract and
// logs a warning for any other value so that booleans / typos / strings
// like "loopback" don't silently disable proxy trust via NaN (see
// src/utils/trust-proxy.js for the rationale).
const trustProxy = resolveTrustProxyHops(getConfig().APP.TRUST_PROXY);
app.set('trust proxy', trustProxy);

app.use(
  cors({
    exposedHeaders: Object.values(headerKeys).join(','),
  }),
);

// Rate limiting - generous limits to prevent abuse while allowing normal usage
// 1000 requests per 15 minutes per IP (approximately 1 request per second sustained)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    return isHealthEndpoint(req.path);
  },
  handler: (req, res) => {
    res.status(429).json({
      message: 'Too many requests. Please slow down and try again later.',
      error: 'RATE_LIMIT_EXCEEDED',
      success: false,
      retryAfter: getRateLimitRetryAfterSeconds(req.rateLimit?.resetTime),
    });
  },
});

// Apply rate limiting to all routes
app.use(generalLimiter);

app.use(express.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: false }));

// Startup state middleware - blocks requests until CADT is fully ready
// This runs early in the chain but after body parsing
app.use(async function (req, res, next) {
  if (isHealthEndpoint(req.path)) {
    return next();
  }

  // Skip startup checks in simulator mode (for testing)
  if (USE_SIMULATOR) {
    return next();
  }

  // Import startup state checkers
  const { areMigrationsReady, isCoinManagementReady } = await import('./routes/index.js');

  // Block ALL requests until migrations are complete
  if (!areMigrationsReady()) {
    return res.status(503).json({
      message: 'CADT is still starting up. Database migrations are in progress. Please wait a few minutes and try again.',
      error: 'Service temporarily unavailable during startup',
      success: false,
      startupPhase: 'migrations',
    });
  }

  // Block WRITE requests until coin management is complete
  // Write methods: POST, PUT, PATCH, DELETE
  const isWriteRequest = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (isWriteRequest && !isCoinManagementReady()) {
    return res.status(503).json({
      message: 'CADT is still starting up. Coin management is in progress to prepare for write operations. Please wait a few minutes before writing or editing data.',
      error: 'Write operations temporarily unavailable during startup',
      success: false,
      startupPhase: 'coin_management',
    });
  }

  next();
});

// Request logger middleware
app.use((req, res, next) => {
  logger.verbose(`Received request: ${req.method} ${req.originalUrl}`, {
    method: req.method,
    url: req.originalUrl,
    headers: req.headers,
    timestamp: new Date().toISOString(),
  });

  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.verbose(
      `Processed request: ${req.method} ${req.originalUrl}, status: ${res.statusCode}, duration: ${duration}ms`,
      {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        responseTime: duration,
        timestamp: new Date().toISOString(),
      },
    );
  });

  next();
});

// Common assertions on every endpoint
app.use(async function (req, res, next) {
  if (isHealthEndpoint(req.path)) {
    return next();
  }

  try {
    // Enforce READ_ONLY before wallet availability assertions so writes are
    // consistently rejected with the canonical 403 response.
    const isV2Route = req.path.startsWith('/v2/');
    const isV1Route = req.path.startsWith('/v1/');
    let READ_ONLY = false;
    if (isV2Route) {
      READ_ONLY = getConfigV2().READ_ONLY || false;
    } else if (isV1Route) {
      READ_ONLY = getConfig().READ_ONLY || false;
    } else {
      READ_ONLY = getConfigV2().READ_ONLY || getConfig().READ_ONLY || false;
    }
    if (READ_ONLY && isReadOnlyMethodBlocked(req.method)) {
      return sendReadOnlyError(res);
    }

    // Defensive disk-space guard. SQLite (the V1/V2 backing store) returns
    // SQLITE_FULL mid-transaction when the underlying filesystem runs out
    // of space, which can corrupt the WAL and leave the DB inconsistent.
    // Reject POST/PUT/PATCH below the hardcoded BLOCK_BYTES threshold
    // (see src/utils/disk-space.js) so reads stay available and operators
    // can free space via DELETE without restarting. Runs after READ_ONLY
    // (configuration wins over transient state) but before the wallet/
    // datalayer RPC checks below so we don't pay an RPC cost on a request
    // we already know we can't persist.
    if (isWriteRejectedByDiskGuard(req.method)) {
      let diskStatus = null;
      try {
        diskStatus = await checkDiskSpace();
        logDiskSpaceStatus(diskStatus);
      } catch (diskErr) {
        // Fail open: a bug in the guard itself must not take down writes.
        // computeStatus() swallows per-directory statfs errors and the
        // dir-resolution helpers don't throw, so reaching this branch
        // means something unexpected happened (e.g., getChiaRoot blew up
        // because os.homedir() failed under a misconfigured PID-1).
        logger.error(
          `disk-space-guard: unexpected check failure: ${diskErr.message}`,
        );
      }
      if (diskStatus && diskStatus.severity === 'block') {
        return res.status(507).json(buildInsufficientDiskSpaceError());
      }
    }

    await assertChiaNetworkMatchInConfiguration();
    await assertDataLayerAvailable();
    if (req.method !== 'GET') {
      await assertWalletIsAvailable();
    }
    next();
  } catch (err) {
    if (res.headersSent) {
      logger.warn('[middleware]: Response already sent, cannot send Chia exception');
      return next(err);
    }

    res.status(400).json({
      message: 'Chia Exception',
      error: err.message,
      success: false,
    });
  }
});

app.use(function (req, res, next) {
  res.set('Cache-control', 'no-store');
  next();
});

// Add optional API key if set in config
// Route-aware: Use V2 config for V2 routes, V1 config for V1 routes
app.use(function (req, res, next) {
  const isV2Route = req.path.startsWith('/v2/');
  const isV1Route = req.path.startsWith('/v1/');

  let CADT_API_KEY;
  if (isV2Route) {
    const configV2 = getConfigV2();
    CADT_API_KEY = configV2.CADT_API_KEY;
  } else if (isV1Route) {
    const configV1 = getConfig();
    CADT_API_KEY = configV1.CADT_API_KEY;
  } else {
    // For other routes, check both versions
    const configV1 = getConfig();
    const configV2 = getConfigV2();
    CADT_API_KEY = configV2.CADT_API_KEY || configV1.CADT_API_KEY;
  }

  if (CADT_API_KEY && CADT_API_KEY !== '') {
    const apikey = req.header('x-api-key') || '';

    // Use constant-time comparison to prevent timing attacks
    // If lengths differ, we still do a comparison to avoid leaking length info
    const expectedBuffer = Buffer.from(CADT_API_KEY);
    const providedBuffer = Buffer.from(apikey);

    // timingSafeEqual requires equal length buffers, so we compare against
    // expected key length to avoid leaking the correct key's length
    const isValidLength = expectedBuffer.length === providedBuffer.length;
    const bufferToCompare = isValidLength
      ? providedBuffer
      : expectedBuffer; // Compare against itself if lengths differ (will pass, but isValidLength is false)

    const isMatch = crypto.timingSafeEqual(expectedBuffer, bufferToCompare) && isValidLength;

    if (isMatch) {
      next();
    } else {
      res.status(403).json({ message: 'CADT API key not found' });
    }
  } else {
    next();
  }
});

app.use(function (req, res, next) {
  const isV2Route = req.path.startsWith('/v2/');
  const isV1Route = req.path.startsWith('/v1/');

  let READ_ONLY;
  if (isV2Route) {
    const configV2 = getConfigV2();
    READ_ONLY = configV2.READ_ONLY || false;
  } else if (isV1Route) {
    const configV1 = getConfig();
    READ_ONLY = configV1.READ_ONLY || false;
  } else {
    // For other routes, check both versions
    const configV1 = getConfig();
    const configV2 = getConfigV2();
    READ_ONLY = configV2.READ_ONLY || configV1.READ_ONLY || false;
  }

  if (READ_ONLY) {
    res.setHeader(headerKeys.CR_READY_ONLY_HEADER_KEY, READ_ONLY);
  } else {
    res.setHeader(headerKeys.CR_READY_ONLY_HEADER_KEY, false);
  }

  next();
});

app.use(function (req, res, next) {
  const isV2Route = req.path.startsWith('/v2/');
  const isV1Route = req.path.startsWith('/v1/');

  let IS_GOVERNANCE_BODY;
  if (isV2Route) {
    const configV2 = getConfigV2();
    IS_GOVERNANCE_BODY = configV2.IS_GOVERNANCE_BODY || false;
  } else if (isV1Route) {
    const configV1 = getConfig();
    IS_GOVERNANCE_BODY = configV1.IS_GOVERNANCE_BODY || false;
  } else {
    // For other routes, check both versions
    const configV1 = getConfig();
    const configV2 = getConfigV2();
    IS_GOVERNANCE_BODY = configV2.IS_GOVERNANCE_BODY || configV1.IS_GOVERNANCE_BODY || false;
  }

  res.setHeader(headerKeys.GOVERNANCE_BODY_HEADER_KEY, IS_GOVERNANCE_BODY);
  next();
});

app.use(function (req, res, next) {
  const version = packageJson.version;
  res.setHeader(headerKeys.API_VERSION_HEADER_KEY, version);

  const majorVersion = version.split('.')[0];
  res.setHeader(headerKeys.DATA_MODEL_VERION_HEADER_KEY, `v${majorVersion}`);

  next();
});

app.use(async function (req, res, next) {
  // Skip the home-organization-synced header probe on health endpoints so
  // /diagnostics (and /health*) can respond even when migrations or the
  // organizations table are slow to come up.
  if (isHealthEndpoint(req.path)) {
    return next();
  }

  if (process.env.NODE_ENV !== 'test') {
    // Wait for migrations to complete before accessing organizations table
    const { waitForMigrations } = await import('./routes/index.js');
    await waitForMigrations();

    // Determine which version to use based on request path
    const isV2Route = req.path.startsWith('/v2/');
    const isV1Route = req.path.startsWith('/v1/');

    const configV1 = getConfig();
    const configV2 = getConfigV2();
    const enableV1 = configV1?.ENABLE !== false;
    const enableV2 = configV2?.ENABLE !== false;

    let homeOrg = null;

    // For V2 routes, only use V2 models
    if (isV2Route && enableV2) {
      try {
        homeOrg = await OrganizationsV2.getHomeOrg();
      } catch (error) {
        // V2 organization may not exist yet, which is OK
        logger.debug('No home organization found in V2');
      }
    }
    // For V1 routes, only use V1 models
    else if (isV1Route && enableV1) {
      try {
        homeOrg = await Organization.getHomeOrg();
      } catch (error) {
        // V1 organization may not exist yet, which is OK
        logger.debug('No home organization found in V1');
      }
    }
    // For other routes (like /health), check enabled versions
    else if (!isV2Route && !isV1Route) {
      // Try V2 first if enabled
      if (enableV2) {
        try {
          homeOrg = await OrganizationsV2.getHomeOrg();
        } catch (error) {
          // If V2 fails and V1 is enabled, try V1
          if (enableV1) {
            try {
              homeOrg = await Organization.getHomeOrg();
            } catch (v1Error) {
              // Both failed - organization may not exist yet, which is OK
              logger.debug('No home organization found in V1 or V2');
            }
          }
        }
      } else if (enableV1) {
        // Only V1 is enabled
        try {
          homeOrg = await Organization.getHomeOrg();
        } catch (error) {
          // Organization may not exist yet, which is OK
          logger.debug('No home organization found in V1');
        }
      }
    }

    if (homeOrg) {
      if (!['GET', 'DELETE'].includes(req.method) && !homeOrg.synced) {
        res.status(400).json({
          message:
            'Your organization data is still resyncing, please try again after it completes',
          success: false,
        });
        return;
      } else if (homeOrg?.synced) {
        res.setHeader(headerKeys.HOME_ORGANIZATION_SYNCED, true);
      } else {
        res.setHeader(headerKeys.HOME_ORGANIZATION_SYNCED, false);
      }
    }
  }

  next();
});

app.use(async function (req, res, next) {
  // Skip the all-data-synced header probe on health endpoints so /diagnostics
  // (and /health*) can respond even when migrations or the organizations
  // table are slow to come up.
  if (isHealthEndpoint(req.path)) {
    return next();
  }

  // Wait for migrations to complete before accessing organizations table
  const { waitForMigrations } = await import('./routes/index.js');
  await waitForMigrations();

  // Determine which version to use based on request path
  const isV2Route = req.path.startsWith('/v2/');
  const isV1Route = req.path.startsWith('/v1/');

  const configV1 = getConfig();
  const configV2 = getConfigV2();
  const enableV1 = configV1?.ENABLE !== false;
  const enableV2 = configV2?.ENABLE !== false;

  let orgMap = {};

  // For V2 routes, only use V2 models
  if (isV2Route && enableV2) {
    try {
      orgMap = await OrganizationsV2.getOrgsMap();
    } catch (error) {
      // V2 organizations may not exist yet, which is OK
      logger.debug('No organizations found in V2');
      orgMap = {};
    }
  }
  // For V1 routes, only use V1 models
  else if (isV1Route && enableV1) {
    try {
      orgMap = await Organization.getOrgsMap();
    } catch (error) {
      // V1 organizations may not exist yet, which is OK
      logger.debug('No organizations found in V1');
      orgMap = {};
    }
  }
  // For other routes (like /health), check enabled versions
  else if (!isV2Route && !isV1Route) {
    // Try V2 first if enabled
    if (enableV2) {
      try {
        orgMap = await OrganizationsV2.getOrgsMap();
      } catch (error) {
        // If V2 fails and V1 is enabled, try V1
        if (enableV1) {
          try {
            orgMap = await Organization.getOrgsMap();
          } catch (v1Error) {
            // Both failed - organizations may not exist yet, which is OK
            logger.debug('No organizations found in V1 or V2');
            orgMap = {};
          }
        }
      }
    } else if (enableV1) {
      // Only V1 is enabled
      try {
        orgMap = await Organization.getOrgsMap();
      } catch (error) {
        // Organizations may not exist yet, which is OK
        logger.debug('No organizations found in V1');
        orgMap = {};
      }
    }
  }

  const notSynced = Object.keys(orgMap).find((key) => !orgMap[key].synced);

  res.setHeader(headerKeys.ALL_DATA_SYNCED, !notSynced);

  const syncRemaining = Object.keys(orgMap).reduce((agg, key) => {
    return agg + (orgMap[key].sync_remaining || 0);
  }, 0);

  res.setHeader(headerKeys.SYNC_REMAINING, syncRemaining);
  next();
});

app.use(async function (req, res, next) {
  // Skip the wallet-synced header probe for health endpoints. walletIsSynced
  // can hang for up to 300s when the wallet RPC is unreachable, which would
  // defeat the purpose of /diagnostics (and slow down /health) precisely in
  // the scenarios where those endpoints are most useful.
  if (isHealthEndpoint(req.path)) {
    return next();
  }

  if (USE_SIMULATOR) {
    res.setHeader(headerKeys.WALLET_SYNCED, true);
  } else {
    res.setHeader(headerKeys.WALLET_SYNCED, await datalayer.walletIsSynced());
  }

  next();
});

app.get('/health', (req, res) => {
  // Non-blocking: build the cached disk-space projection (helper handles
  // peek + transition log + async refresh + safe-fail). Synchronously
  // awaiting statfs here would risk timing out k8s liveness probes when
  // the filesystem is slow.
  res.status(200).json({
    message: 'OK',
    timestamp: new Date().toISOString(),
    diskSpace: buildHealthDiskSpacePayload(),
  });
});

// System-wide diagnostics. Mounted on the root app (not under /v1 or /v2) so
// it can report CADT, Chia, and machine status independent of the data-model
// version. Lives in HEALTH_ENDPOINTS above so it bypasses the rate limiter,
// startup gates, and the Chia/datalayer assertions -- this endpoint is meant
// to be useful precisely when those subsystems are broken.
//
// Auth: handled by the global API-key middleware further up, which runs for
// EVERY route including HEALTH_ENDPOINTS. When CADT_API_KEY is configured the
// caller must present x-api-key before reaching this handler. We rely on
// that single enforcement point rather than duplicating the constant-time
// check here.
//
// Disabled in read-only mode: the diagnostics payload exposes system details
// (paths, wallet balances, peer IPs, subscription IDs) that should not be
// served on unauthenticated public-observer nodes.
app.get('/diagnostics', async (req, res) => {
  try {
    const configV1 = getConfig();
    const configV2 = getConfigV2();
    if (configV2.READ_ONLY || configV1.READ_ONLY) {
      return res.status(403).json({
        error: 'The /diagnostics endpoint is not available on read-only nodes',
      });
    }
    const { getDiagnosticsResponse } = await import('./routes/diagnostics.js');
    const result = await getDiagnosticsResponse();
    return res.status(200).json(result);
  } catch (error) {
    logger.error(`[diagnostics]: unexpected error building response: ${error.message}`);
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      error: `Failed to build diagnostics response: ${error.message}`,
    });
  }
});

// Conditionally mount V1 and V2 routes based on config
// Each version's enable flag is in its own config file
const configV1 = getConfig();
const configV2 = getConfigV2();
const enableV1 = configV1?.ENABLE !== false; // Default to true if not set
const enableV2 = configV2?.ENABLE !== false; // Default to true if not set

if (enableV1) {
  app.use('/v1', V1Router);
  logger.info('[v1]: V1 API routes enabled');
} else {
  // Return 403 Forbidden for disabled V1 endpoints
  // 403 is more appropriate than 503 since this is a configuration choice, not temporary unavailability
  app.use('/v1', (req, res) => {
    res.status(403).json({
      error: 'V1 API is disabled',
      message: 'V1 functionality has been disabled',
      success: false,
    });
  });
  logger.info('[v1]: V1 API routes disabled');
}

if (enableV2) {
  app.use('/v2', V2Router);
  logger.info('[v2]: V2 API routes enabled');
} else {
  // Return 403 Forbidden for disabled V2 endpoints
  // 403 is more appropriate than 503 since this is a configuration choice, not temporary unavailability
  app.use('/v2', (req, res) => {
    res.status(403).json({
      error: 'V2 API is disabled',
      message: 'V2 functionality has been disabled',
      success: false,
    });
  });
  logger.info('[v2]: V2 API routes disabled');
}

// Security warning for missing API keys
// This is a critical security check - APIs without keys are accessible to anyone
const v1ApiKeyConfigured = enableV1 && configV1.CADT_API_KEY && configV1.CADT_API_KEY !== '';
const v2ApiKeyConfigured = enableV2 && configV2.CADT_API_KEY && configV2.CADT_API_KEY !== '';

if (enableV1 && !v1ApiKeyConfigured) {
  logger.warn('================================================================================');
  logger.warn('  SECURITY WARNING: V1 API is running WITHOUT an API key!');
  logger.warn('  All V1 endpoints are accessible without authentication.');
  logger.warn('  Set CADT_API_KEY in your config file to secure the API.');
  logger.warn('================================================================================');
}

if (enableV2 && !v2ApiKeyConfigured) {
  logger.warn('================================================================================');
  logger.warn('  SECURITY WARNING: V2 API is running WITHOUT an API key!');
  logger.warn('  All V2 endpoints are accessible without authentication.');
  logger.warn('  Set CADT_API_KEY in your config file to secure the API.');
  logger.warn('================================================================================');
}

if ((enableV1 && v1ApiKeyConfigured) || (enableV2 && v2ApiKeyConfigured)) {
  if (enableV1 && v1ApiKeyConfigured) {
    logger.info('[v1]: API key authentication enabled');
  }
  if (enableV2 && v2ApiKeyConfigured) {
    logger.info('[v2]: API key authentication enabled');
  }
}

app.use((err, req, res, next) => {
  if (err) {
    if (res.headersSent) {
      logger.warn('[middleware]: Response already sent, cannot handle error');
      return next(err);
    }

    // Handle Multer file upload errors with user-friendly messages
    if (err.code === 'LIMIT_FILE_SIZE') {
      // Determine the limit based on the route
      let limitDescription = 'the maximum allowed size';
      if (req.path.includes('/organization') || req.path.includes('/organizations')) {
        limitDescription = '2MB for organization icons';
      } else if (req.path.includes('/filestore') || req.path.includes('/file-store')) {
        limitDescription = '100MB for file store uploads';
      } else if (req.path.includes('/offer')) {
        limitDescription = '5MB for offer files';
      } else if (req.path.includes('/xlsx') || req.path.includes('/batch')) {
        limitDescription = '25MB for batch/XLSX uploads';
      }

      return res.status(413).json({
        message: `File too large. Maximum file size is ${limitDescription}.`,
        error: 'LIMIT_FILE_SIZE',
        success: false,
      });
    }

    // Handle other Multer errors
    if (err.code && err.code.startsWith('LIMIT_')) {
      return res.status(400).json({
        message: `File upload error: ${err.message}`,
        error: err.code,
        success: false,
      });
    }

    if (_.get(err, 'error.details')) {
      // format Joi validation errors
      return res.status(400).json({
        message: 'Data Validation error',
        errors: err.error.details.map((detail) => {
          return _.get(detail, 'context.message', detail.message);
        }),
        success: false,
      });
    }

    // If err is an Error object, it won't serialize well - extract message
    if (err instanceof Error) {
      return res.status(err?.status || 400).json({
        message: err.message || 'An error occurred',
        error: err.message,
        success: false,
      });
    }

    return res.status(err?.status || 400).json(err);
  }

  next();
});

export default app;
