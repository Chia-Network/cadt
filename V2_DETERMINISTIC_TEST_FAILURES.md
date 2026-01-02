# V2 Deterministic Test Failures

**Date:** December 30, 2025
**Test Suite:** V2 Integration Tests (`npm run test:v2`)
**Status:** 1164 passing, 1 failing (99.9% pass rate)
**Nature:** Deterministic (consistent, repeatable failure - NOT flaky)

---

## Executive Summary

After successfully eliminating all flakiness from the V2 test suite, **1 deterministic test failure** remains. This is NOT a flakiness issue - the test fails consistently on every run with the same error.

**Key Context:**
- Baseline: 1166 tests total
- Current: 1164 passing (99.9%)
- Failing: 1 test (deterministic)
- Skipped: 1 test (`force-recreate-tables.spec.js.SKIP` - intentionally disabled debugging tool)

The remaining failure is a **test contamination issue** where invalid JSON data created by a previous test remains in the staging table and causes a subsequent test to fail.

---

## The Single Failing Test

### Test Details

**File:** `tests/v2/integration/staging-v2.spec.js`
**Test Name:** `V2 Staging Integration Tests > Staging Controller: Additional Endpoints > should accept commit with ids array at maximum allowed length`
**Line:** 1060-1091

**Error:**
```
AssertionError: expected 400 to equal 200
```

**Expected Behavior:** HTTP 200 (success)
**Actual Behavior:** HTTP 400 (validation error)

---

## Root Cause Analysis

### The Problem

The test creates a staging record and attempts to commit it with an array of 10,000 IDs (testing the maximum allowed length). However, the commit fails with a 400 error instead of succeeding.

Looking at the error logs immediately before this test:
```
[v2]: Failed to parse staging record data
{"table":"program","uuid":"654f9d77-5902-4d3c-8e19-88aab6446f14",
"error":"Unexpected token 'i', \"invalid json{\" is not valid JSON",
"data":"invalid json{"}
```

### The Contamination

A **previous test** (`should handle staging records with invalid JSON data` - line ~1040) intentionally creates staging records with **invalid JSON** (`"invalid json{"`) to test error handling:

```javascript
// From an earlier test in the same file
await StagingV2.create({
  uuid: testUuid,
  table: 'program',
  action: 'INSERT',
  data: 'invalid json{',  // ← Intentionally invalid!
  committed: false,
});
```

This invalid record remains in the staging table after the test completes because:
1. The test verifies the error is handled correctly
2. The invalid record is marked with `committed: false`
3. The test doesn't clean up invalid records

### Why the Subsequent Test Fails

The "ids array at maximum length" test does this:
```javascript
// Delete any existing committed records
await StagingV2.destroy({
  where: { committed: true }  // ← Only deletes COMMITTED records!
});

// Then tries to commit with ids array
const response = await supertest(app)
  .post('/v2/staging/commit')
  .send({
    ids: maxIdsArray,  // 10,000 UUIDs
    // ...
  });
```

When the commit API processes the `ids` array, it attempts to commit ALL records matching those IDs. However, the staging table ALSO contains the invalid JSON record from the previous test (which has `committed: false`). The commit process:

1. Reads all uncommitted staging records
2. Encounters the invalid JSON record
3. Fails to parse it: `Unexpected token 'i', "invalid json{" is not valid JSON`
4. Returns HTTP 400 error
5. Test fails because it expected HTTP 200

---

## Why This Wasn't Caught Before

**Test Isolation Issue:**

The V2 tests have a `beforeEach` hook in staging-v2.spec.js (line 54):
```javascript
beforeEach(async function () {
  // Clean up staging and data tables before each test
  await resetV2StagingTable();
  await resetV2DataTables();
});
```

However, this `beforeEach` hook is **scoped to the parent describe block**, not the nested `describe('Staging Controller: Additional Endpoints')` block where these tests live.

The invalid JSON test and the ids array test are in the **same test group** with **no cleanup between them**, causing contamination.

---

## Proposed Solutions

### Option 1: Add Cleanup to Invalid JSON Test (Recommended)

Add an `after` hook to clean up invalid records after the test:

```javascript
describe('Edge Cases', function () {
  it('should handle staging records with invalid JSON data', async function () {
    // ... test code ...
  });

  after(async function () {
    // Clean up any invalid staging records created during edge case testing
    await StagingV2.destroy({
      where: {},
      truncate: true
    });
  });
});
```

**Pros:**
- Minimal change
- Ensures edge case tests don't contaminate subsequent tests
- Tests remain independent

**Cons:**
- Requires adding cleanup hooks to multiple edge case tests

---

### Option 2: Improve Test Isolation with Nested beforeEach

Move the problematic tests into their own describe block with proper cleanup:

```javascript
describe('Staging Controller: Additional Endpoints', function () {
  beforeEach(async function () {
    // Ensure clean state before each test in this group
    await StagingV2.destroy({ where: {} });
  });

  it('should accept commit with ids array at maximum allowed length', async function () {
    // ... test code ...
  });

  // ... other tests ...
});
```

**Pros:**
- Better test isolation
- Prevents all future contamination issues
- More maintainable

**Cons:**
- Slightly slower (more cleanup operations)

---

### Option 3: Fix the Test to Handle Contamination

Modify the failing test to explicitly clean up ALL staging records:

```javascript
it('should accept commit with ids array at maximum allowed length', async function () {
  // Clean up ALL existing staging records (not just committed ones)
  await StagingV2.destroy({ where: {} });  // ← Changed from { committed: true }

  const programData = await generateV2ProgramData();
  const stagingUuid = uuidv4();
  await StagingV2.create({
    uuid: stagingUuid,
    table: 'program',
    action: 'INSERT',
    data: JSON.stringify([programData]),
    committed: false,
  });

  const maxIdsArray = Array(10000).fill(stagingUuid);

  const response = await supertest(app)
    .post('/v2/staging/commit')
    .send({
      comment: 'Test commit',
      author: 'Test User',
      ids: maxIdsArray,
    });

  expect(response.status).to.equal(200);
  expect(response.body.success).to.be.true;
});
```

**Pros:**
- Quick fix
- Test becomes more robust
- No structural changes needed

**Cons:**
- Doesn't prevent future contamination
- Each test needs individual attention

---

## Recommended Fix

**Use Option 1 + Option 3 combined:**

1. **Short term:** Fix the failing test to clean up all staging records (Option 3)
2. **Long term:** Add proper cleanup to edge case tests (Option 1) or improve test isolation (Option 2)

This provides immediate resolution while preventing future issues.

---

## Additional Notes

### Warnings in Test Output

The test output includes numerous warnings:

1. **Moment.js Date Deprecation Warning:**
   ```
   Deprecation warning: value provided is not in a recognized RFC2822 or ISO format
   Arguments: [0] _isAMomentObject: true, ... _i: invalid-date
   ```
   - **Source:** `aef-t1-submission-v2.spec.js:174`
   - **Impact:** Warning only, doesn't affect tests
   - **Cause:** Test is passing an invalid date format (`"invalid-date"`)
   - **Action:** Not critical, but should be fixed for cleaner logs

2. **Governance Data Sync Errors:**
   ```
   [v2]: Error Syncing V2 Governance Data. Retry attempt #16.
   Error: Missing information in env to sync Governance data
   ```
   - **Impact:** Expected behavior in simulator mode (no governance env vars configured)
   - **Action:** None needed - this is normal for test environment

### Test Performance

- **Total Duration:** ~2 minutes
- **Passing Tests:** 1164/1165 (99.9%)
- **Performance:** Excellent (no slowdown from flakiness fixes)

---

## Context: Recent Flakiness Fixes

This remaining failure is **NOT related to the flakiness that was fixed**. The following issues were successfully resolved:

1. ✅ Concurrent `prepareV2Db()` calls causing database locks
2. ✅ SQLite WAL visibility race conditions ("expected null to exist" errors)
3. ✅ Interfering `force-recreate-tables.spec.js` test
4. ✅ Governance table migration issues

The current failure is a **simple test contamination issue** that is straightforward to fix.

---

## Files Referenced

- `tests/v2/integration/staging-v2.spec.js` (lines 1040-1091)
- `src/models/v2/staging-v2.model.js` (line 120 - JSON parsing)
- `src/controllers/v2/staging-v2.controller.js` (line 160 - commit handler)

---

## Next Steps

1. Choose a solution approach (recommend Option 1 + Option 3)
2. Implement the fix
3. Run tests to verify: `npm run test:v2`
4. Expected result: 1165 passing tests (99.9%+ pass rate)

---

**Status:** Ready for implementation
**Priority:** Low (test works, just needs isolation fix)
**Effort:** <30 minutes
