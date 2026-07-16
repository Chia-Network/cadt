#!/usr/bin/env node

/**
 * Pre-flight check script for live API tests
 *
 * Run this before live API tests to verify that:
 * 1. CADT server is running and reachable
 * 2. Config file exists and has expected settings
 * 3. V1/V2 APIs are enabled as expected
 * 4. Chia services are available and synced
 *
 * Usage: node scripts/preflight-check.js [--port 31310] [--require-v1] [--require-v2]
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name, defaultValue) => {
  const index = args.indexOf(name);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return defaultValue;
};
const hasFlag = (name) => args.includes(name);

const PORT = parseInt(getArg('--port', '31310'), 10);
const REQUIRE_V1 = hasFlag('--require-v1');
const REQUIRE_V2 = hasFlag('--require-v2');
const TIMEOUT = parseInt(getArg('--timeout', '10000'), 10);

// Status tracking
const results = {
  configFile: { status: 'pending', message: '' },
  pm2Status: { status: 'pending', message: '' },
  portListeners: { status: 'pending', message: '' },
  serverConnection: { status: 'pending', message: '' },
  rootHealth: { status: 'pending', message: '' },
  v1Health: { status: 'pending', message: '' },
  v2Health: { status: 'pending', message: '' },
};

/**
 * Get timestamp for logging
 */
const getTimestamp = () => {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
};

/**
 * Log with timestamp and status indicator
 */
const log = (message, status = 'info') => {
  const icons = {
    info: 'ℹ️ ',
    success: '✓ ',
    warning: '⚠️ ',
    error: '❌',
    pending: '⏳',
  };
  console.log(`[${getTimestamp()}] ${icons[status] || '  '} ${message}`);
};

/**
 * Make HTTP request with timeout
 */
const httpRequest = (url, timeout = TIMEOUT) => {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const req = client.get(url, { timeout }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: JSON.parse(data),
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
          });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after ${timeout}ms`));
    });
  });
};

/**
 * Check if config file exists and read it
 */
const checkConfigFile = async () => {
  log('Checking CADT config file...');

  const chiaRoot = process.env.CHIA_ROOT || path.join(process.env.HOME || '', '.chia', 'mainnet');
  const configPath = path.join(chiaRoot, 'cadt', 'config.yaml');

  if (!fs.existsSync(configPath)) {
    results.configFile = {
      status: 'error',
      message: `Config file not found at: ${configPath}`,
    };
    log(`Config file not found: ${configPath}`, 'error');
    return null;
  }

  try {
    const config = yaml.load(fs.readFileSync(configPath, 'utf8'));

    // Extract key settings
    const port = config?.APP?.CW_PORT || 31310;
    const v1Enabled = config?.V1?.ENABLE !== false;
    const v2Enabled = config?.V2?.ENABLE !== false;
    const logLevel = config?.APP?.LOG_LEVEL || 'info';

    log(`Config file found: ${configPath}`, 'success');
    log(`  Port: ${port}`);
    log(`  V1 Enabled: ${v1Enabled}`);
    log(`  V2 Enabled: ${v2Enabled}`);
    log(`  Log Level: ${logLevel}`);

    results.configFile = {
      status: 'success',
      message: `Found config at ${configPath}`,
      config: { port, v1Enabled, v2Enabled, logLevel },
    };

    // Warn if required versions are disabled
    if (REQUIRE_V1 && !v1Enabled) {
      log('V1 is required but disabled in config!', 'warning');
    }
    if (REQUIRE_V2 && !v2Enabled) {
      log('V2 is required but disabled in config!', 'warning');
    }

    return config;
  } catch (err) {
    results.configFile = {
      status: 'error',
      message: `Failed to parse config: ${err.message}`,
    };
    log(`Failed to parse config: ${err.message}`, 'error');
    return null;
  }
};

/**
 * Check server connection with retries
 * Retries a few times since the server may still be starting up
 */
const checkServerConnection = async () => {
  log(`Checking server connection on port ${PORT}...`);

  const maxRetries = 5;
  const retryDelay = 3000; // 3 seconds between retries
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Use 127.0.0.1 instead of localhost for more reliable connections in containers
      const response = await httpRequest(`http://127.0.0.1:${PORT}/health`);

      if (response.status === 200) {
        results.serverConnection = {
          status: 'success',
          message: `Server reachable on port ${PORT}`,
        };
        log(`Server is reachable on port ${PORT}`, 'success');
        return true;
      } else if (response.status === 400) {
        // 400 means server IS running but Chia services aren't ready
        const errorMsg = response.body?.error || response.body?.message || 'Chia services not ready';
        results.serverConnection = {
          status: 'warning',
          message: `Server running but returned 400: ${errorMsg}`,
        };
        log(`Server is running but Chia services not ready: ${errorMsg}`, 'warning');
        return true; // Server IS reachable, will let health checks provide more detail
      } else {
        results.serverConnection = {
          status: 'warning',
          message: `Server responded with status ${response.status}`,
        };
        log(`Server responded with status: ${response.status}`, 'warning');
        return true; // Server is reachable, just not healthy
      }
    } catch (err) {
      lastError = err;
      if (err.code === 'ECONNREFUSED') {
        if (attempt < maxRetries) {
          log(`Connection refused (attempt ${attempt}/${maxRetries}), retrying in ${retryDelay / 1000}s...`, 'warning');
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      } else {
        // Other errors - don't retry
        break;
      }
    }
  }

  // All retries exhausted
  if (lastError?.code === 'ECONNREFUSED') {
    results.serverConnection = {
      status: 'error',
      message: `Connection refused on port ${PORT} after ${maxRetries} attempts - server not running?`,
    };
    log(`Connection refused on port ${PORT} after ${maxRetries} attempts - is CADT server running?`, 'error');
  } else {
    results.serverConnection = {
      status: 'error',
      message: `Connection error: ${lastError?.message || 'Unknown error'}`,
    };
    log(`Connection error: ${lastError?.message || 'Unknown error'}`, 'error');
  }
  return false;
};

/**
 * Check root health endpoint
 */
const checkRootHealth = async () => {
  log('Checking root /health endpoint...');

  try {
    const response = await httpRequest(`http://127.0.0.1:${PORT}/health`);

    if (response.status === 200) {
      results.rootHealth = {
        status: 'success',
        message: 'Root health check passed',
        response: response.body,
      };
      log('Root health check passed', 'success');
      return true;
    } else if (response.status === 400) {
      // Chia exception
      const errorMsg = response.body?.error || response.body?.message || 'Unknown';
      results.rootHealth = {
        status: 'error',
        message: `Health check failed: ${errorMsg}`,
        response: response.body,
      };
      log(`Health check returned 400: ${errorMsg}`, 'error');

      // Provide specific guidance
      if (errorMsg.includes('DataLayer') || errorMsg.includes('datalayer')) {
        log('  → Chia DataLayer service may not be running', 'info');
        log('  → Try: chia start data', 'info');
      }
      if (errorMsg.includes('wallet') || errorMsg.includes('syncing')) {
        log('  → Chia wallet may still be syncing', 'info');
        log('  → Check: chia wallet show', 'info');
      }
      return false;
    } else {
      results.rootHealth = {
        status: 'warning',
        message: `Unexpected status: ${response.status}`,
        response: response.body,
      };
      log(`Unexpected response status: ${response.status}`, 'warning');
      return false;
    }
  } catch (err) {
    results.rootHealth = {
      status: 'error',
      message: `Request failed: ${err.message}`,
    };
    log(`Root health request failed: ${err.message}`, 'error');
    return false;
  }
};

/**
 * Check V1 API is enabled via /v1/health endpoint
 */
const checkV1Health = async () => {
  log('Checking V1 /v1/health endpoint...');

  try {
    const response = await httpRequest(`http://127.0.0.1:${PORT}/v1/health`);

    if (response.status === 200) {
      results.v1Health = {
        status: 'success',
        message: 'V1 health check passed',
      };
      log('V1 health check passed', 'success');
      return true;
    } else if (response.status === 403) {
      const errorMsg = response.body?.error || response.body?.message || 'V1 API disabled';
      results.v1Health = {
        status: REQUIRE_V1 ? 'error' : 'warning',
        message: `V1 API is disabled: ${errorMsg}`,
        response: response.body,
      };
      log(`V1 API is disabled (403)${REQUIRE_V1 ? ' - REQUIRED!' : ''}`, REQUIRE_V1 ? 'error' : 'warning');
      log('  → Set V1.ENABLE = true in config.yaml to enable', 'info');
      return !REQUIRE_V1;
    } else if (response.status === 400) {
      const errorMsg = response.body?.error || response.body?.message || 'Unknown';
      results.v1Health = {
        status: 'error',
        message: `V1 health returned 400: ${errorMsg}`,
        response: response.body,
      };
      log(`V1 health returned 400: ${errorMsg}`, 'error');
      return false;
    } else {
      results.v1Health = {
        status: 'warning',
        message: `Unexpected status: ${response.status}`,
        response: response.body,
      };
      log(`V1 unexpected response status: ${response.status}`, 'warning');
      return true; // Don't fail on unexpected status
    }
  } catch (err) {
    results.v1Health = {
      status: 'error',
      message: `Request failed: ${err.message}`,
    };
    log(`V1 API request failed: ${err.message}`, 'error');
    return false;
  }
};

/**
 * Check V2 health endpoint
 */
const checkV2Health = async () => {
  log('Checking V2 /v2/health endpoint...');

  try {
    const response = await httpRequest(`http://127.0.0.1:${PORT}/v2/health`);

    if (response.status === 200) {
      results.v2Health = {
        status: 'success',
        message: 'V2 health check passed',
        response: response.body,
      };
      log('V2 health check passed', 'success');
      return true;
    } else if (response.status === 403) {
      results.v2Health = {
        status: REQUIRE_V2 ? 'error' : 'warning',
        message: 'V2 API is disabled',
        response: response.body,
      };
      log(`V2 API is disabled (403)${REQUIRE_V2 ? ' - REQUIRED!' : ''}`, REQUIRE_V2 ? 'error' : 'warning');
      log('  → Set V2.ENABLE = true in config.yaml to enable', 'info');
      return !REQUIRE_V2;
    } else if (response.status === 400) {
      const errorMsg = response.body?.error || response.body?.message || 'Unknown';
      results.v2Health = {
        status: 'error',
        message: `V2 health failed: ${errorMsg}`,
        response: response.body,
      };
      log(`V2 health check returned 400: ${errorMsg}`, 'error');

      // Provide specific guidance
      if (errorMsg.includes('DataLayer') || errorMsg.includes('datalayer')) {
        log('  → Chia DataLayer service may not be running', 'info');
      }
      if (errorMsg.includes('wallet') || errorMsg.includes('syncing')) {
        log('  → Chia wallet may still be syncing', 'info');
      }
      return false;
    } else {
      results.v2Health = {
        status: 'warning',
        message: `Unexpected status: ${response.status}`,
        response: response.body,
      };
      log(`V2 unexpected response status: ${response.status}`, 'warning');
      return false;
    }
  } catch (err) {
    results.v2Health = {
      status: 'error',
      message: `Request failed: ${err.message}`,
    };
    log(`V2 health request failed: ${err.message}`, 'error');
    return false;
  }
};

/**
 * Check pm2 process status (if pm2 is available)
 */
const checkPm2Status = async () => {
  log('Checking pm2 process status...');

  try {
    const { execSync } = await import('child_process');

    // Get pm2 list in JSON format
    try {
      const pm2Output = execSync('pm2 jlist 2>/dev/null', { encoding: 'utf8', timeout: 5000 });
      const processes = JSON.parse(pm2Output);

      const cadtProcess = processes.find(p => p.name === 'cadt');
      if (cadtProcess) {
        const status = cadtProcess.pm2_env?.status || 'unknown';
        const uptime = cadtProcess.pm2_env?.pm_uptime;
        const restarts = cadtProcess.pm2_env?.restart_time || 0;

        log(`pm2 'cadt' process found:`, 'success');
        log(`  Status: ${status}`);
        log(`  PID: ${cadtProcess.pid || 'N/A'}`);
        log(`  Restarts: ${restarts}`);
        if (uptime) {
          const uptimeSec = Math.floor((Date.now() - uptime) / 1000);
          log(`  Uptime: ${uptimeSec}s`);
        }

        results.pm2Status = {
          status: status === 'online' ? 'success' : 'warning',
          message: `Process ${status}, PID: ${cadtProcess.pid || 'N/A'}, restarts: ${restarts}`,
        };
      } else {
        log('pm2 cadt process not found', 'warning');
        results.pm2Status = {
          status: 'warning',
          message: 'cadt process not found in pm2',
        };
      }
    } catch (e) {
      log(`pm2 not available or error: ${e.message}`, 'warning');
      results.pm2Status = {
        status: 'warning',
        message: `pm2 check failed: ${e.message}`,
      };
    }

    // Check what's listening on the port (informational only - connection check is more reliable)
    log(`Checking what's listening on port ${PORT}...`);
    try {
      // Try ss first (more common on modern Linux)
      let portOutput;
      try {
        portOutput = execSync(`ss -tlnp 2>/dev/null | grep :${PORT} || true`, { encoding: 'utf8', timeout: 5000 });
      } catch {
        // Fall back to netstat
        try {
          portOutput = execSync(`netstat -tlnp 2>/dev/null | grep :${PORT} || true`, { encoding: 'utf8', timeout: 5000 });
        } catch {
          portOutput = '';
        }
      }

      if (portOutput && portOutput.trim()) {
        log(`Port ${PORT} listeners:`, 'info');
        portOutput.trim().split('\n').forEach(line => {
          log(`  ${line.trim()}`);
        });
        results.portListeners = {
          status: 'success',
          message: `Found listeners on port ${PORT}`,
        };
      } else {
        // This is just informational - the actual connection check is more reliable
        log(`Could not detect port listeners (ss/netstat may not be available)`, 'warning');
        results.portListeners = {
          status: 'warning',
          message: `Could not detect port listeners (tool not available)`,
        };
      }
    } catch (e) {
      log(`Could not check port listeners: ${e.message}`, 'warning');
      results.portListeners = {
        status: 'warning',
        message: `Port check failed: ${e.message}`,
      };
    }

    // Check all listening TCP ports
    log('Checking all listening TCP ports...');
    try {
      let allPorts;
      try {
        allPorts = execSync('ss -tlnp 2>/dev/null | head -20 || true', { encoding: 'utf8', timeout: 5000 });
      } catch {
        allPorts = execSync('netstat -tlnp 2>/dev/null | head -20 || true', { encoding: 'utf8', timeout: 5000 });
      }

      if (allPorts && allPorts.trim()) {
        log('All TCP listeners (first 20):');
        allPorts.trim().split('\n').forEach(line => {
          log(`  ${line.trim()}`);
        });
      }
    } catch (e) {
      log(`Could not list all ports: ${e.message}`, 'warning');
    }
  } catch (e) {
    log(`Process check failed: ${e.message}`, 'error');
    results.pm2Status = {
      status: 'error',
      message: `Process check failed: ${e.message}`,
    };
  }
};

/**
 * Print final summary
 */
const printSummary = () => {
  console.log('\n' + '='.repeat(60));
  console.log('PRE-FLIGHT CHECK SUMMARY');
  console.log('='.repeat(60));

  const statusIcons = {
    success: '✓',
    warning: '⚠️',
    error: '❌',
    pending: '?',
  };

  // Informational checks (warnings OK)
  const infoChecks = [
    ['PM2 Status', results.pm2Status],
    ['Port Listeners', results.portListeners],
  ];

  // Critical checks (errors cause failure)
  const criticalChecks = [
    ['Config File', results.configFile],
    ['Server Connection', results.serverConnection],
    ['Root Health', results.rootHealth],
    ['V1 API', results.v1Health],
    ['V2 Health', results.v2Health],
  ];

  console.log('--- Diagnostic Info ---');
  for (const [name, result] of infoChecks) {
    const icon = statusIcons[result.status] || '?';
    console.log(`${icon} ${name}: ${result.message || result.status}`);
  }

  console.log('\n--- Critical Checks ---');
  for (const [name, result] of criticalChecks) {
    const icon = statusIcons[result.status] || '?';
    console.log(`${icon} ${name}: ${result.message || result.status}`);
  }

  console.log('='.repeat(60));

  // Determine overall status - only critical checks matter for pass/fail
  const criticalResults = [
    results.configFile,
    results.serverConnection,
    results.rootHealth,
    results.v1Health,
    results.v2Health,
  ];

  const hasErrors = criticalResults.some((r) => r.status === 'error');
  const hasWarnings = criticalResults.some((r) => r.status === 'warning');

  if (hasErrors) {
    console.log('\n❌ PRE-FLIGHT CHECK FAILED - Fix errors above before running tests\n');
    return 1;
  } else if (hasWarnings) {
    console.log('\n⚠️  PRE-FLIGHT CHECK PASSED WITH WARNINGS\n');
    return 0;
  } else {
    console.log('\n✓ ALL PRE-FLIGHT CHECKS PASSED\n');
    return 0;
  }
};

/**
 * Main function
 */
const main = async () => {
  console.log('='.repeat(60));
  console.log('CADT PRE-FLIGHT CHECK');
  console.log('='.repeat(60));
  console.log(`Port: ${PORT}`);
  console.log(`Require V1: ${REQUIRE_V1}`);
  console.log(`Require V2: ${REQUIRE_V2}`);
  console.log(`Timeout: ${TIMEOUT}ms`);
  console.log('='.repeat(60) + '\n');

  // Run checks
  await checkConfigFile();

  // Check pm2 and port status first - this helps diagnose connection issues
  await checkPm2Status();

  const serverReachable = await checkServerConnection();

  if (serverReachable) {
    await checkRootHealth();
    await checkV1Health();
    await checkV2Health();
  } else {
    // Server not reachable - the pm2/port checks above will help diagnose why
    log('Server not reachable - see pm2 and port status above for diagnostics', 'error');
  }

  // Print summary and exit with appropriate code
  const exitCode = printSummary();
  process.exit(exitCode);
};

main().catch((err) => {
  console.error('Pre-flight check failed with error:', err);
  process.exit(1);
});
