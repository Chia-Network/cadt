# Simulation Mode Data Flow Analysis

## Key Finding: **YES, data DOES sync to main tables in simulation mode!**

## The Complete Flow

### 1. **Commit Stage** (API returns immediately)
```
POST /v1/staging/commit or /v2/staging/commit
  ↓
Staging.pushToDataLayer() / StagingV2.pushToDataLayer()
  ↓
Marks records as committed: true (synchronously)
  ↓
Calls datalayer.pushDataLayerChangeList() (NOT AWAITED - async)
  ↓
writeService.pushChangesWhenStoreIsAvailable()
  ↓
simulator.pushChangeListToDataLayer()
  ↓
Writes to `Simulator` table (key-value store)
  ↓
API returns: "Staging Table committing to full node"
```

**Important**: The API returns BEFORE the simulator write completes, and LONG BEFORE sync happens.

### 2. **Sync Stage** (Happens via scheduler every 10 seconds)
```
Scheduler runs sync-registries task (every 10 seconds)
  ↓
processJob() → syncOrganizationAudit(organization)
  ↓
Gets data from Simulator table via datalayer.getStoreData()
  ↓
Compares with Audit table to find new records
  ↓
FOR EACH DIFF (lines 563-595 in sync-registries.js):
  - If INSERT: ModelKeys[modelKey].upsert(record) → MAIN TABLE
  - If DELETE: ModelKeys[modelKey].destroy() → MAIN TABLE
  ↓
Creates Audit record
  ↓
After commit callbacks run (includes truncateStaging for home org)
```

**Critical Code** (sync-registries.js:563-595):
```javascript
if (modelKey && Object.keys(ModelKeys).includes(modelKey)) {
  const record = JSON.parse(decodeHex(diff.value));
  const primaryKeyValue = record[ModelKeys[modelKey].primaryKeyAttributes[0]];

  if (diff.type === 'INSERT') {
    logger.verbose(`[v1]: UPSERTING: ${modelKey} - ${primaryKeyValue}`);
    await ModelKeys[modelKey].upsert(record, { transaction, mirrorTransaction });
  } else if (diff.type === 'DELETE') {
    logger.verbose(`[v1]: DELETING: ${modelKey} - ${primaryKeyValue}`);
    await ModelKeys[modelKey].destroy({
      where: { [ModelKeys[modelKey].primaryKeyAttributes[0]]: primaryKeyValue },
      transaction, mirrorTransaction
    });
  }
}
```

### 3. **Cleanup Stage** (After sync completes)
```
After successful sync of home org:
  ↓
afterCommitCallbacks.push(truncateStaging) (line 605)
  ↓
Staging table is truncated
```

## V1 Test Pattern (PROVEN TO WORK)

From `tests/integration/project.spec.js:56-68`:
```javascript
// Commit staging records
await testFixtures.commitStagingRecords();

// Wait for sync (POLLING_INTERVAL * 2 * 5 = 50 seconds!)
await testFixtures.waitForDataLayerSync();
await testFixtures.waitForDataLayerSync();
await testFixtures.waitForDataLayerSync();

// Staging should be empty (truncated by scheduler)
expect(await testFixtures.getLastCreatedStagingRecord()).to.equal(undefined);

// Make sure the newly created project is in our main Db
await testFixtures.checkProjectRecordExists(warehouseProjectId);
```

### V1 Wait Time Calculation
```javascript
// common-fixtures.js:14,23
const TEST_WAIT_TIME = datalayer.POLLING_INTERVAL * 2; // 5000 * 2 = 10000ms
return setTimeout(resolve, TEST_WAIT_TIME * 5); // 10000 * 5 = 50000ms = 50 seconds
```

**V1 tests wait 50 seconds PER `waitForDataLayerSync()` call!**

Some tests call it 3 times = **150 seconds** = 2.5 minutes!

## V2 Current State

### Our Current V2 Wait Time
```javascript
// v2-test-helpers.js
export const waitForV2Sync = async (delay = 1500) => {
  await new Promise(resolve => setTimeout(resolve, delay));
};
```

**We're only waiting 1.5 seconds, but V1 waits 50 seconds!**

## Why V1 Tests Work

1. **Scheduler runs every 10 seconds** (sync-registries.js:75-82)
2. **V1 waits 50+ seconds** - guarantees 5+ scheduler cycles
3. **Scheduler:**
   - Reads from `Simulator` table
   - Upserts/deletes in main tables (Unit, Project, etc.)
   - Truncates staging table
4. **Tests verify main table data** - which is the final user-visible state

## Root Cause of V2 Test Failures

### Issue 2 & 9: "expected null to exist" / "expected null to equal 'Climate Marketplace'"
- We commit staging
- We wait 1.5 seconds (NOT ENOUGH!)
- Scheduler hasn't run yet or hasn't completed sync
- Main table is still empty
- **Fix**: Increase wait time to match V1 pattern

### Issues 3-6: "There are 1 pending commit(s)"
- Previous test committed staging
- Scheduler hasn't cleaned up yet
- Next test tries to run, sees uncommitted staging
- **Fix**: Either run validation tests first (good idea!) OR wait for staging cleanup

### Issues 7-8: Estimation update/delete failing
- Same contamination issue
- **Fix**: Ensure staging is clean before test setup

## Recommended Solution

### Option 1: Match V1 Wait Times (Conservative)
```javascript
export const waitForV2Sync = async (cycles = 1) => {
  // Match v1: POLLING_INTERVAL * 2 * 5 = 50 seconds per cycle
  const delay = 50000 * cycles;
  await new Promise(resolve => setTimeout(resolve, delay));
};
```

### Option 2: Optimize for Test Speed (Balanced)
```javascript
export const waitForV2Sync = async (delay = 15000) => {
  // 15 seconds = 1-2 scheduler cycles (scheduler runs every 10s)
  // Should be sufficient for most operations
  await new Promise(resolve => setTimeout(resolve, delay));
};
```

### Option 3: Poll for Completion (Fastest)
```javascript
export const waitForV2Sync = async (checkInterval = 1000, maxWait = 30000) => {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    const uncommitted = await StagingV2.count({ where: { committed: false } });
    if (uncommitted === 0) {
      // Wait one more second for main table write
      await new Promise(resolve => setTimeout(resolve, 1000));
      return;
    }
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  throw new Error('Sync timeout: staging not cleaned up');
};
```

## Test Organization Strategy

### Phase 1: Validation Tests (No Staging Pollution)
- All tests that expect 400 errors
- No valid data ever reaches staging
- Run these FIRST

### Phase 2: CRUD Tests (Require Sync)
- Create/Update/Delete operations
- Commit + Wait + Verify main table
- Each test should ideally start with clean staging

## Validation Test Execution Order
Can we make validation tests run first? Yes! Mocha executes `describe` blocks in order of appearance in file. We can either:

1. **Reorder within files**: Move validation `describe` blocks before CRUD blocks
2. **Separate files**: Create `*-validation.spec.js` files that alphabetically come first
3. **Explicit ordering**: Use mocha's `--sort` flag (but harder to control)

**Recommendation**: Reorder within files - simplest and most explicit.

