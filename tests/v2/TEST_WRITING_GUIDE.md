# V2 Test Writing Guide

This guide documents the standard patterns and best practices for writing V2 integration tests.

## Table of Contents
1. [Test Structure](#test-structure)
2. [Test Setup and Cleanup](#test-setup-and-cleanup)
3. [Test Data Creation](#test-data-creation)
4. [API Response Structures](#api-response-structures)
5. [Assertions](#assertions)
6. [Common Patterns](#common-patterns)
7. [Best Practices](#best-practices)

---

## Test Structure

### Standard Test File Structure

```javascript
import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { StagingV2, [Model]V2 } from '../../../src/models/v2/index.js';
import {
  resetV2StagingTable,
  resetV2DataTables,
  createV2TestHomeOrg,
  getV2HomeOrgId,
  addUuidIfNeeded,
  createV2TestProgramChain, // If needed
} from '../utils/v2-test-helpers.js';

describe('V2 [Resource] API - Basic CRUD Tests', function () {
  this.timeout(30000);

  let testDependency1; // Store dependencies if needed across tests

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();
    await createV2TestHomeOrg(); // ALWAYS create home org

    // Create test dependencies if needed
    // Use createV2TestProgramChain() for complex chains
  });

  after(async function () {
    console.log('Cleaning up V2 test environment...');
    // Cleanup handled by test framework
  });

  beforeEach(async function () {
    await resetV2StagingTable();
    await resetV2DataTables();

    // Recreate ALL test dependencies after cleanup
    // This ensures test isolation
  });

  describe('POST /v2/[resource] (Create)', function () {
    // Tests...
  });

  describe('GET /v2/[resource] (List)', function () {
    // Tests...
  });

  describe('GET /v2/[resource]/:id (Get One)', function () {
    // Tests...
  });

  describe('PUT /v2/[resource]/:id (Update)', function () {
    // Tests...
  });

  describe('DELETE /v2/[resource]/:id (Delete)', function () {
    // Tests...
  });
});
```

---

## Test Setup and Cleanup

### Required Setup Steps

1. **Always create home org in `before` hook:**
   ```javascript
   before(async function () {
     await prepareV2Db();
     await createV2TestHomeOrg(); // REQUIRED
   });
   ```

2. **Always reset tables in `beforeEach`:**
   ```javascript
   beforeEach(async function () {
     await resetV2StagingTable();
     await resetV2DataTables();

     // Recreate test dependencies after cleanup
     // This ensures each test starts with clean state
   });
   ```

### Why This Pattern?

- **Home org**: Required for `orgUid` auto-assignment in Projects and Units
- **beforeEach cleanup**: Ensures test isolation - each test starts fresh
- **Dependency recreation**: After cleanup, recreate dependencies so tests can run independently

---

## Test Data Creation

### Using Shared Helpers

**Always use shared helpers from `v2-test-helpers.js`:**

```javascript
import {
  addUuidIfNeeded,
  createV2TestProgramChain,
  createV2TestProjectChain,
} from '../utils/v2-test-helpers.js';
```

### Creating Test Data

**For API Create/Update Tests:**
- Use API endpoints (`POST`, `PUT`) to test staging mechanism
- Verify staging records exist and contain correct data
- Check response structure: `success`, `message`, `uuid`

**For Query Tests:**
- Create data directly using models (`ModelV2.create()`)
- Query via API endpoints (`GET`)
- Verify response data structure

**Example - API Create Test:**
```javascript
it('should create a new unit record', async function () {
  const unitData = {
    unitSerialId: 'TEST-UNIT-001',
    unitStartBlock: '1000',
    unitEndBlock: '2000',
    unitVintageYear: 2024,
    cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
  };

  const response = await supertest(app)
    .post('/v2/unit')
    .send(unitData)
    .expect(200);

  expect(response.body.success).to.be.true;
  expect(response.body.message).to.equal('Unit staged successfully');
  expect(response.body.uuid).to.exist;

  // Verify staging record
  const stagingRecord = await StagingV2.findOne({
    where: { uuid: response.body.uuid },
  });
  expect(stagingRecord).to.exist;
  expect(stagingRecord.table).to.equal('unit');
  expect(stagingRecord.action).to.equal('INSERT');
  expect(stagingRecord.committed).to.be.false;
});
```

**Example - Query Test:**
```javascript
it('should return units from database', async function () {
  // Create data directly in DB for query tests
  const homeOrgId = await getV2HomeOrgId();
  const unit = await UnitV2.create(addUuidIfNeeded('UnitV2', {
    unitSerialId: 'TEST-UNIT-DB-001',
    unitStartBlock: '1000',
    unitEndBlock: '2000',
    unitVintageYear: 2024,
    cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
    orgUid: homeOrgId,
  }));

  const response = await supertest(app)
    .get('/v2/unit')
    .expect(200);

  // Check response structure (no pagination params = direct array)
  expect(response.body).to.be.an('array');
  expect(response.body).to.have.length(1);
  expect(response.body[0].unitSerialId).to.equal('TEST-UNIT-DB-001');
});
```

### Using Test Data Chain Helpers

For complex dependency chains, use helper functions:

```javascript
// Create full chain: Program → Project → Validation → Verification → Methodology → Issuance
const { program, project, validation, verification, methodology, issuance } =
  await createV2TestProgramChain({
    testId: '001',
    programName: 'Test Program',
    projectName: 'Test Project',
  });

// Create simple chain: Program → Project
const { program, project } = await createV2TestProjectChain({
  testId: '001',
});
```

---

## API Response Structures

### Understanding Response Formats

V2 API uses `optionallyPaginatedResponse()` which returns different structures based on query parameters:

**Without pagination (`?page=` or `?limit=`):**
```javascript
// Response is a direct array
[
  { id: 1, name: 'Item 1' },
  { id: 2, name: 'Item 2' }
]
```

**With pagination (`?page=1&limit=10`):**
```javascript
// Response is a paginated object
{
  page: 1,
  pageCount: 5,
  data: [
    { id: 1, name: 'Item 1' },
    { id: 2, name: 'Item 2' }
  ]
}
```

### Correct Assertions

**For non-paginated responses:**
```javascript
const response = await supertest(app)
  .get('/v2/unit')
  .expect(200);

expect(response.body).to.be.an('array');
expect(response.body).to.have.length(1);
expect(response.body[0].unitSerialId).to.equal('TEST-UNIT-001');
```

**For paginated responses:**
```javascript
const response = await supertest(app)
  .get('/v2/unit?page=1&limit=10')
  .expect(200);

expect(response.body).to.have.property('page');
expect(response.body).to.have.property('pageCount');
expect(response.body).to.have.property('data');
expect(response.body.data).to.be.an('array');
expect(response.body.data).to.have.length(1);
expect(response.body.data[0].unitSerialId).to.equal('TEST-UNIT-001');
```

**For error responses:**
```javascript
const response = await supertest(app)
  .post('/v2/unit')
  .send(invalidData)
  .expect(400);

expect(response.body.success).to.be.false;
expect(response.body.error).to.include('unitSerialId'); // Specific error message
```

**For staging responses (POST/PUT):**
```javascript
const response = await supertest(app)
  .post('/v2/unit')
  .send(unitData)
  .expect(200); // Always 200 for staging

expect(response.body.success).to.be.true;
expect(response.body.message).to.equal('Unit staged successfully');
expect(response.body.uuid).to.exist;
```

---

## Assertions

### Standard Assertion Patterns

**Success Responses:**
```javascript
expect(response.body.success).to.be.true;
expect(response.body.message).to.equal('[Resource] staged successfully');
expect(response.body.uuid).to.exist;
```

**Error Responses:**
```javascript
expect(response.status).to.equal(400); // or 404
expect(response.body.success).to.be.false;
expect(response.body.error).to.include('[field]'); // ALWAYS check specific error
```

**Staging Verification:**
```javascript
const stagingRecord = await StagingV2.findOne({
  where: { uuid: response.body.uuid },
});
expect(stagingRecord.table).to.equal('[table]');
expect(stagingRecord.action).to.equal('INSERT'); // or 'UPDATE', 'DELETE'
expect(stagingRecord.committed).to.be.false;

const stagedData = JSON.parse(stagingRecord.data);
expect(stagedData[0].field_name).to.equal('expected value');
```

### Error Message Assertions

**ALWAYS check specific error messages:**
```javascript
// ✅ GOOD - Specific error check
expect(response.body.error).to.include('unitSerialId');
expect(response.body.error).to.include('is required');

// ❌ BAD - Generic check only
expect(response.body.success).to.be.false;
// Missing specific error message check
```

---

## Common Patterns

### Pattern 1: Testing Staging Mechanism

```javascript
it('should stage unit creation', async function () {
  const response = await supertest(app)
    .post('/v2/unit')
    .send(unitData)
    .expect(200);

  // Verify staging response
  expect(response.body.success).to.be.true;
  expect(response.body.uuid).to.exist;

  // Verify staging record
  const stagingRecord = await StagingV2.findOne({
    where: { uuid: response.body.uuid },
  });
  expect(stagingRecord.committed).to.be.false;
});
```

### Pattern 2: Testing Query Filters

```javascript
it('should filter units by marketplace identifier', async function () {
  // Create test data directly in DB
  const unit1 = await UnitV2.create(addUuidIfNeeded('UnitV2', {
    unitSerialId: 'UNIT-001',
    marketplaceIdentifier: 'MARKET-001',
    // ... other fields
  }));

  const unit2 = await UnitV2.create(addUuidIfNeeded('UnitV2', {
    unitSerialId: 'UNIT-002',
    marketplaceIdentifier: 'MARKET-002',
    // ... other fields
  }));

  // Query with filter
  const response = await supertest(app)
    .get('/v2/unit?marketplaceIdentifiers=MARKET-001')
    .expect(200);

  expect(response.body).to.be.an('array');
  expect(response.body).to.have.length(1);
  expect(response.body[0].marketplaceIdentifier).to.equal('MARKET-001');
});
```

### Pattern 3: Testing Validation

```javascript
it('should reject unit without required field', async function () {
  const invalidData = {
    // Missing required unitSerialId
    unitStartBlock: '1000',
  };

  const response = await supertest(app)
    .post('/v2/unit')
    .send(invalidData)
    .expect(400);

  expect(response.body.success).to.be.false;
  expect(response.body.error).to.include('unitSerialId');
  expect(response.body.error).to.include('is required');
});
```

### Pattern 4: Testing Update

```javascript
it('should stage unit update', async function () {
  // Create unit directly in DB
  const unit = await UnitV2.create(addUuidIfNeeded('UnitV2', {
    unitSerialId: 'ORIGINAL-001',
    // ... other fields
  }));

  // Update via API
  const updateData = {
    unitSerialId: 'UPDATED-001',
    // ... all required fields
  };

  const response = await supertest(app)
    .put(`/v2/unit/${unit.cadTrustUnitId}`)
    .send(updateData)
    .expect(200);

  expect(response.body.success).to.be.true;

  // Verify staging record
  const stagingRecord = await StagingV2.findOne({
    where: { uuid: response.body.uuid },
  });
  const stagedData = JSON.parse(stagingRecord.data);
  expect(stagedData[0].unit_serial_id).to.equal('UPDATED-001');
});
```

---

## Best Practices

### 1. Test Isolation
- Always reset tables in `beforeEach`
- Recreate dependencies after cleanup
- Use unique test data identifiers

### 2. Use Shared Helpers
- Always import helpers from `v2-test-helpers.js`
- Don't duplicate helper functions
- Use `addUuidIfNeeded` for data tables

### 3. Response Structure Checks
- Check correct structure based on pagination
- Non-paginated: expect array
- Paginated: expect `{ page, pageCount, data }`

### 4. Error Assertions
- Always check specific error messages
- Don't just check `success: false`
- Verify error includes field name and reason

### 5. Staging Verification
- Always verify staging records exist
- Check `table`, `action`, `committed` fields
- Verify staged data matches request

### 6. Test Naming
- Use descriptive test names: `should [action] [resource] [condition]`
- Example: `should reject unit without required unitSerialId`

### 7. Test Data
- Use consistent test IDs: `TEST-[RESOURCE]-001`
- Store dependencies in variables if reused
- Use helper functions for complex chains

### 8. Timeouts
- Set appropriate timeouts: `this.timeout(30000)`
- Increase for datalayer operations: `this.timeout(300000)`

---

## Examples

See these files for reference:
- `tests/v2/integration/unit-v2.spec.js` - Comprehensive CRUD tests
- `tests/v2/integration/project-v2.spec.js` - Project tests with dependencies
- `tests/v2/integration/unit-v2-marketplace.spec.js` - Feature-specific tests
- `tests/v2/integration/program-v2.spec.js` - Simple resource tests

---

## Checklist

When writing a new test file, ensure:

- [ ] Home org created in `before` hook
- [ ] Tables reset in `beforeEach`
- [ ] Dependencies recreated in `beforeEach`
- [ ] Using shared helpers (`addUuidIfNeeded`, etc.)
- [ ] Correct response structure checks
- [ ] Specific error message assertions
- [ ] Staging verification for POST/PUT
- [ ] Descriptive test names
- [ ] Appropriate timeouts set
- [ ] Test data uses consistent naming






