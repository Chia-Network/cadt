# V1 Live API Testing Plan

## Overview

This plan documents how to create live API tests for V1 endpoints that mirror the structure and approach used in the V2 live API tests (`tests/v2/live-api/`).

**Key Principle**: Following the V2 testing pattern, we only test endpoints that have POST/PUT/DELETE operations. The test flow is: **POST → COMMIT → VALIDATE**, then **PUT → COMMIT → VALIDATE**, then **DELETE → COMMIT → VALIDATE**.

**V1 Endpoints to Test** (only endpoints with POST/PUT/DELETE):
- `projects` - POST, PUT, DELETE
- `units` - POST, PUT, DELETE
- `staging` - POST (commit), DELETE

**Not Tested** (read-only or excluded):
- Read-only endpoints (issuances, labels, audit) - used for validation only, no separate test files
- Organization endpoints - tested separately via organization-create/delete commands
- Governance, filestore, offer - excluded
- XLSX features - excluded

## Test Structure and Execution

**CRITICAL**: Tests are organized into separate suites that can run independently or together:

### Test Suites

1. **Organization Creation** (`test:v1:live:organization:create`):
   - File: `tests/v1/live-api/organization/organization-create.live.spec.js`
   - Creates V1 organization → saves UID to state file
   - State file location: `tests/v2/.organization-state.json` (shared with V2)
   - Timeout: 120 minutes (organization creation takes ~30 minutes)
   - **NOT included in data-short.js or data-extended.js**

2. **Data Tests** (`test:v1:live:data:short` or `test:v1:live:data:extended`):
   - Files: `tests/v1/live-api/*-validation.live.spec.js` (project-validation.live.spec.js, etc.)
   - Tests CRUD operations on resources (projects, units, staging, etc.)
   - Assumes organizations already exist (from create step)
   - Timeout: 10 minutes per test file
   - **Does NOT include organization tests**

3. **Organization Deletion** (`test:v1:live:organization:delete`):
   - File: `tests/v1/live-api/organization/organization-delete.live.spec.js`
   - Reads organization UID from state file
   - Deletes created organization
   - Clears state file after deletion
   - Timeout: 10 minutes
   - **NOT included in data-short.js or data-extended.js**

**Workflow**: Run `organization:create` → `data:short` (or `data:extended`) → `organization:delete`

## Reference: V2 Test Structure

The V2 live API tests (`tests/v2/live-api/`) use the following structure:

### Key Components

1. **Orchestration Files**:
   - `data-short.js` - Runs tests in batches: POST → commit → PUT → commit → DELETE → commit
   - `data-extended.js` - Runs tests with immediate commits after each operation

2. **Test Files**:
   - One test file per endpoint (e.g., `project-validation.live.spec.js`)
   - Each test file follows a standard structure:
     - Step 3: Validation Failure Tests (reject invalid data)
     - Step 4: POST Request Tests (create records)
     - Step 5: Staging Commit (if short mode)
     - Step 6: Validation After Commit
     - Step 7: PUT Request Tests (update records)
     - Step 9: DELETE Request Tests (delete records)

3. **Helper Files** (`helpers/`):
   - `live-api-helpers.js` - Config reading, staging operations, data validation
   - `api-request-helpers.js` - POST/PUT/DELETE request wrappers with ID extraction
   - `shared-setup.js` - One-time setup (server check, home org ID, empty DB check)
   - `shared-state.js` - Track created IDs, batch verification records
   - `mocha-setup.js` - Runs shared setup before all tests

4. **Test Data**:
   - `data/test-data-generators.js` - Functions to generate test data (minimal, typical, maximal, invalid)

## V1 Endpoints to Test

**IMPORTANT**: Following the V2 testing pattern, we only test endpoints that have POST/PUT/DELETE operations. Read-only endpoints (GET-only) are NOT tested separately - they are used for validation or as part of the workflow.

### Endpoints with POST/PUT/DELETE Operations

1. **projects** (`/v1/projects`)
   - POST `/`: Stage a new project
   - PUT `/`: Update a project
   - DELETE `/`: Delete a project
   - **Note**: XLSX upload/update features (`PUT /xlsx`) are NOT tested
   - **Note**: CSV batch upload (`POST /batch`) is NOT tested
   - **Note**: Transfer endpoint (`PUT /transfer`) is NOT tested
   - **Important**: V1 projects support nested child records in a single request (unlike V2 where these are separate tables):
     - `labels` (array)
     - `issuances` (array)
     - `coBenefits` (array)
     - `relatedProjects` (array)
     - `projectLocations` (array)
     - `projectRatings` (array)
     - `estimations` (array)
   - **Testing Strategy**:
     - **YES, we test projects with all nested fields** (issuances, labels, locations, etc.)
     - Test projects with minimal data (required fields only)
     - Test projects with typical data (some optional fields, no nested arrays)
     - Test projects with maximal data (all fields including nested arrays with all child record types)
     - This tests the full V1 capability where related data is embedded in the project request, which is a key difference from V2

2. **units** (`/v1/units`)
   - POST `/`: Stage a new unit
   - PUT `/`: Update a unit
   - DELETE `/`: Delete a unit
   - **Note**: XLSX upload/update features (`PUT /xlsx`) are NOT tested
   - **Note**: CSV batch upload (`POST /batch`) is NOT tested
   - **Note**: Split units (`POST /split`) is NOT tested

3. **staging** (`/v1/staging`)
   - POST `/commit`: Commit staging records
   - DELETE `/clean`: Delete all staging records
   - DELETE `/`: Delete specific staging record by UUID
   - **Note**: Retry endpoint (`POST /retry`) is NOT tested separately (can be tested as part of staging workflow)

### Read-Only Endpoints (NOT Tested Separately)

These endpoints are used for validation or as part of the workflow, but do NOT have separate test files:
- **issuances** (`/v1/issuances`) - GET only, used for validation
- **labels** (`/v1/labels`) - GET only, used for validation
- **audit** (`/v1/audit`) - GET only, used for validation

### Organization Tests (Separate)

**organizations** (`/v1/organizations`) - Tested separately via `test:v1:live:organization:create` and `test:v1:live:organization:delete` commands. NOT included in data test orchestration.

### Excluded Endpoints

**Note**: Governance, filestore, and offer endpoints are NOT included in this test suite.

## Test File Structure

### Test File Naming Convention

For V1, use the naming pattern: `{endpoint-name}-validation.live.spec.js`

**Test Files to Create:**
- `project-validation.live.spec.js` - Tests POST, PUT, DELETE for projects
- `unit-validation.live.spec.js` - Tests POST, PUT, DELETE for units
- `staging-validation.live.spec.js` - Tests POST (commit), DELETE for staging

**Organization Tests (Separate):**
- `organization/organization-create.live.spec.js` - Creates organization (separate command)
- `organization/organization-delete.live.spec.js` - Deletes organization (separate command)

**Read-Only Endpoints:**
- No separate test files for issuances, labels, or audit - these are used for validation only

### Test File Template Structure

Each test file should follow this structure (based on V2 pattern):

```javascript
import { expect } from 'chai';
import {
  commitStagedRecords,
  waitForPendingCommits,
  waitForStagingEmpty,
  waitForDataToAppear,
  waitForBatchToAppear,
  clearStagingTable,
  validateDataInDatabase,
} from './helpers/live-api-helpers.js';
import { getSharedRequest, getSharedHomeOrgId } from './helpers/shared-setup.js';
import {
  makePostRequest,
  makePutRequest,
  makeDeleteRequest,
  checkRecordInStaging,
} from './helpers/api-request-helpers.js';
import {
  addCreatedId,
  shouldAutoCommit,
  trackBatchVerification,
  getFirstRecordIdFromDatabase,
  getAllRecordIdsFromDatabase
} from './helpers/shared-state.js';
import {
  generate{EndpointName},
  generate{EndpointName}Minimal,
  generate{EndpointName}Maximal,
  generate{EndpointName}LongStrings,
  generate{EndpointName}ForbiddenFields,
  getLongString,
  getInvalidPicklistValue,
} from './data/test-data-generators.js';

describe('{Endpoint Name} Live API Validation Tests', function () {
  this.timeout(600000); // 10 minute timeout
  let request;
  let homeOrgId;
  const createdIds = []; // Track all created IDs

  before(async function () {
    request = getSharedRequest();
    homeOrgId = getSharedHomeOrgId();
  });

  describe('Step 3: Validation Failure Tests', function () {
    it('should reject POST with forbidden fields (createdAt, updatedAt, ID)', async function () {
      // Test invalid data
    });

    it('should reject POST with invalid picklist values', async function () {
      // Test invalid picklist
    });

    it('should reject POST with missing required fields', async function () {
      // Test missing fields
    });

    it('should reject POST with strings that are too long', async function () {
      // Test long strings
    });

    it('should reject POST with invalid data types', async function () {
      // Test wrong types
    });

    after(async function () {
      await clearStagingTable(request);
    });
  });

  describe('Step 4: POST Request Tests', function () {
    it('should create records with typical, minimal, and maximal data', async function () {
      // Create 1 typical, 1 minimal, 1 maximal record
      // Track IDs, check staging, commit if extended mode
    });
  });

  describe('Step 5: Staging Commit (if short mode)', function () {
    it('should commit all staged records in batch', async function () {
      if (!shouldAutoCommit()) {
        // Batch commit logic
      }
    });
  });

  describe('Step 6: Validation After Commit', function () {
    it('should validate all created records are in database', async function () {
      // Verify records exist
    });
  });

  describe('Step 7: PUT Request Tests', function () {
    it('should update a record', async function () {
      // Get existing record, update with all fields, verify
    });
  });

  describe('Step 9: DELETE Request Tests', function () {
    it('should delete a record', async function () {
      // Delete record, verify deletion
    });
  });
});
```

## Implementation Steps

### Step 1: Create Directory Structure

Create the following directory structure under `tests/v1/live-api/`:

```
tests/v1/live-api/
├── data/
│   └── test-data-generators.js
├── helpers/
│   ├── live-api-helpers.js
│   ├── api-request-helpers.js
│   ├── shared-setup.js
│   ├── shared-state.js
│   └── mocha-setup.js
├── organization/
│   ├── organization-create.live.spec.js (separate from data tests)
│   └── organization-delete.live.spec.js (separate from data tests)
├── data-short.js (does NOT include organization tests)
├── data-extended.js (does NOT include organization tests)
└── {endpoint}-validation.live.spec.js (one per data endpoint: project, unit, staging, etc.)
```

### Step 2: Adapt Helper Files from V2

#### 2.1 `helpers/live-api-helpers.js`

**Key Changes Needed:**
- Change all `/v2/` endpoints to `/v1/`
- Update `getHomeOrgId()` to handle V1 response format (object keyed by orgUid, not array)
- Update `checkDatabaseEmpty()` to check V1 tables: `projects`, `units`, `issuances`, `labels`, etc.
- Update `waitForDataToAppear()` to use V1 GET endpoints
- Update `validateDataInDatabase()` to use V1 GET endpoints
- Update `clearStagingTable()` to use `/v1/staging/clean` endpoint
- Update `commitStagedRecords()` to use `/v1/staging/commit` endpoint
- Update `waitForPendingCommits()` to check `/v1/staging/hasPendingCommits`
- Update `waitForStagingEmpty()` to check `/v1/staging` endpoint

**V1-Specific Considerations:**
- V1 uses `warehouseProjectId` and `warehouseUnitId` instead of UUIDs
- V1 staging uses different response format
- V1 GET endpoints may return paginated results differently
- V1 does NOT have a `/v1/health` endpoint - use `/v1/organizations` for health checks

#### 2.2 `helpers/api-request-helpers.js`

**Key Changes Needed:**
- Update `extractIdFromResponse()` to map V1 endpoints:
  ```javascript
  const endpointToIdField = {
    '/v1/projects': 'warehouseProjectId',
    '/v1/units': 'warehouseUnitId',
    '/v1/organizations': 'orgUid',
    // Note: issuances, labels don't have POST endpoints
  };
  ```
- Update all endpoint paths from `/v2/` to `/v1/`
- Handle V1 response format differences (V1 may return `{ success: true, message: "...", uuid: "..." }`)

**V1-Specific Considerations:**
- V1 POST responses may include `uuid` field for staging UUID
- V1 uses different field names (camelCase in API, snake_case in DB)
- Some endpoints may return different response structures
- V1 does NOT have a `/v1/health` endpoint - use `/v1/organizations` for health checks

#### 2.3 `helpers/shared-setup.js`

**Key Changes Needed:**
- **Health Check**: V1 does NOT have a `/v1/health` endpoint. Use `/v1/organizations` as health check endpoint instead
- Update `getHomeOrgId()` to use `/v1/organizations` and parse V1 response format (object keyed by orgUid)
- Update empty database check to use V1 endpoints

#### 2.4 `helpers/shared-state.js`

**Minimal Changes:**
- May need to adjust ID tracking if V1 uses different ID formats
- V1 uses `warehouseProjectId`/`warehouseUnitId` strings, not UUIDs

#### 2.5 `helpers/mocha-setup.js`

**Minimal Changes:**
- Should work as-is, just imports from shared-setup.js

### Step 3: Create Test Data Generators

Create `data/test-data-generators.js` with functions for each V1 endpoint.

**Key Functions Needed:**

For each endpoint (projects, units, organizations, etc.):

```javascript
// Typical data (all required fields + some optional)
export const generateProject = (overrides = {}) => {
  return {
    projectId: faker.string.alphanumeric(10),
    originProjectId: faker.string.alphanumeric(10),
    registryOfOrigin: 'Verra',
    projectName: faker.company.name(),
    projectLink: faker.internet.url(),
    projectDeveloper: faker.person.fullName(),
    sector: 'Agriculture Forestry and Other Land Use (AFOLU)',
    projectType: 'Afforestation',
    coveredByNDC: 'Inside NDC',
    projectStatus: 'Registered',
    projectStatusDate: faker.date.past().toISOString().split('T')[0],
    unitMetric: 'tCO2e',
    methodology: 'ACR - Truck Stop Electrification',
    // Optional fields (some included in typical)
    program: 'Test Program',
    ndcInformation: 'NDC info',
    ...overrides,
  };
};

// Minimal data (only required fields)
export const generateProjectMinimal = (overrides = {}) => {
  return {
    projectId: faker.string.alphanumeric(10),
    originProjectId: faker.string.alphanumeric(10),
    registryOfOrigin: 'Verra',
    projectName: faker.company.name(),
    projectLink: faker.internet.url(),
    projectDeveloper: faker.person.fullName(),
    sector: 'Agriculture Forestry and Other Land Use (AFOLU)',
    projectType: 'Afforestation',
    coveredByNDC: 'Inside NDC',
    projectStatus: 'Registered',
    projectStatusDate: faker.date.past().toISOString().split('T')[0],
    unitMetric: 'tCO2e',
    methodology: 'ACR - Truck Stop Electrification',
    ...overrides,
  };
};

// Maximal data (all fields including nested child records)
export const generateProjectMaximal = (overrides = {}) => {
  return {
    ...generateProject(),
    program: 'Test Program',
    projectTags: 'tag1, tag2',
    ndcInformation: 'NDC info',
    validationBody: 'Test Validation Body',
    validationDate: faker.date.past().toISOString().split('T')[0],
    // Nested child records (V1 feature - these are separate tables in V2)
    labels: [
      {
        label: 'Sample Label',
        labelType: 'Certification',
        creditingPeriodStartDate: faker.date.past().toISOString().split('T')[0],
        creditingPeriodEndDate: faker.date.future().toISOString().split('T')[0],
        validityPeriodStartDate: faker.date.past().toISOString().split('T')[0],
        validityPeriodEndDate: faker.date.future().toISOString().split('T')[0],
        unitQuantity: 40,
        labelLink: faker.internet.url(),
      },
    ],
    issuances: [
      {
        startDate: faker.date.past().toISOString().split('T')[0],
        endDate: faker.date.past().toISOString().split('T')[0],
        verificationApproach: 'Sample Approach',
        verificationReportDate: faker.date.past().toISOString().split('T')[0],
        verificationBody: 'Sample Body',
      },
    ],
    coBenefits: [
      {
        cobenefit: 'SDG 1 - No poverty',
      },
    ],
    projectLocations: [
      {
        country: 'United States of America',
        inCountryRegion: 'California',
        geographicIdentifier: 'Sample Identifier',
      },
    ],
    projectRatings: [
      {
        ratingType: 'CCQI',
        ratingRangeHighest: '100',
        ratingRangeLowest: '0',
        rating: '97',
        ratingLink: faker.internet.url(),
      },
    ],
    estimations: [
      {
        creditingPeriodStart: faker.date.past().toISOString().split('T')[0],
        creditingPeriodEnd: faker.date.future().toISOString().split('T')[0],
        unitCount: 100,
      },
    ],
    relatedProjects: [
      {
        relatedProjectId: '123',
        relationshipType: 'Sample',
        registry: 'Verra',
      },
    ],
    ...overrides,
  };
};

// Long strings (for validation testing)
export const generateProjectLongStrings = (overrides = {}) => {
  const longString = 'x'.repeat(10000);
  return {
    ...generateProject(),
    projectName: longString,
    ...overrides,
  };
};

// Forbidden fields (createdAt, updatedAt, warehouseProjectId)
export const generateProjectForbiddenFields = (overrides = {}) => {
  return {
    ...generateProject(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    warehouseProjectId: 'should-not-be-set',
    ...overrides,
  };
};
```

**Reference V1 API Documentation:**
- Use `docs/cadt_rpc_api.md` to identify:
  - Required fields for each endpoint
  - Optional fields
  - Valid picklist values
  - Field types and constraints

**Data Sources:**
- Use examples from `docs/cadt_rpc_api.md` as reference
- Use faker.js or similar for generating test data
- Ensure picklist values match governance data

### Step 4: Create Test Files

Create one test file per endpoint following the template structure.

**Dependencies and Order:**

**IMPORTANT**: Organization tests are separate from data tests. Organization tests are in the `organization/` subdirectory and run independently via `test:v1:live:organization:create` and `test:v1:live:organization:delete` commands.

The data test files (included in `data-short.js` and `data-extended.js`) assume organizations already exist.

V1 data endpoints have dependencies:
1. **projects** - Needs organization (orgUid) - assumes org exists
2. **units** - Needs project (warehouseProjectId), optionally issuance
3. **staging** - Works with projects and units

**Test File Order for data-short.js:**

**NOTE**: Only endpoints with POST/PUT/DELETE operations are tested. Read-only endpoints (issuances, labels, audit) are used for validation but don't have separate test files.

**NOTE**: Organization tests are NOT included here - they are separate and run via `test:v1:live:organization:create` command.

```javascript
const testFiles = [
  // Projects (assumes organizations already exist)
  'project-validation.live.spec.js',

  // Units (needs project, optionally issuance)
  'unit-validation.live.spec.js',

  // Staging (works with projects/units)
  'staging-validation.live.spec.js',
];
```

### Step 5: Create Orchestration Files

#### 5.1 `data-short.js`

Copy from V2 and adapt:
- Update test file list to V1 endpoints
- Update helper imports (should work as-is if helpers are adapted)
- Update endpoint paths in comments

#### 5.2 `data-extended.js`

Copy from V2 and adapt:
- Update test file list to V1 endpoints
- Update helper imports

### Step 6: Add Package.json Scripts

Add to `package.json`:

**IMPORTANT**: Organization tests are separate from data tests. The workflow is:
1. Run `test:v1:live:organization:create` first (creates organizations, saves to state file)
2. Run `test:v1:live:data:short` or `test:v1:live:data:extended` (assumes organizations exist)
3. Run `test:v1:live:organization:delete` last (cleans up organizations)

```json
{
  "scripts": {
    "test:v1:live:data:short": "node --import=extensionless/register tests/v1/live-api/data-short.js",
    "test:v1:live:data:extended": "node --import=extensionless/register tests/v1/live-api/data-extended.js",
    "test:v1:live:organization:create": "npx cross-env NODE_ENV=production mocha --loader node_modules/extensionless/src/register.js 'tests/v1/live-api/organization/organization-create.live.spec.js' --reporter spec --exit --timeout 7200000",
    "test:v1:live:organization:delete": "npx cross-env NODE_ENV=production mocha --loader node_modules/extensionless/src/register.js 'tests/v1/live-api/organization/organization-delete.live.spec.js' --reporter spec --exit --timeout 600000",
    "test:v1:live:all": "npm run test:v1:live:organization:create && npm run test:v1:live:data:short && npm run test:v1:live:organization:delete"
  }
}
```
<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
read_file

## V1-Specific Considerations

### API Response Format Differences

1. **Organizations GET**:
   - V1: Returns object keyed by orgUid: `{ "orgUid": { org data }, ... }`
   - V2: Returns object keyed by org_uid: `{ "org_uid": { org data }, ... }`

2. **Projects/Units GET**:
   - V1: Returns paginated: `{ page: 1, pageCount: 10, data: [...] }`
   - V2: Returns paginated: `{ page: 1, pageCount: 10, data: [...] }` (similar)

3. **POST Responses**:
   - V1: `{ success: true, message: "...", uuid: "..." }` (staging UUID)
   - V2: `{ success: true, cadTrustProjectId: "..." }` (record UUID)

4. **Field Names**:
   - V1 API: camelCase (e.g., `warehouseProjectId`, `orgUid`)
   - V1 DB: snake_case (e.g., `warehouse_project_id`, `org_uid`)
   - V2 API: camelCase (e.g., `cadTrustProjectId`, `orgUid`)
   - V2 DB: snake_case (e.g., `cad_trust_project_id`, `org_uid`)

### Staging Differences

1. **Staging Table Structure**:
   - V1: Uses `Staging` table with `uuid`, `table`, `action`, `commited`, `failedCommit`
   - V2: Uses `Staging` table with similar structure

2. **Commit Process**:
   - V1: `/v1/staging/commit` with query params: `table`, `ids`, `author`, `comment`
   - V2: `/v2/staging/commit` with body params

### Test Data Considerations

1. **Required Fields**:
   - Reference `docs/cadt_rpc_api.md` POST examples for required fields
   - V1 projects require: `projectId`, `originProjectId`, `registryOfOrigin`, `projectName`, `projectLink`, `projectDeveloper`, `sector`, `projectType`, `coveredByNDC`, `projectStatus`, `projectStatusDate`, `unitMetric`, `methodology`
   - V1 units require: `projectLocationId`, `unitOwner`, `countryJurisdictionOfOwner`, `vintageYear`, `unitType`, `unitStatus`, `unitBlockStart`, `unitBlockEnd`, `unitCount`, `unitRegistryLink`, `correspondingAdjustmentDeclaration`, `correspondingAdjustmentStatus`

2. **Picklist Values**:
   - Reference `docs/cadt_rpc_api.md` for valid picklist values and examples
   - Picklist values are typically defined in governance data, but governance endpoints are not tested

3. **Organization Context**:
   - V1 requires `orgUid` for projects/units (from home organization)
   - Get home org ID from `/v1/organizations` (find `isHome: true`)

## Testing Strategy

### Phase 0: Validation Failure Tests
- Test forbidden fields (createdAt, updatedAt, ID fields)
- Test invalid picklist values
- Test missing required fields
- Test strings that are too long
- Test invalid data types
- Clear staging after all validation tests

### Phase 1: POST Tests
- Create typical, minimal, and maximal records
- Track created IDs (warehouseProjectId, warehouseUnitId, etc.)
- Check records are in staging
- In extended mode: commit immediately and verify
- In short mode: track for batch commit

### Phase 2: PUT Tests
- Get existing record (from created IDs or database)
- Update with all fields (V1 requires ALL fields in PUT)
- Verify update in staging/database

### Phase 3: DELETE Tests
- Delete records (from created IDs or database)
- Verify deletion

## Special Endpoint Considerations

### XLSX Features
- **XLSX upload/update features are NOT tested**
- This includes `PUT /v1/projects/xlsx` and `PUT /v1/units/xlsx`
- The `xls` query parameter for GET endpoints (exporting to XLSX) is also not tested
- Only JSON-based POST/PUT operations are tested

### Offer Features
- **Offer endpoints are NOT tested**
- This includes all `/v1/offer` endpoints (GET, POST, DELETE)
- Offer functionality requires projects in staging and is excluded from test suite

### Organizations
- **Organization tests are SEPARATE from data tests** - they are NOT included in `data-short.js` or `data-extended.js`
- Organization creation takes ~30 minutes, so it's run once via `test:v1:live:organization:create`
- Organization tests are in `organization/` subdirectory:
  - `organization-create.live.spec.js` - Creates V1 organization, saves UID to state file
  - `organization-delete.live.spec.js` - Deletes organization, clears state file
- Use state file (`tests/v2/.organization-state.json`) to track created org UIDs
- The state file stores `v1OrgUid` separately from `v2OrgUid`, so V1 and V2 can use the same file
- Data tests assume organizations already exist (from previous `organization:create` run)

### Staging
- Test GET with pagination
- Test commit with different parameters
- Test retry functionality
- Test cleanup



## Instructions for AI Agent

When implementing this plan:

1. **Start with Helpers**: Adapt V2 helper files first, as all tests depend on them
   - Test helpers independently if possible
   - Verify V1 endpoint paths and response formats

2. **Create Test Data Generators**:
   - Reference `docs/cadt_rpc_api.md` for field requirements
   - Use examples from documentation as templates
   - Ensure picklist values are valid

3. **Create Test Files in Dependency Order**:
   - Start with organizations (no dependencies)
   - Then projects (needs organization)
   - Then units, issuances, labels (need projects)
   - Then staging, audit

4. **Test Incrementally**:
   - Test one endpoint at a time
   - Verify against running V1 API
   - Fix issues before moving to next endpoint

5. **Follow V2 Patterns**:
   - Use same test structure (Step 3, 4, 5, 6, 7, 9)
   - Use same helper function names
   - Use same error handling patterns
   - Use same logging patterns

6. **Handle V1 Differences**:
   - Account for different response formats
   - Account for different field names
   - Account for different ID formats (warehouseProjectId vs UUID)
   - Account for staging UUID vs record ID

7. **Document Deviations**:
   - If V1 behavior differs significantly from V2, document it
   - Add comments explaining V1-specific logic

## Resolved Questions

1. **Health Check Endpoint**: V1 does NOT have a `/v1/health` endpoint. Use `/v1/organizations` as health check instead.
2. **Organization State File**: V1 should use the same state file as V2 (`tests/v2/.organization-state.json`). The state file stores both `v1OrgUid` and `v2OrgUid` separately, so they can coexist. The file is located at the root of the tests directory (not in v2 subdirectory) and is used to persist organization UIDs between test runs since organization creation takes ~30 minutes.
3. **Governance Tests**: Governance endpoints are NOT included in this test suite.
4. **Filestore Tests**: Filestore endpoints are NOT included in this test suite.
5. **Offer Tests**: Offer endpoints are NOT included in this test suite.
6. **XLSX Features**: XLSX upload/update features (`PUT /v1/projects/xlsx`, `PUT /v1/units/xlsx`) and XLSX export features (`xls` query parameter) are NOT tested.

## Success Criteria

Tests are complete when:

1. All V1 endpoints with POST/PUT/DELETE operations have corresponding test files (projects, units, staging)
2. All test files follow the standard structure (Step 3, 4, 5, 6, 7, 9)
3. `npm run test:v1:live:data:short` runs successfully
4. `npm run test:v1:live:data:extended` runs successfully
5. All tests can run against a live V1 API instance
6. Tests clean up after themselves (or document cleanup process)
7. Test output is clear and follows V2 logging patterns
