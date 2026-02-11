---
name: gh-ci-debugging
description: Debug GitHub Actions CI failures for the CADT project using the gh CLI. Use when the user asks to investigate a CI failure, check CI status, view CI logs, debug a GitHub Actions run, or references a GitHub Actions URL.
---

# Debugging CADT CI with `gh`

## Repository Context

- **Repo:** `Chia-Network/cadt`
- **CI workflow file:** `.github/workflows/tests.yaml`
- **CI workflow name:** `Tests`
- **Triggers:** push to `main`, pull requests to any branch

## CI Jobs Overview

The `tests.yaml` workflow has **5 parallel jobs**:

| Job name | Job key | What it tests | npm script(s) |
|---|---|---|---|
| v1 integration tests | `test-v1` | Unit/integration tests (simulator) | `npm run test:v1` |
| v2 integration tests | `test-v2` | Unit/integration tests (simulator) | `npm run test:v2` |
| v2 live api tests | `test-v2-live-api` | End-to-end with real Chia + datalayer | See below |
| v1 live api tests | `test-v1-live-api` | End-to-end with real Chia + datalayer | See below |
| v1 to v2 upgrade test | `test-v1-to-v2-upgrade` | V1 org creation then upgrade to V2 | `npm run test:v1:live:organization:upgrade` |

### Integration test jobs (v1/v2)

Simple: install deps, run `npm run test:v1` or `npm run test:v2`. These use `USE_SIMULATOR=true` so no Chia/datalayer needed.

### Live API test jobs

Complex multi-step setup:
1. Install deps + global packages (babel, sequelize-cli, cross-env, pm2)
2. Install yq, jq, bc, iproute2
3. **v2 only:** Install and configure MariaDB for mirror database testing
4. Install Chia and chia-tools from Chia apt repo
5. Configure Chia (init, generate keys, switch to testneta, add trusted peer)
6. Configure CADT (start/stop to create config, then edit config.yaml with yq)
7. Start Chia services (wallet, data, data_layer_http)
8. Faucet: request testnet funds and wait for wallet balance
9. Start CADT via pm2
10. Wait for wallet sync and datalayer readiness (up to 20 min)
11. Pre-flight check (`npm run preflight-check:v1`, `:v2`, or `:v1v2`)
12. Run test suites sequentially
13. **Always** steps: show logs, stop CADT, delete mirrors, stop Chia

### V2 Live API Test Order

The v2 live API test step runs three test suites sequentially:
1. `npm run test:v2:live:organization:create` - Creates an organization (on-chain)
2. `npm run test:v2:live:data:short` - Runs validation tests for all data models via `tests/v2/live-api/data-short.js`
3. `npm run test:v2:live:organization:delete` - Cleans up organization

### V1 Live API Test Order

1. `npm run test:v1:live:organization:create` - Creates V1 organization
2. `npm run test:v1:live:data:short` - Runs V1 data validation tests via `tests/v1/live-api/data-short.js`

## Debugging Workflow

### Step 1: Identify the run

Given a GitHub Actions URL like `https://github.com/Chia-Network/cadt/actions/runs/<RUN_ID>`, extract the `<RUN_ID>`.

Or find recent failures:
```bash
gh run list --status failure --limit 5
```

Or check a PR:
```bash
gh pr checks <PR_NUMBER>
```

### Step 2: Get run overview

```bash
gh run view <RUN_ID> --json conclusion,status,event,headBranch,displayTitle,url
```

### Step 3: Identify failed jobs and steps

```bash
# List all jobs with their status
gh run view <RUN_ID> --json jobs --jq '.jobs[] | {name: .name, conclusion: .conclusion, databaseId: .databaseId}'

# Get the failed job ID and its failed steps
gh run view <RUN_ID> --json jobs --jq '.jobs[] | select(.conclusion=="failure") | {name: .name, id: .databaseId, failedSteps: [.steps[] | select(.conclusion=="failure") | {name: .name, number: .number}]}'
```

### Step 4: Get failure logs

**Quick view** - shows only logs from failed steps (RECOMMENDED FIRST):
```bash
gh run view <RUN_ID> --log-failed
```

**Full log for a specific job** (can be very large, 5000+ lines):
```bash
gh run view --log --job <JOB_DATABASE_ID>
```

**Filter logs with grep** for key patterns:
```bash
# Find test failures
gh run view <RUN_ID> --log-failed 2>&1 | grep -E "failing|AssertionError|Error:|✗|expected .* to"

# Find the test summary (passing/failing counts)
gh run view <RUN_ID> --log-failed 2>&1 | grep -E "[0-9]+ (passing|failing)"
```

### Step 5: Check "always" steps for more context

Live API jobs have `if: always()` steps that run even on failure. These contain critical debug info:
- **Show CADT logs after tests** - Full CADT stdout/stderr from pm2
- **Show Chia debug log after tests (filtered)** - Filtered Chia debug log
- **Show MySQL mirror database status** (v2 only) - Mirror DB state

To get these logs:
```bash
# Full log for the job, then search for the "always" step output
gh run view --log --job <JOB_DATABASE_ID> 2>&1 | grep -A 500 "Show CADT logs after tests"
```

### Step 6: Get annotations

```bash
gh api repos/Chia-Network/cadt/check-runs/<JOB_DATABASE_ID>/annotations
```

### Step 7: Check step-level details via API

```bash
# Get all steps with status for a specific job
gh api repos/Chia-Network/cadt/actions/jobs/<JOB_DATABASE_ID> --jq '.steps[] | {name: .name, conclusion: .conclusion, number: .number}'
```

## Log Output Format

CI logs from `gh run view --log` follow this format:
```
<job_name>\t<step_name>\t<timestamp> <log_content>
```

Example:
```
v2 live api tests	npm live api tests	2026-02-11T18:20:08.2354591Z   2 failing
```

## Common Failure Patterns

### Test assertion failures
Look for `AssertionError`, `expected ... to`, specific error messages in API responses. The test file and line number are in the stack trace.

### Pre-flight check failures
If the pre-flight step fails, it dumps additional debug info (PM2 status, CADT logs, config.yaml, running processes). Check those logs.

### Wallet/datalayer sync issues
The "Wait for wallet sync" step can time out after 20 minutes. Look for `synced=false` or timeout messages. Faucet step can also fail if testneta is down.

### CADT startup failures
Check the "Show CADT logs before tests" step and "Start CADT" step. CADT runs via pm2 - if it crashes, check pm2 logs.

### MariaDB mirror issues (v2 live tests only)
The "Show MySQL mirror database status" step (always runs) shows table counts and DB status.

## Key Test Files

| Path | Purpose |
|---|---|
| `tests/v2/live-api/data-short.js` | V2 short data test runner (spawns mocha for each spec) |
| `tests/v2/live-api/data-extended.js` | V2 extended data test runner |
| `tests/v1/live-api/data-short.js` | V1 short data test runner |
| `tests/v2/live-api/*-validation.live.spec.js` | Individual V2 data model validation specs |
| `tests/v1/live-api/*-validation.live.spec.js` | Individual V1 validation specs |
| `tests/v2/live-api/organization/*.live.spec.js` | V2 organization lifecycle specs |
| `tests/v2/live-api/helpers/live-api-helpers.js` | Shared helpers for live API tests |
| `tests/v2/live-api/helpers/api-request-helpers.js` | HTTP request helpers with retry logic |
| `tests/v2/live-api/data/test-data-generators.js` | Test data factories for all models |
| `scripts/preflight-check.js` | Pre-flight health check script |

## Quick Reference: Complete Debug Session

```bash
# 1. Overview
RUN_ID=21916979657
gh run view $RUN_ID --json conclusion,status,displayTitle,headBranch

# 2. Find failures
gh run view $RUN_ID --json jobs --jq '.jobs[] | select(.conclusion=="failure") | {name: .name, id: .databaseId}'

# 3. Quick failure logs
gh run view $RUN_ID --log-failed

# 4. If more context needed, get full job log
JOB_ID=63286726070  # from step 2
gh run view --log --job $JOB_ID 2>&1 | tail -200

# 5. Search for specific patterns
gh run view --log --job $JOB_ID 2>&1 | grep -E "Error|failing|FAIL"

# 6. Check always-run diagnostic steps
gh run view --log --job $JOB_ID 2>&1 | grep -A 100 "CADT stdout logs"
```
