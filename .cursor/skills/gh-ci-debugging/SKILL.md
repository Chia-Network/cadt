---
name: gh-ci-debugging
description: Debug GitHub Actions CI failures for the CADT project using the gh CLI. Use when the user asks to investigate a CI failure, check CI status, view CI logs, debug a GitHub Actions run, or references a GitHub Actions URL.
---

# Debugging CADT CI with `gh`

## Required: Deep investigation before reporting

Do NOT conclude "infrastructure flakiness" or recommend "re-run" without completing ALL of these:

1. **Read CADT server logs**, not just test output. Test output shows symptoms (timeouts, assertion failures). CADT logs show causes (process failures, wallet errors, store creation errors). Always run:
   ```bash
   gh run view --log --job <JOB_ID> 2>&1 | grep "Show CADT logs after" -A 5000 | grep -iE "error|failed|removing"
   ```

2. **Build a timeline.** Extract timestamps for: when the operation started, when errors occurred, when the test gave up. If the error happened early but the test ran for 20+ more minutes, the test couldn't detect the failure — that's a bug, not flakiness.

3. **Check if transient errors recovered.** If you see wallet sync errors, check the end-of-job wallet status (`Show wallet balance` step). If the wallet is synced at job end but the operation failed mid-job, the error was transient and the code should have retried.

4. **Read the source code for the failing operation.** Check whether it has retry logic, `waitForSpendableCoins()` calls, or error handling for transient wallet errors. Compare to similar operations that DO work (e.g., `createV2Organization` vs `upgradeFromV1`).

5. **Never recommend "re-run" as the primary action.** If investigation reveals a code-level gap (missing retry, missing wallet check, broken fast-fail logic), that's a bug to fix — not flakiness to retry past.

## CI Jobs Overview

The `.github/workflows/tests.yaml` workflow has 5 parallel jobs:

| Job name | Job key | What it tests | npm script(s) |
|---|---|---|---|
| v1 integration tests | `test-v1` | Unit/integration (simulator) | `npm run test:v1` |
| v2 integration tests | `test-v2` | Unit/integration (simulator) | `npm run test:v2` |
| v2 live api tests | `test-v2-live-api` | E2E with real Chia + datalayer | See below |
| v1 live api tests | `test-v1-live-api` | E2E with real Chia + datalayer | See below |
| v1 to v2 upgrade test | `test-v1-to-v2-upgrade` | V1 org creation then upgrade to V2 | `npm run test:v1:live:organization:upgrade` |

### Integration test jobs

Install deps, run `npm run test:v1` or `npm run test:v2` with `USE_SIMULATOR=true`. No Chia/datalayer needed.

### Live API test setup sequence

1. Install deps + global packages (babel, sequelize-cli, cross-env, pm2)
2. Install yq, jq, bc, iproute2
3. **v2 only:** Install and configure MariaDB for mirror database testing
4. Install Chia and chia-tools
5. Configure Chia (init, keys, testneta, trusted peer)
6. Configure CADT (start/stop to create config, edit config.yaml with yq)
7. Start Chia services (wallet, data, data_layer_http)
8. Faucet: request testnet funds, wait for balance
9. Start CADT via pm2
10. Wait for wallet sync + datalayer readiness (up to 20 min)
11. Pre-flight check (`npm run preflight-check:v1`, `:v2`, or `:v1v2`)
12. Run test suites sequentially
13. **Always** steps: show logs, stop CADT, delete mirrors, stop Chia

### V2 Live API test order

1. `npm run test:v2:live:organization:create`
2. `npm run test:v2:live:data:short` (via `tests/v2/live-api/data-short.js`)
3. `npm run test:v2:live:organization:delete`

### V1 Live API test order

1. `npm run test:v1:live:organization:create`
2. `npm run test:v1:live:data:short` (via `tests/v1/live-api/data-short.js`)

## Debugging Workflow

### Step 1: Identify the run

Extract `<RUN_ID>` from a GitHub Actions URL, or:
```bash
gh run list --status failure --limit 5
gh pr checks <PR_NUMBER>
```

### Step 2: Get run overview

```bash
gh run view <RUN_ID> --json conclusion,status,event,headBranch,displayTitle,url
```

### Step 3: Identify failed jobs and steps

```bash
gh run view <RUN_ID> --json jobs --jq '.jobs[] | {name: .name, conclusion: .conclusion, databaseId: .databaseId}'

gh run view <RUN_ID> --json jobs --jq '.jobs[] | select(.conclusion=="failure") | {name: .name, id: .databaseId, failedSteps: [.steps[] | select(.conclusion=="failure") | {name: .name, number: .number}]}'
```

### Step 4: Get failure logs

```bash
# RECOMMENDED FIRST -- only failed step logs
gh run view <RUN_ID> --log-failed

# Full log for a specific job (can be 5000+ lines)
gh run view --log --job <JOB_ID>

# Filter for key patterns
gh run view <RUN_ID> --log-failed 2>&1 | grep -E "failing|AssertionError|Error:|expected .* to"
gh run view <RUN_ID> --log-failed 2>&1 | grep -E "[0-9]+ (passing|failing)"
```

### Step 5: Check "always" steps for context

Live API jobs have `if: always()` diagnostic steps:
- **Show CADT logs after tests** -- full CADT stdout/stderr from pm2
- **Show Chia debug log after tests (filtered)** -- filtered Chia debug log
- **Show MySQL mirror database status** (v2 only) -- mirror DB state

```bash
gh run view --log --job <JOB_ID> 2>&1 | grep -A 500 "Show CADT logs after tests"
```

### Step 6: Get annotations

```bash
gh api repos/Chia-Network/cadt/check-runs/<JOB_ID>/annotations
```

### Step 7: Step-level details via API

```bash
gh api repos/Chia-Network/cadt/actions/jobs/<JOB_ID> --jq '.steps[] | {name: .name, conclusion: .conclusion, number: .number}'
```

## Log Output Format

```
<job_name>\t<step_name>\t<timestamp> <log_content>
```

## Common Failure Patterns

- **Test assertions:** Search for `AssertionError`, `expected ... to`, API error messages. Stack trace includes file + line number.
- **Pre-flight failures:** Step dumps PM2 status, CADT logs, config.yaml, running processes.
- **Wallet/datalayer sync:** "Wait for wallet sync" can timeout at 20 min. Look for `synced=false`. Faucet can fail if testneta is down.
- **CADT startup:** Check "Show CADT logs before tests" and "Start CADT" steps for pm2 crash output.
- **MariaDB mirror (v2 only):** "Show MySQL mirror database status" always-step shows table counts and DB state.

For test file paths and npm commands, see the `cadt-testing` skill.

## Live API Debugging: Root Cause Analysis Guide

When live API tests fail, test output shows the **symptom** (timeout, assertion). The **cause** is in CADT server logs. Always check CADT logs first:

```bash
gh run view --log --job <JOB_ID> 2>&1 | grep "Show CADT logs after" -A 5000 | grep -E "error|failed|removing failed"
```

### Wallet desync after blockchain operations

Creating stores or pushing data causes a burst of coin activity. The wallet temporarily desyncs while processing confirmations. This is **predictable**, not random. Timeline pattern:
1. Operation A succeeds (e.g., V1 org creation — 4 stores created)
2. Wallet desyncs processing A's confirmations
3. Operation B starts immediately, hits "Wallet needs to be fully synced"
4. If B has no retry logic, it fails permanently despite wallet recovering minutes later

**Key grep:** `"Wallet needs to be fully synced"`, `"DataLayerWallet not available"`, `"removing failed"`, `"process failed"`

### Fire-and-forget endpoints hide background failures

These endpoints return 200 immediately while work happens async:
- `POST /v2/organizations` (org creation)
- `POST /v2/organizations/upgrade` (V1→V2 upgrade)
- `POST /v1/organizations/create` (V1 org creation)

If the background process fails, the API gives no error — the test just sees no org appearing. Look for `"process failed"` or `"removing failed"` in CADT logs to confirm. The test's polling timeout is the symptom; the server log error (often minutes earlier) is the cause.

### Fast-fail blind spots with remote orgs

CI environments subscribe to remote orgs (e.g., "V2 Automated Testing Participant Data"). Wait/poll functions that gate failure detection on `orgs.length === 0` will never trigger because the remote org keeps the count at 1. The test loops until timeout instead of detecting failure. If you see a test polling for 20+ minutes with only non-home orgs appearing, this is the pattern.

### Audit checklist for `createDataLayerStore()` calls

Any call to `datalayer.createDataLayerStore()` without `wallet.waitForSpendableCoins()` beforehand is a reliability bug. Known protected callers: `createV2Organization()`, `addV2ToExistingGovernanceBody()`. Audit `src/` for unprotected callers when adding new store creation code.

## Quick Reference

```bash
# 1. Overview
gh run view <RUN_ID> --json conclusion,status,displayTitle,headBranch

# 2. Find failures
gh run view <RUN_ID> --json jobs --jq '.jobs[] | select(.conclusion=="failure") | {name: .name, id: .databaseId}'

# 3. Quick failure logs
gh run view <RUN_ID> --log-failed

# 4. Full job log (use JOB_ID from step 2)
gh run view --log --job <JOB_ID> 2>&1 | tail -200

# 5. Search for patterns
gh run view --log --job <JOB_ID> 2>&1 | grep -E "Error|failing|FAIL"

# 6. Check always-run diagnostic steps
gh run view --log --job <JOB_ID> 2>&1 | grep -A 100 "CADT stdout logs"
```
