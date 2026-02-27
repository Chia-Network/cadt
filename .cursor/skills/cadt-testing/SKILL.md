---
name: cadt-testing
description: Run CADT integration tests, live API tests, and test data cleanup. Use when the user asks to run integration tests, run v1 or v2 tests, run live API tests, or delete test data.
---

# CADT Testing

Prefix all commands with `fnm use &&` per the `node-environment` rule.

## Integration Tests (Simulation Mode)

In-memory SQLite with simulator. No CADT server, Chia, or datalayer required.

### "Run the integration tests" = run both v1 and v2 in parallel

```bash
npm run test:v1 &
npm run test:v2 &
wait
```

V1 and V2 use different ports (31310 and 31311 via `CW_PORT` env var) and isolated
databases (via `TEST_RUN_ID`), so they run safely in parallel. Do **not** use the
combined `npm test` script — it runs all specs in one process, causing v1/v2 interference.

| Command | Port | Test files |
|---------|------|-----------|
| `npm run test:v1` | 31310 | `tests/integration/**/*.spec.js`, `tests/resources/**/*.spec.js` |
| `npm run test:v2` | 31311 | `tests/v2/integration/**/*.spec.js` |

### How they work

- `run-tests.sh` generates a unique `TEST_RUN_ID`, creates isolated SQLite DBs in `tests/test-dbs/`, cleans up on exit
- Environment: `NODE_ENV=test`, `USE_SIMULATOR=true`, `CW_PORT=<port>`
- Port isolation: `CW_PORT` env var overrides `APP.CW_PORT` in config-loader.js
- Timeout: 300s per test

## Live API Tests

Run against a real CADT server with actual Chia datalayer.

### Prerequisites

- CADT server running on port 31310
- Chia node + datalayer running and synced
- Home organization created
- Empty database for POST phases (or `SKIP_EMPTY_CHECK=true`)
- Config at `~/.chia/mainnet/cadt/config.yaml`
- Optional: MySQL mirror DB for mirror verification

### "Run the v2 live API test" = data-short

```bash
npm run test:v2:live:data:short
```

Runs `tests/v2/live-api/data-short.js`:
1. Validate request failures (bad data rejected)
2. POST all test records, batch commit
3. Validate child record failures
4. PUT all records, batch commit
5. DELETE all records, batch commit

After each commit, verifies records in DB (and optionally MySQL mirror).

### All live API commands

| Command | Purpose |
|---------|---------|
| `npm run test:v2:live:data:short` | V2 short mode: batch commit per phase |
| `npm run test:v2:live:data:extended` | V2 extended mode: commit per endpoint |
| `npm run test:v1:live:data:short` | V1 short mode |
| `npm run test:v2:live:organization:create` | Create V2 home organization |
| `npm run test:v1:live:organization:create` | Create V1 home organization |
| `npm run test:v1:live:organization:upgrade` | Upgrade V1 org to V2 |
| `npm run test:v2:live:organization:delete` | Delete V2 organization |

### Test modes

- **Short** (`TEST_MODE=short`): Batch all POSTs/PUTs/DELETEs with one commit per phase. Faster.
- **Extended** (`TEST_MODE=extended`): Each test file commits individually. More thorough.

## Delete Test Data

If user specifies a version, run that version. If unspecified, run both:

```bash
npm run test:v1:delete-test-data
npm run test:v2:delete-test-data
```

| Command | Behavior |
|---------|----------|
| `npm run test:v1:delete-test-data` | Deletes records with `TEST-` prefix from V1 projects and units |
| `npm run test:v2:delete-test-data` | Deletes all records from 20 V2 data tables (children first) |

Both require a running CADT server. Timeout: 600s.

V2 delete flow: clear staging -> GET all -> stage DELETEs -> commit -> wait for staging empty -> verify.
