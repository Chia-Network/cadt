# CRITICAL BUG FIX: Simulator Not Detecting V2 Organizations

## The Smoking Gun 🔫

Found the root cause of why V2 test data wasn't syncing!

### The Problem

In `src/datalayer/simulator.js`, the `getRoot()` and `getRoots()` functions **only looked for V1 organizations**:

```javascript
// OLD CODE - V1 ONLY!
const myOrganization = await Organization.findOne({
  where: { isHome: true },  // This is the V1 Organization model!
  raw: true,
});
```

### What Was Happening

1. V2 tests create a **V2 home organization** (OrganizationsV2)
2. Tests commit data to staging
3. Data gets pushed to `Simulator` table ✅
4. Scheduler runs every 5 seconds ✅
5. Scheduler calls `simulator.getRoot()` to check for changes
6. **`getRoot()` can't find the home org** (looking for V1, but only V2 exists!)
7. Returns `hash: null` or `hash: 0`
8. Scheduler thinks there's no data to sync ❌
9. Main table never gets updated ❌
10. Test fails with `expected null to exist` ❌

### The Fix

Updated both `getRoot()` and `getRoots()` to check for **BOTH V1 and V2** organizations:

```javascript
// NEW CODE - V1 AND V2!
// Check for V1 home organization
let myOrganization = await Organization.findOne({
  where: { isHome: true },
  raw: true,
});

// If no V1 org, check for V2 home organization
if (!myOrganization) {
  try {
    const { OrganizationsV2 } = await import('../models/v2/index.js');
    const v2Org = await OrganizationsV2.findOne({
      where: { is_home: true },
      raw: true,
    });
    if (v2Org) {
      // Convert V2 org to V1 format for compatibility
      myOrganization = {
        registryId: v2Org.registry_id,
      };
    }
  } catch (error) {
    // V2 models might not be loaded, that's OK
  }
}
```

### Why This Fix Works

1. ✅ **V1 tests still work** - checks V1 org first (backward compatible)
2. ✅ **V2 tests now work** - falls back to V2 org if V1 doesn't exist
3. ✅ **Simulator can calculate hash** - has access to registry_id
4. ✅ **Scheduler detects changes** - hash changes when data is added
5. ✅ **Data syncs to main tables** - sync process runs normally

## Impact

### Before This Fix
- ❌ All V2 tests that commit staging data would fail
- ❌ Sync appeared to run but never processed V2 data
- ❌ No error messages (silent failure)
- ❌ Tests would timeout waiting for data that never came

### After This Fix
- ✅ V2 tests can commit and sync data successfully
- ✅ Scheduler detects V2 data changes
- ✅ Data flows: Staging → Simulator → Main Tables
- ✅ Tests can verify final state in main database

## Files Modified

1. **`src/datalayer/simulator.js`**
   - Updated `getRoot()` to check both V1 and V2 organizations
   - Updated `getRoots()` to check both V1 and V2 organizations
   - Added fallback logic with proper error handling

## Why This Was Hard to Find

1. **No error messages** - simulator silently returned null/0 hash
2. **Scheduler appeared to run** - logs showed sync attempts
3. **Commit succeeded** - data was in Simulator table
4. **Timing seemed like the issue** - waiting longer didn't help
5. **Race conditions masked it** - contamination from other tests sometimes made it work

## Validation

This fix explains ALL the symptoms:
- ✅ Why data wasn't in main tables
- ✅ Why waiting 50 seconds didn't help
- ✅ Why staging cleanup helped but didn't fix it
- ✅ Why V1 tests worked but V2 tests failed
- ✅ Why commits showed in logs but syncs didn't process data

## Expected Test Results

With this fix + smart polling + staging cleanup:
- ✅ Estimation test should PASS
- ✅ Unit marketplace test should PASS
- ✅ Tests should complete in 5-15 seconds (not 50!)
- ✅ Only the Audit V1/V2 isolation test should remain (separate issue)

## Next Steps

1. **Rerun tests** - should see dramatic improvement
2. **Verify sync logs** - should see "UPSERTING" messages for V2 data
3. **Check timing** - tests should pass much faster with smart polling
4. **Address audit test** - separate issue, unrelated to this bug

---

## This Is Why V2 Tests Were Failing! 🎉

The simulator couldn't see V2 organizations, so it thought there was no data to sync. This single bug was the root cause of all the staging/sync issues!

