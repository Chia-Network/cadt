# V2 Test Flakiness Investigation Report

**Date:** December 30, 2025
**Context:** Observed during comprehensive package update testing
**Test Command:** `npm run test:v2`
**Baseline:** 1166 passing tests (0 failures)

## Executive Summary

During systematic package updates with comprehensive testing after each change, V2 tests exhibited significant flakiness with random failures across multiple test files. **Critically, different tests failed on different runs with the same code**, indicating race conditions, timing issues, or improper test isolation rather than actual bugs in the application code.

V1 tests remained completely stable throughout (92 passing consistently), suggesting the flakiness is specific to V2 test implementation patterns.

## Observed Failure Patterns

### Pattern 1: "Expected null to exist" Failures

**Frequency:** Most common failure pattern (observed in ~60% of failed runs)

**Characteristics:**
- Random tests fail with `AssertionError: expected null to exist`
- Same test passes on subsequent runs without code changes
- Suggests database records not being created/found when expected
- Likely indicates race conditions in async operations

**Specific Test Examples:**

1. **V2 Project API - Basic CRUD Tests**
   ```
   PUT /v2/project/:id (Update)
   should stage project update:
   AssertionError: expected null to exist
   at Context.<anonymous> (file:///home/zachary/Chia/Projects/cadt/tests/v2/integration/project-v2.spec.js:591:31)
   ```
   - Location: Line 591 in `project-v2.spec.js`
   - Context: Looking for staging record after update
   - Code context: `expect(stagingRecord).to.exist;`

2. **Rating V2 Endpoint Integration Tests**
   ```
   PUT /v2/rating/:id (Update)
   should update a rating via API:
   AssertionError: expected null to exist
   at Context.<anonymous> (file:///home/zachary/Chia/Projects/cadt/tests/v2/integration/rating-v2.spec.js:564:31)
   ```
   - Location: Line 564 in `rating-v2.spec.js`
   - Similar pattern to project update test

3. **V2 Unit API - Basic CRUD Tests**
   ```
   POST /v2/unit (Create)
   should automatically set orgUid from home organization when creating unit:
   AssertionError: expected null to exist
   at Context.<anonymous> (file:///home/zachary/Chia/Projects/cadt/tests/v2/integration/unit-v2.spec.js:522:31)
   ```
   - Location: Line 522 in `unit-v2.spec.js`

4. **V2 Verification API - Basic CRUD Tests**
   ```
   DELETE /v2/verification/:id (Delete)
   should stage verification deletion:
   AssertionError: expected null to exist
   at Context.<anonymous> (file:///home/zachary/Chia/Projects/cadt/tests/v2/integration/verification-v2.spec.js:504:31)
   ```
   - Location: Line 504 in `verification-v2.spec.js`

5. **Unit-Label V2 Join Table Integration Tests**
   ```
   POST /v2/unit-label (Create)
   should create a new unit-label relationship via API:
   AssertionError: expected null to exist
   at Context.<anonymous> (file:///home/zachary/Chia/Projects/cadt/tests/v2/integration/unit-label-v2.spec.js:671:31)
   ```
   - Location: Line 671 in `unit-label-v2.spec.js`

6. **V2 Validation API - Basic CRUD Tests**
   ```
   POST /v2/validation (Create)
   should create a new validation record:
   AssertionError: expected null to exist
   at Context.<anonymous> (file:///home/zachary/Chia/Projects/cadt/tests/v2/integration/validation-v2.spec.js:108:31)
   ```
   - Location: Line 108 in `validation-v2.spec.js`

7. **V2 Staging Integration Tests**
   ```
   Staging Controller: Additional Endpoints
   should retry failed commit record:
   AssertionError: expected null to exist
   at Context.<anonymous> (file:///home/zachary/Chia/Projects/cadt/tests/v2/integration/staging-v2.spec.js:1116:31)
   ```
   - Location: Line 1116 in `staging-v2.spec.js`

8. **V2 Staging Integration Tests**
   ```
   Staging Controller: Additional Endpoints
   should reset committed records that are blocking new commits:
   TypeError: Cannot read properties of null (reading 'committed')
   at Context.<anonymous> (file:///home/zachary/Chia/Projects/cadt/tests/v2/integration/staging-v2.spec.js:1185:27)
   ```
   - Location: Line 1185 in `staging-v2.spec.js`
   - Similar issue but throws TypeError when trying to access property

### Pattern 2: Expectation Mismatch Failures

**Characteristics:**
- Expected values don't match actual values
- Suggests records not being created/counted correctly
- May indicate database state leaking between tests

**Specific Examples:**

1. **V2 Unit API**
   ```
   should return exactly 2 units:
   AssertionError: expected +0 to be at least 2
   + expected - actual
   -0
   +2
   at Context.<anonymous> (file:///home/zachary/Chia/Projects/cadt/tests/v2/integration/unit-v2.spec.js:1138:48)
   ```
   - Expected 2 units, found 0
   - Suggests database not populated as expected

2. **V2 Staging Integration Tests**
   ```
   should reset committed records that are blocking new commits:
   AssertionError: expected +0 to equal 2
   + expected - actual
   -0
   +2
   at Context.<anonymous> (file:///home/zachary/Chia/Projects/cadt/tests/v2/integration/staging-v2.spec.js:1179:45)
   ```

3. **V2 Staging Integration Tests**
   ```
   should reset committed records that are blocking new commits:
   AssertionError: expected +0 to equal 1
   + expected - actual
   -0
   +1
   at Context.<anonymous> (file:///home/zachary/Chia/Projects/cadt/tests/v2/integration/staging-v2.spec.js:1250:40)
   ```

### Pattern 3: HTTP Status Code Mismatches

**Characteristics:**
- Expected status code doesn't match actual
- Suggests request succeeded/failed unexpectedly
- May indicate timing issues with async operations

**Specific Examples:**

1. **Unit-Label V2**
   ```
   AssertionError: expected 404 to equal 200
   + expected - actual
   -404
   +200
   at Context.<anonymous> (file:///home/zachary/Chia/Projects/cadt/tests/v2/integration/unit-label-v2.spec.js:775:34)
   ```
   - Expected 200 OK, got 404 Not Found
   - Resource lookup failed when it should have succeeded

2. **V2 Staging Integration Tests**
   ```
   AssertionError: expected 400 to equal 200
   + expected - actual
   -400
   +200
   at Context.<anonymous> (file:///home/zachary/Chia/Projects/cadt/tests/v2/integration/staging-v2.spec.js:1089:34)
   ```
   - Expected success, got validation error
   - May indicate request not properly formed or timing issue

### Pattern 4: Timeout Failures

**Frequency:** Less common but more severe (~10% of failed runs)

**Characteristics:**
- Test waits for condition that never completes
- 50-second timeout suggests helper function waiting pattern
- Most consistently reproducible failure

**Specific Example:**

```
Estimation V2 Endpoint Integration Tests
POST /v2/estimation (Create)
should create a new estimation record via API:
Error: Estimation record creation sync to main table did not complete within 50 seconds
(10 attempts at 5s intervals). Total elapsed: 50053ms
at commitV2StagingAndWaitForCondition (file:///home/zachary/Chia/Projects/cadt/tests/v2/utils/v2-test-helpers.js:145:9)
at async Context.<anonymous> (file:///home/zachary/Chia/Projects/cadt/tests/v2/integration/estimation-v2.spec.js:458:7)
```

**Analysis:**
- Helper function: `commitV2StagingAndWaitForCondition` in `v2-test-helpers.js:145`
- Polls 10 times at 5-second intervals
- Waiting for staging record to sync to main table
- This failure was **more consistent** (failed multiple consecutive runs)
- Suggests genuine issue with the estimation endpoint or test helper logic

## Root Cause Analysis

### Likely Issues

#### 1. **Insufficient Wait/Polling After Async Operations**

**Evidence:**
- "Expected null to exist" failures suggest queries happening before DB writes complete
- V2 uses staging tables that commit asynchronously
- Helper function `commitV2StagingAndWaitForCondition` exists but may not be used consistently

**Code Location to Investigate:**
```javascript
// From error trace:
tests/v2/utils/v2-test-helpers.js:145
// Function: commitV2StagingAndWaitForCondition
```

**Hypothesis:**
- Some tests don't use proper wait helpers
- Some tests poll too few times or with insufficient intervals
- Race condition between staging commit and assertion

#### 2. **Test Isolation Problems**

**Evidence:**
- Different tests fail on different runs
- Count mismatches (expected 2, got 0) suggest database state issues
- Pattern suggests previous test cleanup may not complete before next test starts

**Areas to Investigate:**
- `beforeEach`/`afterEach` hooks in test files
- Database reset/cleanup procedures
- Staging table cleanup between tests
- Transaction rollback logic

#### 3. **Async/Await Issues**

**Evidence:**
- Multiple failures occur in async test contexts
- `Cannot read properties of null` suggests promise resolved but data not ready

**Common Patterns to Check:**
```javascript
// Missing await?
const result = someAsyncFunction();
expect(result).to.exist; // ❌ Wrong - result is a Promise

// Should be:
const result = await someAsyncFunction();
expect(result).to.exist; // ✅ Correct
```

#### 4. **Database Transaction Timing**

**Evidence:**
- V2 uses transaction mutex (mentioned in logs)
- Some operations may not commit before test assertions
- Staging table → main table sync timing

**From Logs:**
```
info: Starting sequelize V2 transaction and acquiring transaction mutex
info: Committed sequelize V2 transaction
```

**Issue:** Tests may assert before transaction fully commits to disk

#### 5. **Mutex/Lock Contention**

**Evidence:**
- Tests mention "transaction mutex"
- May have timing issues if multiple tests run concurrently
- Lock acquisition delays could cause timing problems

## Test Files with Known Flakiness

Ranked by frequency of observed failures:

### High Frequency (Multiple failures observed)
1. **`tests/v2/integration/staging-v2.spec.js`**
   - Multiple failure points (lines 1089, 1116, 1179, 1185, 1250)
   - Most flaky test file
   - Focus investigation here

2. **`tests/v2/integration/unit-label-v2.spec.js`**
   - Lines 671, 775
   - Join table operations appear problematic

### Medium Frequency
3. **`tests/v2/integration/project-v2.spec.js`** (line 591)
4. **`tests/v2/integration/rating-v2.spec.js`** (line 564)
5. **`tests/v2/integration/unit-v2.spec.js`** (lines 522, 1138)
6. **`tests/v2/integration/verification-v2.spec.js`** (line 504)
7. **`tests/v2/integration/validation-v2.spec.js`** (line 108)

### Low Frequency but Severe
8. **`tests/v2/integration/estimation-v2.spec.js`** (line 458)
   - Timeout failure more consistent
   - May indicate actual functional issue vs just timing

## Comparison with V1 Tests

**V1 Test Stability:** ✅ **100% Consistent** (92 passing, 5 pending - same every run)

**Key Differences to Investigate:**

1. **Test Helper Functions:**
   - V1 likely has more robust wait/poll mechanisms
   - V1 may have better test isolation

2. **Database Architecture:**
   - V2 uses staging tables + commits
   - V1 may have simpler direct write pattern
   - V2 async complexity introduces timing issues

3. **Test Patterns:**
   - Compare V1 test structure to V2
   - V1 may use different assertion timing
   - V1 cleanup procedures may be more reliable

## Detailed Test Execution Data

### Successful Run Example
```
1166 passing (2m)
```

### Failed Run Examples

**Run 1** (After Batch 4 updates):
```
1165 passing (2m)
1 failing
- V2 Staging Integration Tests: should reject commit when ids is not an array
```

**Run 2** (Same code, different tests fail):
```
1164 passing (2m)
2 failing
- V2 Project API: should stage project update
- Rating V2 Endpoint: should update a rating via API
```

**Run 3** (Same code, different tests fail):
```
1164 passing (2m)
2 failing
- V2 Unit API: should automatically set orgUid
- V2 Verification API: should stage verification deletion
```

**Run 4** (Different test fails):
```
1165 passing (2m)
1 failing
- V2 Unit API: should return exactly 2 units (expected 2, got 0)
```

**Pattern:** Never saw the same exact set of tests fail twice in a row.

## Recommendations

### Immediate Actions (High Priority)

1. **Audit Test Helper Functions**
   - Review `tests/v2/utils/v2-test-helpers.js` line 145
   - Ensure `commitV2StagingAndWaitForCondition` is used consistently
   - Increase polling attempts or intervals if needed
   - Add logging to track timing issues

2. **Focus on `staging-v2.spec.js`**
   - Most flaky file with 5+ failure points
   - Likely contains patterns that other tests copy
   - Fix here will likely improve other tests

3. **Add Explicit Waits After DB Operations**
   ```javascript
   // Example pattern to add:
   await createRecord();
   await waitForStagingCommit(); // Add this
   const record = await fetchRecord();
   expect(record).to.exist;
   ```

4. **Review Test Isolation**
   - Check all `beforeEach`/`afterEach` hooks
   - Ensure staging tables fully clear between tests
   - Verify transaction cleanup

### Medium Priority

5. **Add Timing Logs**
   ```javascript
   console.time('operation');
   await someAsyncOp();
   console.timeEnd('operation');
   ```
   - Help identify slow operations
   - Reveal timing patterns

6. **Increase Timeouts Selectively**
   - Not a fix, but helps identify if timing is the issue
   - If tests pass with 2x timeout, confirms race condition

7. **Add Retry Logic for Flaky Tests**
   ```javascript
   // Mocha retry option
   it('test', function() {
     this.retries(2); // Temporary mitigation
   });
   ```

8. **Investigate Estimation Test Timeout**
   - Line 458 in `estimation-v2.spec.js`
   - More consistently fails
   - May indicate actual bug vs timing issue

### Long-term Improvements

9. **Standardize Test Patterns**
   - Create consistent helper usage guide
   - Document proper async/await patterns
   - Code review checklist for new tests

10. **Add Test Infrastructure**
    - Database state snapshots between tests
    - Better transaction isolation
    - Explicit test ordering if needed

11. **Consider Test Parallelization Issues**
    - If tests run in parallel, may need serial execution
    - Or better isolation between parallel tests

12. **Monitor in CI/CD**
    - Track failure rates over time
    - Identify if certain environments more prone to flakiness
    - May be system load related

## Tools and Commands for Investigation

### Run Tests Multiple Times
```bash
# Run 10 times to see failure rate
for i in {1..10}; do
  echo "Run $i";
  npm run test:v2 2>&1 | tail -20;
done
```

### Run Specific Flaky Test
```bash
# Focus on most problematic file
npm run test:v2 -- --grep "staging-v2"
```

### Add Verbose Logging
```bash
# In test file, add:
process.env.LOG_LEVEL = 'debug';
```

### Check for Timing Issues
```bash
# Run with increased timeout
npm run test:v2 -- --timeout 600000  # 10 minutes
```

## Test Files Summary

| File | Failures Observed | Lines | Priority |
|------|------------------|-------|----------|
| `staging-v2.spec.js` | 5+ | 1089, 1116, 1179, 1185, 1250 | **CRITICAL** |
| `unit-label-v2.spec.js` | 2 | 671, 775 | High |
| `project-v2.spec.js` | 1 | 591 | Medium |
| `rating-v2.spec.js` | 1 | 564 | Medium |
| `unit-v2.spec.js` | 2 | 522, 1138 | Medium |
| `verification-v2.spec.js` | 1 | 504 | Medium |
| `validation-v2.spec.js` | 1 | 108 | Medium |
| `estimation-v2.spec.js` | 1 (timeout) | 458 | High |

## Success Criteria for Fix

✅ **Definition of Success:**
- 10 consecutive successful runs with 1166 passing tests
- No random failures across multiple runs
- V2 tests as stable as V1 tests
- All tests complete in reasonable time (<5 minutes)

## Additional Context

- **Testing Environment:** Local development machine
- **Test Runner:** Mocha 11.7.5
- **Database:** SQLite (test databases reset before each test suite)
- **Execution Time:** ~2 minutes for full V2 suite
- **Code State:** Package updates only - no application code changes
- **V1 Stability:** Perfect (92/92 passing all runs)

## Conclusion

The V2 test suite has significant flakiness issues related to async timing, test isolation, and database staging operations. The inconsistency of failures (different tests each run) strongly indicates race conditions rather than actual application bugs. Focusing on the `staging-v2.spec.js` file and the `commitV2StagingAndWaitForCondition` helper function should provide the highest ROI for stabilization efforts.

The fact that V1 tests are perfectly stable suggests this is specific to V2's staging table architecture and test implementation patterns, not a fundamental testing infrastructure problem.
