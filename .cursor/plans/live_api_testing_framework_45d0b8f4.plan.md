---
name: ""
overview: ""
todos: []
---

# Live API Testing Framework for V2

## Overview

Create a completely separate test suite (`tests/v2/live-api/`) that tests the real API running on localhost. These tests will:

- Read port from production config file (`~/.chia/mainnet/cadt/config.yaml`)
- Make HTTP requests to `http://localhost:{port}`
- Accumulate data across tests (like real usage)
- Test POST, PUT, DELETE, and GET operations
- Test with large datasets
- Clean up all created data at the end using DELETE endpoints

## Structure

### Directory Structure

```
tests/v2/live-api/
├── helpers/
│   ├── live-api-helpers.js    # Helper functions for live API tests
│   └── shared-state.js         # Track created IDs across tests
├── data/
│   └── test-data-generators.js # Functions to generate test data
├── methodology-live.spec.js
├── program-live.spec.js
├── project-live.spec.js
├── validation-live.spec.js
├── verification-live.spec.js
├── issuance-live.spec.js
├── unit-live.spec.js
├── location-live.spec.js
├── estimation-live.spec.js
├── rating-live.spec.js
├── co-benefit-live.spec.js
├── label-live.spec.js
├── stakeholder-live.spec.js
├── project-methodology-live.spec.js
├── stakeholder-projects-live.spec.js
├── unit-label-live.spec.js
├── aef-t1-submission-live.spec.js
├── aef-t2-authorizations-live.spec.js
├── aef-t3-actions-live.spec.js
├── aef-t4-holdings-live.spec.js
├── aef-t5-authorized-entities-live.spec.js
└── cleanup-live.spec.js        # Final cleanup test (runs last)
```

## Implementation Details

### 1. Live API Helper (`tests/v2/live-api/helpers/live-api-helpers.js`)

**Key Functions:**

- `getLiveApiConfig()` - Reads production config from `~/.chia/mainnet/cadt/config.yaml` (not test config)
  - Uses `getChiaRoot()` to find config location
  - Reads `CW_PORT` from `APP.CW_PORT` (default: 31310)
  - Returns `{ baseUrl: 'http://localhost:{port}', port: {port} }`
- `createLiveApiRequest()` - Creates supertest instance pointing to localhost
  - Returns `supertest('http://localhost:{port}')`
- `waitForServer()` - Checks if server is running (health check)
  - Makes GET request to `/v2/health`
  - Retries with timeout if server not ready
- `getHomeOrgId()` - Gets home organization ID (assumes it exists)
  - Makes GET `/v2/organizations` and finds home org
- `commitStagedRecords(uuids)` - Helper to commit multiple staged records (batch commit)
  - Takes array of UUIDs
  - Makes POST `/v2/staging/commit` for each UUID
  - Returns array of commit responses
- `waitForDataToAppear(request, type, id, maxWaitTime = 600000)` - Waits for data to appear in database after commit
  - Polls GET `/v2/{type}/{id}` until record exists (or timeout)
  - Uses exponential backoff: start with 5 second intervals, increase to 30 seconds after 2 minutes
  - Throws error if data doesn't appear within maxWaitTime (default 10 minutes)
  - Blockchain transactions typically take 2-5 minutes, plus CADT polling time
- `waitForBatchToAppear(request, records, maxWaitTime = 600000)` - Waits for multiple records to appear
  - Takes array of `{type, id}` objects
  - Polls all records in parallel until all exist or timeout
  - More efficient than waiting for each individually
  - Returns when all records are found, or throws error if timeout

**Important:** This helper must NOT use `NODE_ENV=test` when reading config, or must explicitly read production config.

### 2. Test Data Generators (`tests/v2/live-api/data/test-data-generators.js`)

**Functions to generate realistic test data:**

Each resource generator should have multiple variants:

- `generate{Resource}()` - Creates standard test data with all fields populated
- `generate{Resource}Minimal()` - Creates minimal test data with only required fields
- `generate{Resource}Maximal()` - Creates maximal test data with all fields including optional ones
- `generate{Resource}LongStrings()` - Creates test data with very long string values (1000+ characters)
- `generate{Resource}InvalidPicklist()` - Creates test data with invalid picklist values (for error testing)
- `generate{Resource}InvalidForeignKey()` - Creates test data with non-existent foreign key IDs (for error testing)
- `generate{Resource}ForbiddenFields()` - Creates test data that includes forbidden fields like createdAt, updatedAt, ID fields (for error testing)

**Resource generators needed:**

- Methodology
- Program
- Project
- Validation
- Verification
- Issuance
- Unit
- Location
- Estimation
- Rating
- CoBenefit
- Label
- Stakeholder
- AefT1Submission
- AefT2Authorizations
- AefT3Actions
- AefT4Holdings
- AefT5AuthorizedEntities

**Helper functions:**

- `generateLargeDataset(resourceType, count, variant = 'standard')` - Generates arrays of test data for bulk operations
- `getLongString(length = 1000)` - Helper to generate long strings for testing
- `getInvalidPicklistValue(fieldName)` - Helper to generate invalid picklist values
- `getNonExistentId()` - Helper to generate UUIDs that don't exist (for foreign key error testing)

### 3. Test Pattern for Each Resource

Each test file follows this pattern with **batched commits**:

```javascript
import { expect } from 'chai';
import { getLiveApiRequest, getHomeOrgId, commitStagedRecords, waitForBatchToAppear } from '../helpers/live-api-helpers.js';
import { addCreatedId } from '../helpers/shared-state.js';
import { generate{Resource} } from '../data/test-data-generators.js';

describe('{Resource} Live API Tests', function () {
  this.timeout(600000); // 10 minute timeout (longer due to blockchain waits)

  let request;
  let homeOrgId;
  const createdIds = []; // Track all created IDs for cleanup
  const stagedUuids = []; // Track staged UUIDs for batch commit

  before(async function () {
    request = getLiveApiRequest();
    homeOrgId = await getHomeOrgId(request);
    // Optional: Check database is empty (warns if not, doesn't fail)
    await checkDatabaseEmpty(request);
  });

  describe('POST /v2/{resource}', function () {
    it('should create multiple {resource}s and batch commit', async function () {
      const dataArray = generateLargeDataset(10);
      const recordsToWaitFor = [];

      // Stage all records without committing
      for (const data of dataArray) {
        const response = await request
          .post('/v2/{resource}')
          .send(data)
          .expect(200);

        expect(response.body.success).to.be.true;
        expect(response.body.cadTrust{Resource}Id).to.exist;

        createdIds.push(response.body.cadTrust{Resource}Id);
        addCreatedId('{resource}', response.body.cadTrust{Resource}Id);
        stagedUuids.push(response.body.uuid);
        recordsToWaitFor.push({
          type: '{resource}',
          id: response.body.cadTrust{Resource}Id
        });
      }

      // Batch commit all staged records
      await commitStagedRecords(request, stagedUuids);
      stagedUuids.length = 0; // Clear array

      // Wait for blockchain transaction and data to appear in database
      await waitForBatchToAppear(request, recordsToWaitFor);

      // Verify all records are now in the database
      for (const record of recordsToWaitFor) {
        const getResponse = await request
          .get(`/v2/${record.type}/${record.id}`)
          .expect(200);
        expect(getResponse.body.cadTrust{Resource}Id).to.equal(record.id);
      }
    });
  });

  describe('GET /v2/{resource}', function () {
    it('should list all {resource}s', async function () {
      const response = await request
        .get('/v2/{resource}')
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body.length).to.be.greaterThan(0);
    });

    it('should get a specific {resource} by ID', async function () {
      // Use an ID from createdIds (must have been committed and synced)
      const id = createdIds[0];
      const response = await request
        .get(`/v2/{resource}/${id}`)
        .expect(200);

      expect(response.body.cadTrust{Resource}Id).to.equal(id);
    });
  });

  describe('PUT /v2/{resource}/:id', function () {
    it('should update a {resource} and batch commit', async function () {
      const id = createdIds[0];
      const updateData = generate{Resource}(); // New data
      const response = await request
        .put(`/v2/{resource}/${id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).to.be.true;

      // Stage the update
      stagedUuids.push(response.body.uuid);

      // Commit and wait for sync
      await commitStagedRecords(request, stagedUuids);
      stagedUuids.length = 0;
      await waitForBatchToAppear(request, [{ type: '{resource}', id }]);

      // Verify update
      const getResponse = await request
        .get(`/v2/{resource}/${id}`)
        .expect(200);
      // Verify updated fields match updateData
    });
  });

  describe('DELETE /v2/{resource}/:id', function () {
    it('should delete a {resource} and batch commit', async function () {
      const id = createdIds[createdIds.length - 1]; // Delete last one
      const response = await request
        .delete(`/v2/{resource}/${id}`)
        .expect(200);

      expect(response.body.success).to.be.true;

      // Stage the delete
      stagedUuids.push(response.body.uuid);

      // Commit and wait for sync
      await commitStagedRecords(request, stagedUuids);
      stagedUuids.length = 0;

      // Wait a bit for delete to sync, then verify record is gone
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds

      const getResponse = await request
        .get(`/v2/{resource}/${id}`)
        .expect(404); // Should be deleted

      createdIds.pop(); // Remove from tracking
    });
  });

  // Clean up any remaining staged records before moving to next test file
  after(async function () {
    if (stagedUuids.length > 0) {
      await commitStagedRecords(request, stagedUuids);
    }
  });
});
```

### 4. Cleanup Test (`tests/v2/live-api/cleanup-live.spec.js`)

This test runs last and deletes all data created during the test run using **batched commits**:

```javascript
import { expect } from 'chai';
import { getLiveApiRequest, commitStagedRecords, waitForBatchToAppear } from './helpers/live-api-helpers.js';
import { getAllCreatedIds } from './helpers/shared-state.js';

describe('Live API Cleanup', function () {
  this.timeout(600000); // 10 minute timeout

  let request;
  const stagedUuids = [];

  before(async function () {
    request = getLiveApiRequest();
  });

  it('should delete all created test data in batches', async function () {
    const allIds = getAllCreatedIds(); // Already in reverse dependency order

    // Stage all deletes first
    for (const { type, id } of allIds) {
      const response = await request
        .delete(`/v2/${type}/${id}`)
        .expect(200);

      stagedUuids.push(response.body.uuid);
    }

    // Batch commit all deletes
    await commitStagedRecords(request, stagedUuids);

    // Wait for deletes to sync (may take several minutes)
    // Note: We can't easily verify deletes are gone since GET will 404,
    // but we can wait a reasonable time for sync
    await new Promise(resolve => setTimeout(resolve, 120000)); // Wait 2 minutes

    // Verify records are deleted by attempting to GET them
    let deletedCount = 0;
    for (const { type, id } of allIds) {
      try {
        await request.get(`/v2/${type}/${id}`).expect(404);
        deletedCount++;
      } catch (error) {
        // If we get 200, record still exists (may need more time)
        console.warn(`Record ${type}/${id} still exists after delete`);
      }
    }

    console.log(`Deleted ${deletedCount} of ${allIds.length} records`);
  });
});
```

### 5. Shared State Helper (`tests/v2/live-api/helpers/shared-state.js`)

Tracks all created IDs across test files:

```javascript
const createdIds = {
  methodology: [],
  program: [],
  project: [],
  validation: [],
  verification: [],
  issuance: [],
  unit: [],
  location: [],
  estimation: [],
  rating: [],
  coBenefit: [],
  label: [],
  stakeholder: [],
  'project-methodology': [],
  'stakeholder-projects': [],
  'unit-label': [],
  'aef-t1-submission': [],
  'aef-t2-authorizations': [],
  'aef-t3-actions': [],
  'aef-t4-holdings': [],
  'aef-t5-authorized-entities': [],
};

export const addCreatedId = (type, id) => {
  if (!createdIds[type]) {
    createdIds[type] = [];
  }
  createdIds[type].push(id);
};

export const getAllCreatedIds = () => {
  const all = [];
  // Delete in reverse dependency order
  const deleteOrder = [
    'unit-label',
    'stakeholder-projects',
    'project-methodology',
    'unit',
    'issuance',
    'verification',
    'validation',
    'aef-t4-holdings',
    'aef-t3-actions',
    'aef-t2-authorizations',
    'aef-t5-authorized-entities',
    'aef-t1-submission',
    'co-benefit',
    'estimation',
    'rating',
    'label',
    'stakeholder',
    'project',
    'program',
    'methodology',
    'location',
  ];

  for (const type of deleteOrder) {
    if (createdIds[type] && createdIds[type].length > 0) {
      for (const id of createdIds[type]) {
        all.push({ type, id });
      }
    }
  }

  return all;
};
```

### 6. Package.json Script

Add new script to run live API tests:

```json
"test:v2:live": "npx cross-env NODE_ENV=production mocha --loader node_modules/extensionless/src/register.js 'tests/v2/live-api/**/*.spec.js' --reporter spec --exit --timeout 300000"
```

**Note:** Uses `NODE_ENV=production` so config loader reads production config, not test config. However, we may need to explicitly read production config regardless of NODE_ENV.

## Key Implementation Points

1. **Config Reading**: Helper must read from `~/.chia/mainnet/cadt/config.yaml` (production config), not test config. May need to explicitly set CHIA_ROOT or read config directly.
2. **Server Assumption**: Tests assume server is already running - helper checks with health endpoint
3. **Data Accumulation**: Each test adds to shared state, data persists across tests
4. **Batched Commits**: All POST/PUT/DELETE operations stage data, but commits are batched to minimize blockchain wait times

   - Stage multiple operations (e.g., create 10 records)
   - Commit all at once
   - Wait for blockchain transaction to complete and data to sync into database
   - Then verify with GET requests

5. **Blockchain Wait**: After committing, must wait for:

   - Chia datalayer transaction to be submitted
   - Transaction to be confirmed on blockchain (takes minutes)
   - CADT to poll datalayer and see the transaction
   - CADT to download and insert data into database
   - Data to be available via GET requests

6. **Cleanup Order**: Delete in reverse dependency order (units → issuances → verifications → validations → projects → programs → methodologies)
7. **Large Dataset Testing**: Include tests that create 50-100+ records to test performance - batch commit all at once
8. **Error Handling**: Tests should handle cases where server is not running gracefully
9. **Timeout Management**: Tests need longer timeouts (10+ minutes) due to blockchain wait times

## Files to Create

1. `tests/v2/live-api/helpers/live-api-helpers.js`
2. `tests/v2/live-api/helpers/shared-state.js`
3. `tests/v2/live-api/data/test-data-generators.js`
4. Individual test files for each resource type (20+ files)
5. `tests/v2/live-api/cleanup-live.spec.js`
6. Update `package.json` with new test script

## Testing Strategy

- **Sequential Execution**: Tests run in order, data accumulates
- **Dependency Handling**: Tests that depend on other resources (e.g., project-methodology) run after base resources
- **Cleanup Verification**: After cleanup, verify all created records are gone
- **Error Scenarios**: Test invalid data, missing fields, etc.
- **Large Data**: Create tests with 100+ records to test API performance

## Implementation Phases

### Phase 1: Validation Test (Start Here)

Create a minimal test to validate the entire process works before building the full suite.

**Phase 1 Todos:**

1. Create `tests/v2/live-api/helpers/live-api-helpers.js` with core functions:

   - Read production config from `~/.chia/mainnet/cadt/config.yaml`
   - Create supertest instance pointing to `http://localhost:{port}`
   - Check server health (`/v2/health`)
   - Get home org ID from `/v2/organizations`
   - Batch commit staged records (`commitStagedRecords`)
   - Wait for data to appear in database (`waitForDataToAppear`, `waitForBatchToAppear`)

2. Create `tests/v2/live-api/helpers/shared-state.js` - simple version to track created IDs

3. Create `tests/v2/live-api/data/test-data-generators.js` - start with methodology resource:

   - `generateMethodology()` - standard with all fields
   - `generateMethodologyMinimal()` - only required fields
   - `generateMethodologyMaximal()` - all fields including optional
   - `generateMethodologyLongStrings()` - with 1000+ char strings
   - `generateMethodologyInvalidPicklist()` - invalid picklist values
   - `generateMethodologyInvalidForeignKey()` - non-existent foreign key IDs
   - `generateMethodologyForbiddenFields()` - includes createdAt, updatedAt, ID fields
   - Helper functions: `getLongString()`, `getInvalidPicklistValue()`, `getNonExistentId()`

4. Create `tests/v2/live-api/methodology-validation.spec.js` - comprehensive test:

**Happy Path Tests:**

   - Create 3 methodologies with standard data (stage only, no commit yet)
   - Create 1 methodology with minimal required fields only
   - Create 1 methodology with all fields populated (maximal)
   - Create 1 methodology with long string values
   - Batch commit all 5
   - Wait for blockchain sync and data to appear
   - Verify all 5 appear via GET requests
   - Verify long strings are preserved correctly
   - Update one methodology with new data
   - Commit update
   - Wait and verify update
   - Delete one methodology
   - Commit delete
   - Wait and verify deletion (404)

**Error Case Tests (should NOT commit, just verify errors):**

   - Test missing required fields → expect 400 with specific error message
   - Test invalid picklist values → expect 400 with validation error
   - Test non-existent foreign key IDs → expect 400 with foreign key error
   - Test forbidden fields (createdAt, updatedAt) → expect 400 with "cannot be set via API" message
   - Test forbidden ID field (cadTrustMethodologyId) → expect 400 with "auto-generated" message
   - Test unknown fields → expect 400 with validation error about unknown fields
   - Test invalid data types → expect 400 with type validation error

5. Add `test:v2:live:validation` script to package.json

6. Run validation test and verify entire flow works

**Success Criteria for Phase 1:**

- Config reads correctly from production location
- Server connection works
- Database empty check works (warns if not empty, doesn't fail)
- Staging works (POST returns UUID)
- Batch commit works (multiple UUIDs committed)
- Wait functions work (data appears after blockchain sync)
- GET requests work after sync with exact count verification
- Updates work (PUT + commit + wait + verify)
- Deletes work (DELETE + commit + wait + verify 404)
- Edge cases work:
  - Minimal fields (only required) → creates successfully
  - Maximal fields (all fields) → creates successfully
  - Long strings (1000+ chars) → preserved correctly
- Error cases return correct errors:
  - Missing required fields → 400 with field name in error
  - Invalid picklist values → 400 with validation error
  - Non-existent foreign keys → 400 with foreign key error
  - Forbidden fields (createdAt, updatedAt) → 400 with "cannot be set via API"
  - Forbidden ID fields → 400 with "auto-generated" message
  - Unknown fields → 400 with validation error
  - Invalid data types → 400 with type validation error

### Phase 2: Full Test Suite (After Phase 1 Validation)

Once Phase 1 is validated, build out the complete test suite:

**Phase 2 Todos:**

1. Expand `test-data-generators.js` with all resource types

2. Create live API test files for core resources: methodology, program, project, validation, verification, issuance, unit, location

   - Each test file should batch stage operations, commit in batches, wait for sync, then verify

3. Create live API test files for tier 1 dependencies: estimation, rating, co-benefit, label, stakeholder

   - These depend on core resources, so they run after core resources are committed and synced

4. Create live API test files for join tables: project-methodology, stakeholder-projects, unit-label

   - These depend on both core resources and tier 1 resources

5. Create live API test files for AEF resources: aef-t1-submission, aef-t2-authorizations, aef-t3-actions, aef-t4-holdings, aef-t5-authorized-entities

6. Create cleanup-live.spec.js that deletes all created test data in reverse dependency order using batched commits

7. Add `test:v2:live` script to package.json to run full test suite
