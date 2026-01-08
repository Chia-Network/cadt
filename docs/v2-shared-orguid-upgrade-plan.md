# V2 Shared org_uid Upgrade Architecture Plan

This document outlines the proposed changes to make v1 and v2 organizations share the same `org_uid` during the upgrade process.

## Problem Statement

Currently, when upgrading from v1 to v2 using `POST /v2/organizations/upgrade`, the system creates a **new** `org_uid` store for v2. This results in:
- v1 and v2 having different `org_uid` values
- Two separate datalayer stores for organization identity
- Potential confusion for subscribers tracking organizations

## Proposed Solution

The v1 and v2 organizations should share the **same** `org_uid`. The `org_uid` store should point to a shared `registryId` (the singleton/dataModelVersionStoreId), which has keys `v1` and `v2` pointing to the respective data store IDs.

---

## Current Architecture (Upgrade Flow)

### V1 Organization Structure

```
orgUid store
├── name: "Organization Name"
├── icon: "<icon data>"
├── registryId: <dataModelVersionStoreId>  (points to singleton)
└── fileStoreId: <v1FileStoreId>

dataModelVersionStoreId (singleton)
└── v1: <v1RegistryStoreId>

v1RegistryStoreId
└── (actual v1 climate data)

v1FileStoreId
└── (v1 files)
```

### Current V2 Upgrade Creates

```
NEW v2OrgUid store  <-- PROBLEM: Creates new store
├── name: "Organization Name"
├── icon: "<icon data>"
├── registryId: <dataModelVersionStoreId>  (points to SAME singleton)
└── fileStoreId: <v2FileStoreId>

dataModelVersionStoreId (singleton - SHARED)
├── v1: <v1RegistryStoreId>
└── v2: <v2RegistryStoreId>  <-- Added during upgrade

v2RegistryStoreId
└── (actual v2 climate data)

v2FileStoreId
└── (v2 files)
```

---

## Proposed Architecture (Shared org_uid)

### After Upgrade

```
SHARED orgUid store  <-- REUSE v1 orgUid
├── name: "Organization Name"
├── icon: "<icon data>"
├── registryId: <dataModelVersionStoreId>  (points to singleton)
└── fileStoreId: <v1FileStoreId>

dataModelVersionStoreId (singleton - SHARED)
├── v1: <v1RegistryStoreId>
└── v2: <v2RegistryStoreId>  <-- Added during upgrade

v1RegistryStoreId
└── (actual v1 climate data)

v2RegistryStoreId
└── (actual v2 climate data)

v1FileStoreId (v1 files)
v2FileStoreId (v2 files - stored in OrganizationsV2.file_store_subscribed)
```

Key differences:
1. **No new orgUid store created** - reuse v1's
2. **Same org_uid value** in both Organization (v1) and OrganizationsV2 tables
3. **v2 file store ID stored only in database**, not in orgUid store

---

## Code Changes Required

### 1. `src/models/v2/organizations-v2.model.js` - `upgradeFromV1()`

**Current behavior (lines 448-509):**
- Creates `newV2OrgUid` datalayer store
- Syncs name, icon, registryId, fileStoreId to new store
- Waits for blockchain confirmation

**Proposed changes:**
- **Remove** creation of `newV2OrgUid` store
- **Remove** syncing data to new orgUid store
- **Remove** waiting for new orgUid store confirmation
- **Use** `v1OrgUid` as the org_uid in OrganizationsV2 table
- **Keep** creation of new v2 registry store
- **Keep** adding `v2` key to singleton

**Simplified upgrade flow:**
```javascript
// 1. Get v1 org data
const v1OrgUid = v1Org.orgUid;
const v1DataModelVersionStoreId = v1Org.dataModelVersionStoreId;

// 2. Create new v2 registry store (still needed)
const newV2RegistryStoreId = await datalayer.createDataLayerStore();

// 3. Create new v2 file store (still needed)
const newV2FileStoreId = await datalayer.createDataLayerStore();

// 4. Add v2 key to shared singleton (already doing this)
await datalayer.syncDataLayer(
  v1DataModelVersionStoreId,
  { v2: newV2RegistryStoreId },
  revertUpgradeIfFailed,
);

// 5. Store in OrganizationsV2 table with SAME org_uid
await OrganizationsV2.create({
  org_uid: v1OrgUid,  // <-- SAME as v1, not new
  data_model_version_store_id: v1DataModelVersionStoreId,
  registry_id: newV2RegistryStoreId,
  is_home: true,
  subscribed: USE_SIMULATOR,
  file_store_subscribed: newV2FileStoreId,
  name,
  icon,
});
```

### 2. `src/models/v2/organizations-v2.model.js` - `subscribeToOrganization()`

**No changes needed.** This method already:
1. Reads orgUid store to get `registryId` (the singleton)
2. Reads singleton to get the `v2` key
3. Subscribes to v2 registry store

The flow works regardless of whether the orgUid is shared or separate.

### 3. Edit Organization (`PUT /v2/organizations/edit`)

**Behavior change (implicit):**
- When editing v2 organization name/icon, it updates the shared orgUid store
- v1 will also see the updated name/icon (reads from same orgUid store)
- This is **desired behavior** - same organization, same identity

**Code location:** `src/controllers/v2/organizations-v2.controller.js` - `edit()` method

---

## Governance Mode Considerations

### Current Implementation

From `src/tasks/sync-governance-body-v2.js` (lines 31-43):
```javascript
const v2HomeOrg = await OrganizationsV2.findOne({
  where: { is_home: true },
  raw: true,
});

// Only sync if we're not the governance body ourselves
if (!v2HomeOrg || v2HomeOrg.org_uid !== GOVERNANCE_BODY_ID) {
  await GovernanceV2.sync();
}
```

### Impact of Shared org_uid

- Governance body is identified by `GOVERNANCE_BODY_ID` config (a store ID)
- The check compares `v2HomeOrg.org_uid !== GOVERNANCE_BODY_ID`
- **This still works** - if governance body shares orgUid between v1/v2, comparison correctly identifies it

**Benefit:** If governance body upgrades from v1 to v2, subscribers don't need to re-subscribe to a different orgUid.

---

## Sync Task Considerations

### `syncOrganizationMeta` (v1 and v2)

- Reads `name`, `icon`, metadata from orgUid store
- Since orgUid store is shared, both v1 and v2 read same values
- **No changes needed** - actually improves consistency

### `sync-registries-v2.js`

- Uses `registry_id` from OrganizationsV2 table (the v2 registry store, not singleton)
- **No changes needed**

---

## Database Considerations

### OrganizationsV2 Table

The `org_uid` field will store the **same value** as v1's `Organization.orgUid`:
- This is fine - they're separate tables
- Queries work correctly
- No unique constraint conflicts

### Example After Upgrade

**Organization (v1) table:**
| orgUid | name | registryId | dataModelVersionStoreId |
|--------|------|------------|------------------------|
| abc123 | Org1 | def456     | ghi789                 |

**OrganizationsV2 table:**
| org_uid | name | registry_id | data_model_version_store_id |
|---------|------|-------------|---------------------------|
| abc123  | Org1 | xyz999      | ghi789                    |

Note: `org_uid` is same, but `registry_id` is different (v2 data store).

---

## File Store Decision

### Option A: Separate File Stores (Recommended)

- v2 creates new file store during upgrade
- v2 file store ID stored in `OrganizationsV2.file_store_subscribed` field
- No changes to orgUid store needed

**Pros:**
- Clean separation between v1 and v2 files
- No risk of format conflicts
- Already implemented this way

**Cons:**
- Files not shared (users must re-upload for v2)

### Option B: Share File Store

- Reuse v1 file store for v2
- Both versions read/write to same store

**Pros:**
- Simpler, existing files accessible

**Cons:**
- Could have v1/v2 file format differences
- Potential conflicts

**Recommendation:** Keep separate file stores. The architecture already supports storing v2 file store ID in the database without modifying the shared orgUid store.

---

## Documentation Changes

### `docs/cadt_rpc_api_v2.md`

Update the V2 Features section (around line 25):

**Current:**
> V2 supports upgrading existing V1 organizations to V2. This will not migrate the data, but simply create a new store for V2 alongside the existing V1 store.

**Proposed:**
> V2 supports upgrading existing V1 organizations to V2. The upgrade preserves the same organization identity (org_uid) while creating a new V2 data store. V1 and V2 share the same org_uid, meaning organization metadata (name, icon) is shared. Data stores remain separate - V1 data is not migrated to V2.

### Additional Documentation Notes

- Clarify that upgrading adds v2 capability to existing organization identity
- Note that name/icon changes in v2 are reflected in v1 (and vice versa)
- Explain that subscribers identify organizations by the same org_uid regardless of v1/v2

---

## Test Changes Required

### `tests/v2/integration/organizations-v2.spec.js`

Update upgrade tests to verify:
1. v2 org_uid matches v1 orgUid
2. No new orgUid store created on datalayer
3. Singleton correctly has v2 key added
4. v2 registry store is created
5. OrganizationsV2 table has correct values

### New Test Cases

```javascript
describe('POST /v2/organizations/upgrade - Shared org_uid', () => {
  it('should use same org_uid as v1 organization', async () => {
    // Create v1 org
    const v1Org = await createV1Organization();

    // Upgrade to v2
    await request(app).post('/v2/organizations/upgrade').expect(200);

    // Verify v2 org has same org_uid
    const v2Org = await OrganizationsV2.findOne({ where: { is_home: true } });
    expect(v2Org.org_uid).to.equal(v1Org.orgUid);
  });

  it('should share name/icon updates between v1 and v2', async () => {
    // After upgrade, update v2 name
    await request(app)
      .put('/v2/organizations/edit')
      .send({ name: 'New Name' })
      .expect(200);

    // v1 should see the updated name (from orgUid store)
    // This would be verified via sync or direct datalayer read
  });
});
```

---

## Summary of Changes

| Component | Current | Proposed | Impact |
|-----------|---------|----------|--------|
| `upgradeFromV1()` | Creates new v2 orgUid store | Reuses v1 orgUid | Simplifies architecture |
| `subscribeToOrganization()` | No change | No change | Works as-is |
| Edit name/icon | Updates separate stores | Updates shared store | v1 sees v2 changes |
| File store | Creates new v2 file store | Keep separate (stored in DB) | No conflict |
| Governance | Uses orgUid for identity | Same orgUid | Better continuity |
| Sync tasks | Separate orgUid stores | Shared store | Consistent data |
| Tests | Expect different org_uids | Expect same org_uid | Update assertions |
| Documentation | Implies separate stores | Clarify shared identity | User understanding |

---

## Open Questions

1. **File store sharing:** Should v2 share the v1 file store, or keep separate?
   - **Current recommendation:** Keep separate

2. **orgUid store updates:** Should we update the orgUid store keys (like adding `fileStoreIdV2`), or just store v2 file store ID only in the database?
   - **Current recommendation:** Store only in database

3. **v2 subscriber fallback:** When a v2 subscriber discovers an org, should we support fallback to v1 data if v2 doesn't exist, or keep v2-only strict?
   - **Current recommendation:** Keep v2-only strict (current behavior)

---

## Implementation Order

1. Update `upgradeFromV1()` in `src/models/v2/organizations-v2.model.js`
2. Update tests in `tests/v2/integration/organizations-v2.spec.js`
3. Run tests to verify upgrade works correctly
4. Update documentation in `docs/cadt_rpc_api_v2.md`
5. Manual testing with simulator mode
6. Manual testing with real datalayer (if applicable)
