# Test Fix: Staging Contamination Issue

## Problem Identified

Tests were failing with `expected null to exist` even though:
- ✅ Commits were happening successfully
- ✅ Staging table was being truncated
- ✅ Scheduler was running every 5 seconds
- ✅ Tests were waiting 20 seconds

### Root Cause: Cross-Test Contamination

Looking at the commit logs:
```
"models":{"CoBenefitV2":19,"EstimationV2":20}
```

This shows **2 different models** being committed together!

**What happened:**
1. CoBenefit test runs, creates staging record
2. CoBenefit test doesn't commit (or commits but data hasn't synced yet)
3. Estimation test runs, creates its staging record
4. Estimation test calls `commitV2StagingAndWait()`
5. **BOTH CoBenefit AND Estimation records get committed together!**
6. Sync processes both records
7. Test only looks for Estimation, but the sync might prioritize CoBenefit first
8. **Race condition**: Sometimes Estimation syncs, sometimes it doesn't (within 20s)

### The Fix: Clean Staging Before Each Test

Added `beforeEach` hooks to clean staging in test suites that commit data:

**File 1: `tests/v2/integration/estimation-v2.spec.js`**
```javascript
describe('POST /v2/estimation (Create)', function () {
  // Clean staging before each test to prevent contamination
  beforeEach(async function () {
    await StagingV2.destroy({ where: {}, truncate: true });
  });

  // ... tests ...
});
```

**File 2: `tests/v2/integration/unit-v2-marketplace.spec.js`**
```javascript
describe('Basic Marketplace Fields', function () {
  // Clean staging before each test to prevent contamination
  beforeEach(async function () {
    await StagingV2.destroy({ where: {}, truncate: true });
  });

  // ... tests ...
});
```

## Why This Works

1. **Isolated Commits**: Each test commits only ITS OWN data
2. **No Race Conditions**: No competing records in the sync queue
3. **Predictable Timing**: 20 seconds is enough for a single model to sync
4. **Clean State**: Every test starts with empty staging

## Expected Results

With these changes, the 2 remaining failures should be fixed:
- ✅ Estimation: `should create a new estimation record via API`
- ✅ Unit Marketplace: `should update unit to add marketplace fields`

The Audit test (Issue #1) is a separate issue that needs investigation.

## Summary of All Changes Made Today

### 1. **Scheduler Speed** (DONE ✅)
- V1 & V2: 10s → 5s

### 2. **Test Wait Times** (DONE ✅)
- `commitV2StagingAndWait()`: 1.5s → 20s
- `waitForV2Sync()`: 1.5s → 20s

### 3. **Test Reordering** (DONE ✅)
- Validation tests run BEFORE success tests in Estimation POST block

### 4. **Staging Cleanup** (NEW ✅)
- Added `beforeEach` hooks to clean staging in:
  - Estimation POST tests
  - Unit Marketplace tests

## Files Modified Today

1. `src/tasks/sync-registries.js` - Scheduler interval
2. `src/tasks/sync-registries-v2.js` - Scheduler interval
3. `tests/v2/utils/v2-test-helpers.js` - Wait times & helpers
4. `tests/v2/integration/estimation-v2.spec.js` - Test order & staging cleanup
5. `tests/v2/integration/unit-v2-marketplace.spec.js` - Staging cleanup

## Test Results Progression

- **Start**: 9 failing tests
- **After scheduler + wait increase**: 4 failing tests
- **After test reordering**: 3 failing tests (validation contamination fixed!)
- **Expected after staging cleanup**: 1 failing test (just the Audit issue)

## Next Steps

Rerun tests:
```bash
npm run test:v2 > ~/tmp/v2test.log 2>&1
```

Expected: Only 1 failure remaining (the Audit V1/V2 isolation test)

