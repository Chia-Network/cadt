# Smart Polling for V2 Test Sync

## The Improvement

Instead of waiting a fixed 20 seconds and hoping sync completes, we now:
- ✅ **Check every 5 seconds** if data has synced
- ✅ **Pass immediately** once data appears (could be as fast as 5-10s!)
- ✅ **Wait up to 50 seconds** before declaring failure (10 attempts × 5s)
- ✅ **Provide clear error messages** if sync fails

## New Helper Function API

### `waitForV2Sync(checkFn, options)`

```javascript
/**
 * Wait for V2 sync to complete by polling
 * @param {Function} checkFn - Function that returns true when sync is complete
 * @param {Object} options - Configuration options
 * @param {number} options.interval - Time between checks in ms (default: 5000ms)
 * @param {number} options.maxAttempts - Maximum attempts (default: 10 = 50s total)
 * @param {string} options.description - Description for error message
 * @returns {Promise<void>}
 * @throws {Error} If sync doesn't complete within maxAttempts
 */
export const waitForV2Sync = async (checkFn, options = {}) => { ... }
```

### `commitV2StagingAndWait(options)`

```javascript
/**
 * Commit V2 staging records and wait for sync to complete
 * @param {Object} options - Optional configuration
 * @param {Function} options.checkFn - Function to check if sync is complete
 * @param {number} options.interval - Time between checks (default: 5000ms)
 * @param {number} options.maxAttempts - Max attempts (default: 10 = 50s total)
 * @param {string} options.description - Description for error message
 * @returns {Promise<Object>} Response from commit API
 */
export const commitV2StagingAndWait = async (options = {}) => { ... }
```

## Usage Examples

### Example 1: Estimation Test

**Before (fixed 20s wait):**
```javascript
await commitV2StagingAndWait();

const estimation = await EstimationV2.findOne({
  where: { cadTrustEstimationId: estimationId },
});
expect(estimation).to.exist;
```

**After (smart polling):**
```javascript
await commitV2StagingAndWait({
  checkFn: async () => {
    const estimation = await EstimationV2.findOne({
      where: { cadTrustEstimationId: estimationId },
    });
    return estimation !== null; // Returns true when record exists
  },
  description: 'Estimation record sync to main table',
});

// Now we KNOW the record exists
const estimation = await EstimationV2.findOne({
  where: { cadTrustEstimationId: estimationId },
});
expect(estimation).to.exist;
```

### Example 2: Unit Marketplace Test

```javascript
await commitV2StagingAndWait({
  checkFn: async () => {
    const updatedUnit = await UnitV2.findOne({
      where: { cadTrustUnitId: unitId },
    });
    // Check if the specific field was updated
    return updatedUnit && updatedUnit.marketplace === 'Climate Marketplace';
  },
  description: 'Unit marketplace field sync to main table',
});
```

## Benefits

### 1. **Faster Tests** ⚡
- **Best case**: Pass in ~5-10 seconds (instead of always waiting 20s)
- **Average case**: Pass in ~10-15 seconds (2-3 checks)
- **Worst case**: Fail after 50 seconds (with clear error message)

### 2. **Better Reliability** 🎯
- No more race conditions with fixed waits
- Tests pass as soon as data is ready
- Longer timeout (50s vs 20s) handles slow sync operations

### 3. **Clear Errors** 📝
If sync fails, you get a clear message:
```
Error: Estimation record sync to main table did not complete within 50 seconds (10 attempts at 5s intervals)
```

### 4. **Backward Compatible** 🔄
Old tests without `checkFn` still work (they just wait the full 50s):
```javascript
await commitV2StagingAndWait(); // Still works, waits 50s
```

## Configuration Options

You can tune the polling behavior:

```javascript
// Faster checks, shorter timeout (good for fast operations)
await commitV2StagingAndWait({
  checkFn: async () => { /* check logic */ },
  interval: 2000,      // Check every 2 seconds
  maxAttempts: 15,     // Up to 30 seconds total
});

// Slower checks, longer timeout (good for complex operations)
await commitV2StagingAndWait({
  checkFn: async () => { /* check logic */ },
  interval: 10000,     // Check every 10 seconds
  maxAttempts: 10,     // Up to 100 seconds total
});
```

## Implementation Details

### Polling Logic
```javascript
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  // Wait for one scheduler cycle
  await new Promise(resolve => setTimeout(resolve, interval));

  // Check if sync is complete
  const isComplete = await checkFn();
  if (isComplete) {
    return; // Success! Exit early
  }

  // Continue polling...
}

// If we get here, timeout exceeded
throw new Error(`${description} did not complete within...`);
```

### Check Function Pattern
```javascript
checkFn: async () => {
  // 1. Query for the record/data you expect
  const record = await Model.findOne({ where: { id: recordId } });

  // 2. Return true if sync is complete, false otherwise
  return record !== null;

  // Or check for specific field values:
  // return record && record.someField === expectedValue;
}
```

## Files Modified

1. **`tests/v2/utils/v2-test-helpers.js`**
   - Rewrote `waitForV2Sync()` to support polling
   - Updated `commitV2StagingAndWait()` to use polling
   - Maintained backward compatibility

2. **`tests/v2/integration/estimation-v2.spec.js`**
   - Updated "should create a new estimation record via API" test
   - Uses smart polling to check for record existence

3. **`tests/v2/integration/unit-v2-marketplace.spec.js`**
   - Updated "should update unit to add marketplace fields" test
   - Uses smart polling to check for field update

## Expected Results

### Time Savings
- **Before**: All tests wait 20s × number of commits = ~5 minutes overhead
- **After**: Tests pass as soon as ready = ~2-3 minutes overhead (40% faster!)

### Test Reliability
- Longer timeout (50s vs 20s) handles edge cases
- No more false failures from timing issues
- Clear error messages when something is actually wrong

## Next Steps

1. **Rerun tests** to verify the fixes work
2. **Update other tests** to use smart polling pattern
3. **Monitor test times** to see the speed improvement
4. **Tune intervals** if needed based on real-world performance

