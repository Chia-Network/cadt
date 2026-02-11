---
name: cadt-testing
description: Run CADT integration tests, live API tests, and test data cleanup. Use when the user asks to run integration tests, run v1 or v2 tests, run live API tests, or delete test data.
---

# CADT Testing

## Node.js Setup

This project uses `fnm` for Node version management (Node 24+, defined in `.nvmrc`). Always prefix commands:

```bash
eval "$(fnm env)" && fnm use && <command>
```

## Integration Tests (Simulation Mode)

Integration tests run against an in-memory SQLite database with a simulator — no running CADT server, Chia, or datalayer required.

### "Run the integration tests" = run both v1 and v2

```bash
eval "$(fnm env)" && fnm use && npm run test:v1
eval "$(fnm env)" && fnm use && npm run test:v2
```

Run them **separately** (not the combined `npm test`) to avoid v1/v2 test interference.

### Individual versions

| Command | What it runs |
|---------|-------------|
| `npm run test:v1` | `tests/integration/**/*.spec.js` and `tests/resources/**/*.spec.js` |
| `npm run test:v2` | `tests/v2/integration/**/*.spec.js` |

### How they work

- `run-tests.sh` wrapper generates a unique `TEST_RUN_ID`, creates isolated SQLite databases in `tests/test-dbs/`, and cleans them up on exit.
- Environment: `NODE_ENV=test`, `USE_SIMULATOR=true`
- Timeout: 300 seconds per test
- Test framework: Mocha + Chai

## Live API Tests

Live API tests run against a **real running CADT server** with actual Chia datalayer. They validate end-to-end behavior including staging, committing, and on-chain confirmation.

### Prerequisites

1. **CADT server running** on the configured port (default `31310`)
2. **Chia node and datalayer running** and synced
3. **Home organization created** in the running CADT instance
4. **Empty database** for POST phases (first run); subsequent phases set `SKIP_EMPTY_CHECK=true`
5. **Config file** at `~/.chia/mainnet/cadt/config.yaml`
6. Optional: MySQL mirror DB configured for mirror verification

### "Run the v2 live API test" = data-short

```bash
eval "$(fnm env)" && fnm use && npm run test:v2:live:data:short
```

This runs the **short mode** test (`tests/v2/live-api/data-short.js`), which:
1. Validates request failures (bad data rejected)
2. POSTs all test records, then batch commits
3. Validates child record failures
4. PUTs (updates) all records, then batch commits
5. DELETEs all records, then batch commits

After each commit, verifies records in the database (and optionally MySQL mirror).

### Other live API commands

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

- **Short** (`TEST_MODE=short`): Batches all POSTs, commits once, then all PUTs, commits once, then all DELETEs, commits once. Faster but less granular.
- **Extended** (`TEST_MODE=extended`): Each test file performs its own commits. More thorough but slower.

## Delete Test Data

### "Delete the test data"

If user specifies a version, run that version. If unspecified, run both:

```bash
# V1
eval "$(fnm env)" && fnm use && npm run test:v1:delete-test-data

# V2
eval "$(fnm env)" && fnm use && npm run test:v2:delete-test-data
```

| Command | Behavior |
|---------|----------|
| `npm run test:v1:delete-test-data` | Deletes records with `TEST-` prefix from V1 projects and units |
| `npm run test:v2:delete-test-data` | Deletes **all** records from 20 V2 data tables (dependency order: children first) |

Both require a running CADT server. Timeout: 600 seconds.

V2 delete flow: clear staging -> GET all records -> stage DELETEs -> commit -> wait for staging to empty -> verify deletion.

## Process Management

After running live tests, kill any leftover CADT processes:

```bash
lsof -ti:31310 | xargs kill -9
```

Verify they're gone:

```bash
ps aux | grep "src/server.js"
```
