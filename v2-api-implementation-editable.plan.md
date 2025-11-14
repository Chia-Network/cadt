# V2 API Iterative Development Plan

## Current Progress Status ✅

**COMPLETED PHASES:**
- ✅ **Phase 1**: Infrastructure Setup (Database, Models, Testing)
- ✅ **Phase 2**: Core System Models (All system tables implemented)
- ✅ **Phase 3**: Methodology Endpoint (Complete with validations and tests)
- ✅ **Phase 4**: Program Endpoint (Complete with validations and tests)
- ✅ **Phase 5**: Project Endpoint (Complete with validations and tests)
- ✅ **Phase 6**: Validation Endpoint (Complete with validations and tests)
- ✅ **Phase 7**: Verification Endpoint (Complete with validations and tests)
- ✅ **Phase 8**: Issuance Endpoint (Complete with validations and tests)
- ✅ **Phase 9**: Unit Endpoint (Complete with validations and tests)
- ✅ **Phase 10**: Location Endpoint (Complete with validations and tests)
- ✅ **Phase 11**: Estimation, Rating, Co-Benefit Endpoints (All Tier 1 dependencies)
- ✅ **Phase 12**: Project-Methodology, Stakeholder, Stakeholder-Projects, Label, Unit-Label Endpoints (All Tier 4 join tables)
- ✅ **Phase 13**: AEF Endpoints (All Tier 5 AEF tables)
- ✅ **Phase 14**: Governance Endpoint (System table with full CRUD operations)
- ✅ **Phase 15**: Datalayer Sync Integration (Complete with staging operations, changelist generation, commit functionality, and performance monitoring)

**CURRENT STATUS:** ✅ ALL API ENDPOINTS COMPLETED - V2 API is fully implemented with 22 endpoints (21 data endpoints + 1 governance system endpoint). ✅ Datalayer sync integration complete - V2 can commit staged records to Chia datalayer.

**COMPLETED ENDPOINTS (22 total):**
- Core: Methodology, Program, Project, Validation, Verification, Issuance, Unit, Location (8 endpoints)
- Tier 1: Estimation, Rating, Co-Benefit (3 endpoints)
- Tier 4: Project-Methodology, Stakeholder, Stakeholder-Projects, Label, Unit-Label (5 endpoints)
- Tier 5: AEF-T1-Submission, AEF-T5-Authorized-Entities, AEF-T2-Authorizations, AEF-T3-Actions, AEF-T4-Holdings (5 endpoints)
- System: Governance (1 endpoint)

**KEY ACHIEVEMENTS:**
- ✅ V2-only smoke test created and passing (14/14 tests)
- ✅ All system models implemented and working (21 data models + governance model)
- ✅ All 22 API endpoints fully implemented with CRUD operations (21 data endpoints + 1 governance system endpoint)
- ✅ V1/V2 isolation maintained
- ✅ Snake_case database naming convention enforced
- ✅ Real picklist values integrated from governance CSV data
- ✅ Comprehensive test utilities for picklist validation
- ✅ UUID deprecation warnings fixed for V2
- ✅ Foreign key validation working (checks both main table and staging)
- ✅ All infrastructure verified and working
- ✅ Datalayer sync integration complete - staging operations, changelist generation, commit functionality, and performance monitoring all implemented
- ✅ All 21 data models have `generateChangeListFromStagedData()` methods implemented
- ✅ Performance optimizations: batch database queries, centralized metadata fetching, early exit for empty models
- ✅ Comprehensive staging test suite (38+ test cases covering all scenarios)

## Development Philosophy

Build incrementally with continuous validation. For each endpoint:

1. Implement minimal viable endpoint (no validations)
2. Add basic tests to verify it works
3. **STOP - User verifies tests pass**
4. Add validations progressively
5. Add validation tests
6. **STOP - User verifies tests pass**
7. Move to next endpoint

**Critical**: At every checkpoint or validation step, STOP and wait for user confirmation that tests pass before proceeding to the next task.

## Reference Documentsv

- **Schema**: `v2-schema.dat` (DBML format) - authoritative database schema
- **Reference Implementation**: `v2-plan.md` - detailed technical specifications
- **V1 Code**: Existing V1 endpoints and tests - primary pattern guide

## Key Design Principles

### Database vs API Naming

- **Database**: snake_case (`cad_trust_project_id`, `created_at`)
  - **CRITICAL**: ALL V2 database columns use snake_case - this includes BOTH system tables AND data tables
  - System table columns: `org_uid`, `meta_key`, `meta_value`, `created_at`, `updated_at`, etc.
  - V1 system tables use camelCase (e.g., `orgUid`, `metaKey`) but V2 must use snake_case
  - Example: V1 `orgUid` → V2 `org_uid`, V1 `metaKey` → V2 `meta_key`
- **API**: camelCase (`cadTrustProjectId`, `orgUid`, `createdAt`)
- **Models**: snake_case attributes matching database directly

### Foreign Keys

- Application-level validation (no DB constraints)
- Check both main table AND staging table for references
- Enables staging multiple related records before commit

### Primary Keys

- **Data tables**: UUID v4 (varchar(36))
- **System tables**: INTEGER AUTO_INCREMENT

### Timestamps

- Automatically managed by Sequelize (`created_at`, `updated_at`)
- NOT included in validation schemas
- Rejected if provided in POST/PUT requests
- **CRITICAL**: `createdAt` and `updatedAt` should NOT be required fields in model definitions when using `timestamps: true`
- Sequelize automatically creates these fields when `timestamps: true` is set
- Model type definitions should exclude these fields to avoid conflicts

### API Request Patterns (CRITICAL - Follows V1)

- **Update Requests**: MUST include ALL fields, not just the ones being updated
- **Create Requests**: Include all required fields
- **Validation**: Same validation schema used for both CREATE and UPDATE operations
- **Rationale**: Maintains consistency with V1 behavior and ensures complete data integrity

## Phase 1: Infrastructure Setup

### 1.1 Database Configuration

- [x] Verify/create V2 database directory structure (`~/.chia/mainnet/cadt/v2/`)
- [x] Create database configuration for V2 (separate from V1)
- [x] Set up migration runner for V2

**Checkpoint 1.1**: Verify database config

```bash
# Start server briefly to trigger database initialization
npm start
# Check if V2 database file was created
ls -la ~/.chia/mainnet/cadt/v2/data.sqlite3
# Kill server
```

**STOP HERE - User verifies database created**

### 1.2 Create System Tables

Create 6 system table migrations in `src/database/v2/migrations/`:

1. **staging** - staging operations
2. **audit** - audit trail
3. **organizations** - organization registry
4. **meta** - metadata storage
5. **governance** - governance data
6. **simulator** - simulator mode support

**Checkpoint 1.2**: Verify migrations and schema

```bash
# Start server to run migrations
npm start
# Connect to database and check tables exist
sqlite3 ~/.chia/mainnet/cadt/v2/data.sqlite3 ".tables"
# Should see: staging, audit, organizations, meta, governance, simulator
# Check schema of one table
sqlite3 ~/.chia/mainnet/cadt/v2/data.sqlite3 ".schema staging"
# Verify columns match expectations
# Kill server
```

**STOP HERE - User verifies tables created with correct schema**

### 1.3 Directory Structure

- [x] Create `src/models/v2/` directory
- [x] Create `src/validations/v2/` directory
- [x] Create `src/controllers/v2/` directory
- [x] Create `src/routes/v2/` directory
- [x] Create `tests/v2/` directory structure

**Checkpoint 1.3**: Verify directory structure

```bash
# Verify all directories exist
ls -la src/models/v2/
ls -la src/validations/v2/
ls -la src/controllers/v2/
ls -la src/routes/v2/
ls -la tests/v2/
```

**STOP HERE - User verifies directories created**

### 1.4 Testing Infrastructure

- [x] Set up V2 test configuration (mimic V1)
- [x] Create test utilities and helpers
- [x] Create test fixtures for system tables
- [x] Create a minimal smoke test
- [x] Create isolated V2-only smoke test (avoids V1/V2 conflicts)

**Checkpoint 1.4**: Run V2-only smoke test

```bash
# Run the isolated V2-only smoke test (no server needed, no V1 conflicts)
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/smoke-v2-only.spec.js --reporter spec --exit --timeout 300000

# Should see: "14 passing" - all V2 infrastructure tests pass
# Tests include: database connection, system tables, models loading, CRUD operations, snake_case validation, V1/V2 isolation
```

**Alternative**: Run original smoke test (requires server, may have V1 conflicts)
```bash
# Start server
npm start
# Run the original smoke test (may conflict with V1 tests)
npm test -- tests/v2/smoke.spec.js
# Kill server
```

**STOP HERE - User verifies V2-only smoke test passes**

## Phase 2: Core System Models

Build models for system tables (needed by all endpoints):

### 2.1 System Table Models

- [x] `staging-v2.modeltypes.cjs` + `staging-v2.model.js`
- [x] `organizations-v2.modeltypes.cjs` + `organizations-v2.model.js`
- [x] `meta-v2.modeltypes.cjs` + `meta-v2.model.js`
- [x] `governance-v2.modeltypes.cjs` + `governance-v2.model.js`
- [x] `audit-v2.modeltypes.cjs` + `audit-v2.model.js` + mirror
- [x] `simulator-v2.modeltypes.cjs` + `simulator-v2.model.js`
- [x] Export all from `src/models/v2/index.js`

**Checkpoint 2.1**: Verify models load

```bash
# Run V2-only smoke test to verify models load correctly
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/smoke-v2-only.spec.js --reporter spec --exit --timeout 300000

# Should see "V2 Models Loading" tests pass - confirms all system models load without errors
```

**STOP HERE - User verifies models initialize without errors**

### 2.2 Utility Functions

- [x] Create `src/utils/v2-data-assertions.js`
- [x] Implement `assertRecordExistanceOrStaged()` for FK validation
- [x] Test utility functions

**Checkpoint 2.2**: Test utility functions

```bash
# Run utility tests
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/v2-data-assertions.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies utility tests pass**

## Phase 3: First Endpoint - Methodology (Simplest, No Dependencies)

Methodology has no foreign key dependencies and simple structure - ideal first endpoint.

### 3.1 Methodology Schema & Migration

- [x] Review methodology fields in `v2-schema.dat`
- [x] Create methodology migration
- [x] Run migration, verify table created

**Checkpoint 3.1**: Verify methodology table

```bash
# Run V2-only smoke test to verify methodology table exists
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/smoke-v2-only.spec.js --reporter spec --exit --timeout 300000

# Should see methodology table in "V2 System Tables" test
```

**STOP HERE - User verifies methodology table created correctly**

### 3.2 Methodology Model

- [x] Create `methodology-v2.modeltypes.cjs`
- [x] Create `methodology-v2.model.js`
- [x] Create `methodology-v2.model.mirror.js`
- [x] Update model index exports

**Checkpoint 3.2**: Verify model loads

```bash
# Run V2-only smoke test to verify methodology model loads
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/smoke-v2-only.spec.js --reporter spec --exit --timeout 300000

# Should see "should load V2 methodology model" test pass
```

**STOP HERE - User verifies model loads without errors**

### 3.3 Minimal Methodology Endpoint (No Validations)

- [x] Create basic validation schema (all fields optional)
- [x] Create methodology controller (or use generic factory)
- [x] Create methodology routes
- [x] Mount routes in V2 router

**Checkpoint 3.3**: Test endpoint exists

```bash
# Test methodology endpoint directly
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/methodology-v2.spec.js --reporter spec --exit --timeout 300000

# Should see basic CRUD tests pass (POST, GET, PUT, DELETE)
```

**STOP HERE - User verifies endpoint responds**

### 3.4 Basic Methodology Tests

- [x] Test POST /v2/methodology (create)
- [x] Test GET /v2/methodology (list)
- [x] Test GET /v2/methodology/:id (get one)
- [x] Test PUT /v2/methodology/:id (update)
- [x] Test DELETE /v2/methodology/:id (delete)

**Checkpoint 3.4**: Run CRUD tests

```bash
# Run ONLY V2 methodology tests (not all V1 tests)
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/methodology-v2.spec.js --reporter spec --exit --timeout 300000

# Should see all basic CRUD tests pass
```

**STOP HERE - User verifies all basic CRUD tests pass**

### 3.5 Add Methodology Validations

- [x] Add required field validations
- [x] Add picklist validation for `methodology_type`
- [x] Add field type validations
- [x] Test validation errors

**Checkpoint 3.5**: Run validation tests

```bash
# Run ONLY V2 methodology tests (not all V1 tests)
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/methodology-v2.spec.js --reporter spec --exit --timeout 300000

# Should see all validation tests pass (required fields, picklist validation, field types)
```

**STOP HERE - User verifies all validation tests pass**

## Phase 4: Second Endpoint - Program (Simple, Independent)

Program table is independent (no FK dependencies from other data tables).

### 4.1 Program Schema & Migration

- [x] Review program fields in `v2-schema.dat`
- [x] Create program migration
- [x] Run migration

**STOP - User verifies program table created**

### 4.2 Program Model

- [x] Create model types
- [x] Create model and mirror
- [x] Update exports

**STOP - User verifies model loads**

### 4.3 Program Endpoint + Tests

- [x] Create minimal validation
- [x] Create controller/routes
- [x] Write basic CRUD tests
- [x] Verify tests pass

**STOP - User verifies CRUD tests pass**

### 4.4 Program Validations + Tests

- [x] Add required fields
- [x] Add validation tests
- [x] Verify all tests pass

**STOP - User verifies validation tests pass**

## Phase 5: Third Endpoint - Project (Core Entity)

Project is central to the schema. Build it before dependent tables.

### 5.1 Project Schema & Migration

- [x] Review project fields in `v2-schema.dat`
- [x] Note FK to program table
- [x] Create project migration
- [x] Run migration

**STOP - User verifies project table created**

### 5.2 Project Model

- [x] Create model types
- [x] Create model and mirror
- [x] Set up associations (belongsTo Program)
- [x] Update exports

**STOP - User verifies model loads with associations**

### 5.3 Project Endpoint + Tests

- [x] Create minimal validation
- [x] Create controller/routes
- [x] Write basic CRUD tests (with valid program FK)
- [x] Test FK validation (invalid program should fail)
- [x] Verify tests pass

**STOP - User verifies CRUD and FK tests pass**

### 5.4 Project Validations + Tests

- [x] Add required fields validation
- [x] Add picklist validations (sector, type, status, unit_metric)
- [x] Add validation tests
- [x] Verify all tests pass

**STOP - User verifies validation tests pass**

## Phase 6: Fourth Endpoint - Validation (Depends on Project)

Validation depends on Project and has picklist validations.

### 6.1 Validation Schema & Migration

- [x] Review validation fields in `v2-schema.dat`
- [x] Note FK to project table
- [x] Create validation migration
- [x] Run migration

**STOP - User verifies validation table created**

### 6.2 Validation Model

- [x] Create model types
- [x] Create model and mirror
- [x] Set up associations (belongsTo Project)
- [x] Update exports

**STOP - User verifies model loads with associations**

### 6.3 Validation Endpoint + Tests

- [x] Create minimal validation
- [x] Create controller/routes
- [x] Write basic CRUD tests (with valid project FK)
- [x] Test FK validation (invalid project should fail)
- [x] Verify tests pass

**STOP - User verifies CRUD and FK tests pass**

### 6.4 Validation Validations + Tests

- [x] Add required fields validation
- [x] Add picklist validations (type, body)
- [x] Add validation tests
- [x] Verify all tests pass

**STOP - User verifies validation tests pass**

## Phase 7: Fifth Endpoint - Verification (Depends on Project and Validation)

Verification depends on both Project and Validation and has picklist validations.

### 7.1 Verification Schema & Migration

- [x] Review verification fields in `v2-schema.dat`
- [x] Note FK to project and validation tables
- [x] Create verification migration
- [x] Run migration

**STOP - User verifies verification table created**

### 7.2 Verification Model

- [x] Create model types
- [x] Create model and mirror
- [x] Set up associations (belongsTo Project and Validation)
- [x] Update exports

**STOP - User verifies model loads with associations**

### 7.3 Verification Endpoint + Tests

- [x] Create minimal validation
- [x] Create controller/routes
- [x] Write basic CRUD tests (with valid project and validation FKs)
- [x] Test FK validation (invalid project/validation should fail)
- [x] Verify tests pass

**STOP - User verifies CRUD and FK tests pass**

### 7.4 Verification Validations + Tests

- [x] Add required fields validation
- [x] Add picklist validations (body)
- [x] Add validation tests
- [x] Verify all tests pass

**STOP - User verifies validation tests pass**

## Phase 8: Sixth Endpoint - Issuance (Depends on Verification, Methodology, and Location)

Issuance depends on Verification, Methodology, and Location and has multiple foreign key validations.

### 8.1 Issuance Schema & Migration

- [x] Review issuance fields in `v2-schema.dat`
- [x] Note FK to verification, methodology, and location tables
- [x] Create issuance migration
- [x] Run migration

**STOP - User verifies issuance table created**

### 8.2 Issuance Model

- [x] Create model types
- [x] Create model and mirror
- [x] Set up associations (belongsTo Verification and Methodology)
- [x] Update exports

**STOP - User verifies model loads with associations**

### 8.3 Issuance Endpoint + Tests

- [x] Create minimal validation
- [x] Create controller/routes
- [x] Write basic CRUD tests (with valid verification and methodology FKs)
- [x] Test FK validation (invalid verification/methodology should fail)
- [x] Verify tests pass

**STOP - User verifies CRUD and FK tests pass**

### 8.4 Issuance Validations + Tests

- [x] Add required fields validation
- [x] Add validation tests
- [x] Verify all tests pass

**STOP - User verifies validation tests pass**

## Phase 10: Seventh Endpoint - Location (Depends on Project)

Location depends on Project and has geographic data fields.

### 10.1 Location Schema & Migration

- [x] Review location fields in `v2-schema.dat`
- [x] Note FK to project table
- [x] Create location migration
- [x] Run migration

**STOP - User verifies location table created**

### 10.2 Location Model

- [x] Create model types
- [x] Create model and mirror
- [x] Set up associations (belongsTo Project)
- [x] Update exports

**STOP - User verifies model loads with associations**

### 10.3 Location Endpoint + Tests

- [x] Create minimal validation
- [x] Create controller/routes
- [x] Write basic CRUD tests (with valid project FK)
- [x] Test FK validation (invalid project should fail)
- [x] Verify tests pass

**STOP - User verifies CRUD and FK tests pass**

### 10.4 Location Validations + Tests

- [x] Add required fields validation
- [x] Add validation tests
- [x] Verify all tests pass

**STOP - User verifies validation tests pass**

Follow the same pattern for each remaining endpoint with STOP points after each checkpoint.

### Suggested Order (by dependencies):

**Tier 1 - Direct Project Dependencies:**

- [ ] Validation (depends on: project)
- [ ] Verification (depends on: project, validation)
- [ ] Location (depends on: project)
- [ ] Estimation (depends on: project)
- [ ] Rating (depends on: project)
- [ ] Co-Benefit (depends on: project)

**Tier 2 - Verification Dependencies:**

- [ ] Issuance (depends on: verification, methodology, location)

**Tier 3 - Issuance Dependencies:**

- [ ] Unit (depends on: issuance)

**Tier 4 - Join Tables:**

- [ ] Project-Methodology (depends on: project, methodology)
- [ ] Stakeholder (independent)
- [ ] Stakeholder-Projects (depends on: stakeholder, project)
- [ ] Label (independent)
- [ ] Unit-Label (depends on: label, unit)

**Tier 5 - AEF Tables:**

- [ ] AEF-T1-Submission (independent)
- [ ] AEF-T5-Authorized-Entities (depends on: t1, unit, project, t2)
- [ ] AEF-T2-Authorizations (depends on: t1, unit, project, t5)
- [ ] AEF-T3-Actions (depends on: t1, unit, project, t2)
- [ ] AEF-T4-Holdings (depends on: t1, unit, project, t2)

## Phase 14: Governance Endpoint (System Table - Post-Data-Endpoints) ✅

Governance manages picklists, org lists, and glossary data. V2 needs its own governance functionality that works independently of V1.

### Critical Version Detection Issue

**PROBLEM**: Both V1 and V2 code use `getDataModelVersion()` which reads from `package.json.version`. When V1 and V2 run simultaneously, this returns the wrong version (whichever matches package.json).

**SOLUTION**:
- **V1 code must hardcode `'v1'`** instead of calling `getDataModelVersion()`
- **V2 code must hardcode `'v2'`** instead of calling `getDataModelVersion()`
- Both versions should NEVER use `getDataModelVersion()` for business logic or version-specific operations

### 14.0 Update V1 Code to Hardcode 'v1' (PREREQUISITE) ✅

Before implementing V2 governance, we must update V1 code to hardcode 'v1' to prevent version conflicts.

**Files to Update**:

1. **`src/models/governance/governance.model.js`** (2 places): ✅
   - Line 27: Change `getDataModelVersion()` to `'v1'` ✅
   - Line 174: Change `getDataModelVersion()` to `'v1'` ✅

2. **`src/models/organizations/organizations.model.js`** (1 place):
   - Line 506: Change `getDataModelVersion()` to `'v1'` ✅ (No usage found - already using hardcoded values)

3. **`src/controllers/organization.controller.js`** (3 places):
   - Line 110: Change `getDataModelVersion()` to `'v1'` ✅ (No usage found - already using hardcoded values)
   - Line 145: Change `getDataModelVersion()` to `'v1'` ✅ (No usage found - already using hardcoded values)
   - Line 318: Change `getDataModelVersion()` to `'v1'` ✅ (No usage found - already using hardcoded values)

4. **`src/config/config.js`** (1 place):
   - Line 8: Change `getDataModelVersion()` to `'v1'` for V1 persistence folder ✅ (No usage found - already using hardcoded values)

5. **`src/config/logger.js`** (1 place):
   - Line 32: Change `getDataModelVersion()` to `'v1'` for V1 log directory ✅ (No usage found - already using hardcoded values)

6. **`src/utils/config-loader.js`** (1 place):
   - Line 49: Change `getDataModelVersion()` to `'v1'` for V1 config file path ✅ (No usage found - already using hardcoded values)

**Note**: `getDataModelVersion()` function may be kept in helpers.js for backward compatibility or removed if no longer needed, but should not be used for version-specific logic.

**Checkpoint 14.0**: Verify V1 tests still pass after changes

```bash
# Run V1 tests to ensure nothing broke
npm test -- tests/integration/governance.spec.js
npm test -- tests/integration/organization.spec.js
```

**STOP HERE - User verifies V1 tests pass before proceeding**

### 14.1 V2-Specific Assertions ✅

Create V2 versions of governance assertions in `src/utils/v2-data-assertions.js`:

- `assertCanBeGovernanceBodyV2()`: Check IS_GOVERNANCE_BODY config ✅
- `assertIsActiveGovernanceBodyV2()`: Check MetaV2 for 'governanceBodyId' ✅

**CRITICAL**: Use MetaV2 model, not Meta ✅

**Checkpoint 14.1**: Test assertions work

```bash
# Test assertions can be imported and called
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/v2-data-assertions.spec.js --reporter spec --exit --timeout 300000 --grep "governance"
```

**STOP HERE - User verifies assertions work**

### 14.2 Basic Model Method: upsertGovernanceDownload ✅

**Reference**: V1 governance model is in `src/models/governance/governance.model.js`

Add `upsertGovernanceDownload()` method to `src/models/v2/governance-v2.model.js`:

- Parse governanceData for orgList, glossary, pickList ✅
- Upsert records into GovernanceV2 with confirmed=true ✅
- Handle simulator/dev mode fallback (use stub picklist if needed) ✅
- **CRITICAL**: Use GovernanceV2 model, not Governance ✅

**Checkpoint 14.2**: Test upsertGovernanceDownload method

```bash
# Write and run tests for upsertGovernanceDownload
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/governance-v2.spec.js --reporter spec --exit --timeout 300000 --grep "upsertGovernanceDownload"
```

**STOP HERE - User verifies upsertGovernanceDownload works**

### 14.3 Basic Controller: Read Endpoints ✅

Create `src/controllers/v2/governance-v2.controller.js` with basic read methods:

1. **`findAll`**: Get all GovernanceV2 records ✅
2. **`isCreated`**: Check if governance body exists (query MetaV2 for 'governanceBodyId') ✅
3. **`findOrgList`**: Get orgList from GovernanceV2, parse JSON ✅
4. **`findGlossary`**: Get glossary from GovernanceV2, parse JSON (use stub in dev mode) ✅
5. **`findPickList`**: Get pickList from GovernanceV2, parse JSON (use stub in dev mode) ✅

**CRITICAL**: All methods must use V2 models (GovernanceV2, MetaV2) ✅

**Checkpoint 14.3**: Test read endpoints

```bash
# Write and run tests for read endpoints
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/governance-v2.spec.js --reporter spec --exit --timeout 300000 --grep "GET|findAll|isCreated|findOrgList|findGlossary|findPickList"
```

**STOP HERE - User verifies read endpoints work**

### 14.4 Basic Routes: Read Endpoints ✅

Create `src/routes/v2/resources/governance-v2.js` with read routes:

- `GET /v2/governance` - findAll ✅
- `GET /v2/governance/exists` - isCreated ✅
- `GET /v2/governance/meta/orgList` - findOrgList ✅
- `GET /v2/governance/meta/pickList` - findPickList ✅
- `GET /v2/governance/meta/glossary` - findGlossary ✅

Mount in `src/routes/v2/index.js`: ✅
```javascript
import { GovernanceV2Router } from './resources/governance-v2.js';
V2Router.use('/governance', GovernanceV2Router);
```

**Checkpoint 14.4**: Test routes respond

```bash
# Test routes via HTTP (start server, make requests, or use integration tests)
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/governance-v2.spec.js --reporter spec --exit --timeout 300000 --grep "route|GET"
```

**STOP HERE - User verifies routes work**

### 14.5 Model Method: createGoveranceBody ✅

Add `createGoveranceBody()` method to `src/models/v2/governance-v2.model.js`:

- Check if GOVERNANCE_BODY_ID is set (throw error if already listening to another governance body) ✅
- **Check if this node is already a V1 governance body** (check Meta for 'mainGoveranceBodyId'): ✅
  - **If YES**: Call `addV2ToExistingGovernanceBody()` instead (see Phase 14.5a) and return ✅
  - **If NO**: Proceed with creating new governance body from scratch below ✅
- Create two datalayer stores: main governance body and version-specific store ✅
- **CRITICAL**: Use hardcoded `'v2'` as the version key (NOT `getDataModelVersion()`) ✅
- Sync datalayer with version mapping: `{ v2: governanceVersionId }` ✅
- Store IDs in MetaV2 (meta_key: 'governanceBodyId' and 'mainGoveranceBodyId') ✅
- Handle simulator mode (skip confirmation wait) ✅
- **CRITICAL**: Use MetaV2 model, not Meta ✅

**Checkpoint 14.5**: Test createGoveranceBody method

```bash
# Write and run tests for createGoveranceBody
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/governance-v2.spec.js --reporter spec --exit --timeout 300000 --grep "createGoveranceBody"
```

**STOP HERE - User verifies createGoveranceBody works**

### 14.5a Model Method: addV2ToExistingGovernanceBody (NEW) ✅

Add `addV2ToExistingGovernanceBody()` method to `src/models/v2/governance-v2.model.js`:

This method allows an existing V1 governance node to add V2 support without creating a new governance body.

- Get existing main governance body ID from Meta (meta_key: 'mainGoveranceBodyId') ✅
  - **CRITICAL**: Use Meta model (V1), not MetaV2, since this is the shared main governance body ✅
- Get current version mapping from main governance body store via `datalayer.getSubscribedStoreData()` ✅
- Verify V2 doesn't already exist in mapping (throw error if it does) ✅
- Create new V2-specific governance store via `datalayer.createDataLayerStore()` ✅
- Update main governance body store's version mapping to add V2: ✅
  - Use `datalayer.upsertDataLayer()` or `pushDataLayerChangeList()` to update the mapping ✅
  - Add `v2: governanceVersionId` to existing mapping (preserve existing v1 entry) ✅
  - Result: `{ v1: existingStoreId, v2: newV2StoreId }` ✅
- Store V2 governanceBodyId in MetaV2 (meta_key: 'governanceBodyId') ✅
- **CRITICAL**: Preserve existing V1 governance functionality - this only adds V2 ✅
- Handle simulator mode (skip confirmation wait) ✅
- **CRITICAL**: Use hardcoded `'v2'` string, not `getDataModelVersion()` ✅

**Reference**: Look at `datalayer.upsertDataLayer()` in `src/datalayer/writeService.js` for pattern on updating store data

**Checkpoint 14.5a**: Test addV2ToExistingGovernanceBody method

```bash
# Write and run tests for addV2ToExistingGovernanceBody
# Test scenarios:
# 1. Successfully add V2 to existing V1 governance body
# 2. Error if V2 already exists
# 3. Error if no existing governance body found
# 4. Verify V1 mapping is preserved
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/governance-v2.spec.js --reporter spec --exit --timeout 300000 --grep "addV2ToExistingGovernanceBody"
```

**STOP HERE - User verifies addV2ToExistingGovernanceBody works**

### 14.6 Controller: createGoveranceBody Endpoint ✅

Add `createGoveranceBody` method to `src/controllers/v2/governance-v2.controller.js`:

- Call GovernanceV2.createGoveranceBody() ✅
- Use V2 assertions (`assertCanBeGovernanceBodyV2`, etc.) ✅

Add route: `POST /v2/governance` - createGoveranceBody ✅

**Checkpoint 14.6**: Test createGoveranceBody endpoint

```bash
# Test createGoveranceBody endpoint
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/governance-v2.spec.js --reporter spec --exit --timeout 300000 --grep "POST.*createGoveranceBody|create governance"
```

**STOP HERE - User verifies createGoveranceBody endpoint works**

### 14.7 Model Method: updateGoveranceBodyData ✅

Add `updateGoveranceBodyData(keyValueArray)` method to `src/models/v2/governance-v2.model.js`:

- Find governanceBodyId from MetaV2 (meta_key: 'governanceBodyId') ✅
- Get existing GovernanceV2 records ✅
- Create changelist using `keyValueToChangeList()` utility ✅
- Upsert records with confirmed=false ✅
- Push changelist to datalayer ✅
- Set up onConfirm callback to mark records as confirmed=true ✅
- Set up rollback callback to restore previous records ✅
- **CRITICAL**: Use MetaV2 and GovernanceV2 models, not Meta and Governance ✅

**Checkpoint 14.7**: Test updateGoveranceBodyData method

```bash
# Write and run tests for updateGoveranceBodyData
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/governance-v2.spec.js --reporter spec --exit --timeout 300000 --grep "updateGoveranceBodyData"
```

**STOP HERE - User verifies updateGoveranceBodyData works**

### 14.8 Controller: Update Endpoints ✅

Add update methods to `src/controllers/v2/governance-v2.controller.js`:

- **`setDefaultOrgList`**: Update orgList via GovernanceV2.updateGoveranceBodyData() ✅
- **`setPickList`**: Update pickList via GovernanceV2.updateGoveranceBodyData() ✅
- **`setGlossary`**: Update glossary via GovernanceV2.updateGoveranceBodyData() ✅

Add routes: ✅
- `POST /v2/governance/meta/orgList` - setDefaultOrgList (with validation) ✅
- `POST /v2/governance/meta/pickList` - setPickList (with validation) ✅
- `POST /v2/governance/meta/glossary` - setGlossary ✅

**Checkpoint 14.8**: Test update endpoints

```bash
# Test update endpoints
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/governance-v2.spec.js --reporter spec --exit --timeout 300000 --grep "setDefaultOrgList|setPickList|setGlossary|POST.*meta"
```

**STOP HERE - User verifies update endpoints work**

### 14.9 Model Method: sync ✅

Add `sync(retryCounter = 0)` method to `src/models/v2/governance-v2.model.js`:

- Get GOVERNANCE_BODY_ID from config ✅
- Handle simulator/dev mode (use stub picklist and return early) ✅
- Get governance data from datalayer via `datalayer.getSubscribedStoreData()` ✅
- Check for legacy (non-versioned) governance data ✅
- **CRITICAL**: Hardcode `'v2'` when checking `governanceData['v2']` (NOT `getDataModelVersion()`) ✅
- Call `upsertGovernanceDownload()` with version-specific data ✅
- Implement retry logic (max 50 retries with 5 second delays) ✅

**Checkpoint 14.9**: Test sync method

```bash
# Write and run tests for sync method
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/governance-v2.spec.js --reporter spec --exit --timeout 300000 --grep "sync"
```

**STOP HERE - User verifies sync works**

### 14.10 Controller: sync Endpoint ✅

Add `sync` method to `src/controllers/v2/governance-v2.controller.js`:

- Call GovernanceV2.sync() ✅

Add route: `GET /v2/governance/sync` - sync ✅

**Checkpoint 14.10**: Test sync endpoint

```bash
# Test sync endpoint
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/governance-v2.spec.js --reporter spec --exit --timeout 300000 --grep "sync.*endpoint|GET.*sync"
```

**STOP HERE - User verifies sync endpoint works**

### 14.11 Integration Tests and Validation ✅

Complete `tests/v2/integration/governance-v2.spec.js` with comprehensive tests:

1. **Version isolation**: Verify V2 governance doesn't interfere with V1 ✅
2. **Version detection**: Verify hardcoded 'v2' is used (not getDataModelVersion()) ✅
3. **End-to-end flows**: Test complete workflows (create → update → sync) ✅
4. **Error handling**: Test error cases and edge cases ✅
5. **Datalayer integration**: Test datalayer operations (if not fully tested above) ✅

**Checkpoint 14.11**: Run all governance tests

```bash
# Run all governance tests
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/governance-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies all governance tests pass**

### 14.12 Key Implementation Notes

**Version Detection (CRITICAL)**:
- V2 code MUST hardcode `'v2'` string
- NEVER call `getDataModelVersion()` in V2 code
- Example: `const dataModelVersion = 'v2';` NOT `const dataModelVersion = getDataModelVersion();`

**Model Usage (CRITICAL)**:
- Use `GovernanceV2` model (not `Governance`)
- Use `MetaV2` model (not `Meta`)
- Use `sequelizeV2` database connection

**Database Fields**:
- V2 uses snake_case: `meta_key`, `meta_value`, `created_at`, `updated_at`
- V1 uses camelCase: `metaKey`, `metaValue` (no timestamps in V1 governance table)

**V1 Compatibility**:
- After Phase 14.0, V1 code will also hardcode `'v1'` instead of using `getDataModelVersion()`
- This ensures V1 and V2 can run simultaneously without version conflicts

**Datalayer Integration**:
- Governance stores are versioned in datalayer
- Main governance body store contains version mappings: `{ v1: storeId1, v2: storeId2 }`
- V2 syncs from the `v2` key in the version mapping

**Intentionally Omitted Features**:
- **`subscribeToGovernanceBody` endpoint** (`POST /v2/governance/subscribe`): This route exists in V1 routes but has no controller implementation in V1 code. Since V1 is frozen and this feature was never implemented, it is intentionally omitted from V2 governance implementation. If this functionality is needed in the future, it would need to be designed and implemented from scratch.

**Upgrading Existing V1 Governance Nodes**:
- **Phase 14.5a** implements `addV2ToExistingGovernanceBody()` which allows an existing V1 governance node to add V2 support
- When an existing V1 governance node calls `POST /v2/governance` to create a governance body, the system will detect the existing V1 governance body and automatically call `addV2ToExistingGovernanceBody()` instead
- This updates the main governance body store's version mapping from `{ v1: storeId }` to `{ v1: storeId1, v2: storeId2 }`
- After upgrade, the node functions as both a V1 and V2 governance node, managing both versions' governance data independently

## Notes

- **V1 is frozen** - bugfixes only, no feature development
- Each checkpoint requires user verification before continuing
- Stop immediately if tests fail - don't accumulate issues
- Update plan as we discover better approaches
- **CRITICAL**: V2 code must never use `getDataModelVersion()` - always hardcode `'v2'` when version is needed
- **CRITICAL**: V1 code must also never use `getDataModelVersion()` - always hardcode `'v1'` when version is needed (see Phase 14.0)

## Testing Commands

**IMPORTANT**: Always run V2 tests individually to avoid V1 test interference:

### V2-Only Smoke Test (Recommended)
```bash
# Run isolated V2-only smoke test (no server needed, no V1 conflicts)
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/smoke-v2-only.spec.js --reporter spec --exit --timeout 300000

# Tests: database connection, system tables, models loading, CRUD operations, snake_case validation, V1/V2 isolation
# Should see: "14 passing" - all V2 infrastructure tests pass
```

### V2 Picklist Integration

**Real Picklist Values**: V2 now uses actual picklist values from governance CSV data instead of test stubs.

**Files Updated:**
- `src/models/governance/governance-v2-real-picklists.js` - Real picklist values parsed from CSV
- `src/utils/v2-data-loaders.js` - Updated to use real picklists in simulator mode
- `tests/v2/utils/v2-picklist-test-helpers.js` - Test utilities for picklist validation

**Available Picklist Fields:**
- `projectSector`, `projectType`, `projectStatus`, `projectUnitMetric`
- `methodologyType`, `validationType`, `validationBody`, `verificationBody`
- `unitType`, `unitStatus`, `unitMetric`
- `locationCountry`, `locationMapType`
- `stakeholderType`, `labelType`, `coBenefitId`, `ratingType`
- `aefT2AuthorizationsMetric`, `aefT2AuthorizationsPurposesForAuthorization`
- `aefT3ActionsType`, `aefT3ActionsMitigationType`

**Testing with Picklists:**
```bash
# All tests now use real picklist values
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/methodology-v2.spec.js --reporter spec --exit --timeout 300000
```

### Individual V2 Test Files
```bash
# Run specific V2 test file
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/methodology-v2.spec.js --reporter spec --exit --timeout 300000

# Run specific test by name
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/methodology-v2.spec.js --reporter spec --exit --timeout 300000 --grep "test name"

# Run all V2 tests
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/ --reporter spec --exit --timeout 300000
```

**DO NOT USE**: `npm test` without specifying V2 test files, as this runs all V1 tests and causes migration conflicts.

## Phase 15: Datalayer Sync Integration (Post-API-Endpoints) ✅ COMPLETE

**Phase Overview**: Implement complete datalayer sync integration for V2, including staging table operations, changelist generation, commit functionality, and performance monitoring.

**STATUS**: ✅ **COMPLETE** - All sub-phases (15.0-15.14) implemented and tested. Datalayer sync is fully operational for V2.

**Key Components**:
- Staging table utilities and model methods
- Shared utility optimizations (batch database queries)
- Model-specific changelist generation (21 data models)
- Central commit orchestration (`pushToDataLayer`)
- **Performance monitoring** (comprehensive metrics, timing, RPC tracking, memory usage)
- Controller endpoints and routes
- Comprehensive integration tests

Datalayer sync enables V2 to commit staged records to the Chia datalayer, making them available to other nodes on the network. This is the final piece to make V2 fully operational for production use.

### Understanding V1 Datalayer Commit Process

**Reference**: V1 implementation in `src/models/staging/staging.model.js` and `src/models/projects/projects.model.js`, `src/models/units/units.model.js`

**The Process**:
1. **Read Staging Table**: Get all unstaged records (`committed=false`) from staging table
2. **Separate by Action**: Group records by INSERT, UPDATE, DELETE actions per table
3. **For Each Model**: Call model's `generateChangeListFromStagedData()` method
   - Extract records for that model from stagedRecords
   - Convert to Excel format (via `createXlsFromSequelizeResults()`)
   - Convert Excel to changelist (via `transformFullXslsToChangeList()`)
   - Handle deleted child records (via `getDeletedItems()`)
   - Return changelist for that model
4. **Merge Changelists**: Combine all model changelists into one unified list
5. **Push to Datalayer**: Send merged changelist via RPC to datalayer
6. **Mark as Committed**: Update staging records to `committed=true`

**What is a Changelist?**
A changelist is an array of objects:
```javascript
[
  {
    action: 'insert',  // or 'delete', 'update'
    key: '0x76616c7565',  // hex-encoded "table|primaryKey" (e.g., "program|abc-123")
    value: '0x7b22636164547275737450726f...'  // hex-encoded JSON record (for insert/update)
  }
]
```

**Key Differences for V2**:
- V2 uses snake_case table names (e.g., `project_methodology`, `unit_label`) - Note: corrected spelling from `project_methodolgy`
- V2 uses different primary key field names (e.g., `cad_trust_project_id` vs `warehouseProjectId`)
- V2 has 21 data models that need `generateChangeListFromStagedData()` (vs 2 in V1)
- V2 staging table uses snake_case: `committed` → `committed` (corrected spelling), `failedCommit` → `failed_commit`

### 15.0 Test Data Generation Utilities (Prerequisite)

Before implementing datalayer sync, we need comprehensive test data generators for all 21 data models. These will be used extensively throughout Phase 15 testing.

**Create `tests/v2/utils/v2-staging-test-data.js`** with comprehensive test data generators:

**Functions to Create**:

1. **Individual Model Generators** (for each of 21 models):
   - `generateV2ProgramData(overrides = {})` - Returns program data object
   - `generateV2MethodologyData(overrides = {})` - Returns methodology data object
   - `generateV2ProjectData(overrides = {})` - Returns project data object
   - `generateV2ValidationData(overrides = {})` - Returns validation data object
   - `generateV2VerificationData(overrides = {})` - Returns verification data object
   - `generateV2IssuanceData(overrides = {})` - Returns issuance data object
   - `generateV2UnitData(overrides = {})` - Returns unit data object
   - `generateV2LocationData(overrides = {})` - Returns location data object
   - `generateV2EstimationData(overrides = {})` - Returns estimation data object
   - `generateV2RatingData(overrides = {})` - Returns rating data object
   - `generateV2CoBenefitData(overrides = {})` - Returns co-benefit data object
   - `generateV2ProjectMethodologyData(overrides = {})` - Returns project-methodology join data
   - `generateV2StakeholderData(overrides = {})` - Returns stakeholder data object
   - `generateV2StakeholderProjectData(overrides = {})` - Returns stakeholder-project join data
   - `generateV2LabelData(overrides = {})` - Returns label data object
   - `generateV2UnitLabelData(overrides = {})` - Returns unit-label join data
   - `generateV2AefT1SubmissionData(overrides = {})` - Returns AEF T1 submission data
   - `generateV2AefT5AuthorizedEntitiesData(overrides = {})` - Returns AEF T5 authorized entities data
   - `generateV2AefT2AuthorizationsData(overrides = {})` - Returns AEF T2 authorizations data
   - `generateV2AefT3ActionsData(overrides = {})` - Returns AEF T3 actions data
   - `generateV2AefT4HoldingsData(overrides = {})` - Returns AEF T4 holdings data

2. **Complete Dataset Generators** (with dependencies):
   - `generateV2CompleteProjectDataset(overrides = {})` - Returns complete project with all child tables:
     - Program, Project, Validation, Verification, Issuance, Methodology, Location, Estimation, Rating, CoBenefit
   - `generateV2CompleteUnitDataset(overrides = {})` - Returns complete unit with all dependencies:
     - Program, Project, Validation, Verification, Issuance, Methodology, Unit, UnitLabel
   - `generateV2CompleteStagingDataset(scenario = 'single')` - Returns staging records for different scenarios:
     - `'single'`: One table with one record
     - `'multiple'`: Multiple tables with one record each
     - `'complex'`: Multiple tables with multiple records and relationships
     - `'all'`: All 21 tables with sample data

3. **Staging Record Generators**:
   - `createV2StagingRecordForModel(modelName, action, data, overrides = {})` - Creates properly formatted staging record
   - `createV2StagingRecordsForDataset(dataset)` - Creates staging records for a complete dataset
   - `generateV2StagingRecordsForCommit(tableNames = [], count = 1)` - Generates staging records ready for commit

**Requirements**:
- All generators use valid picklist values (from governance)
- All generators handle foreign key relationships (provide valid UUIDs or create dependencies)
- All generators use snake_case field names
- All generators provide realistic test data (not just minimum required fields)
- Generators support `overrides` parameter to customize data

**Reference**: V1 test data in `tests/test-data/new-project.js` (but adapt for V2 structure)

**Checkpoint 15.0**: Test data generators work

```bash
# Test data generators can be imported and used
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/staging-v2.spec.js --reporter spec --exit --timeout 300000 --grep "test.*data.*generator"
```

**STOP HERE - User verifies test data generators work**

### 15.1 Staging Model: Core Utility Methods

Add utility methods to `src/models/v2/staging-v2.model.js`:

**Methods to Add**:
1. **`seperateStagingDataIntoActionGroups(stagedData, table)`**: Static method that:
   - Filters stagedData by table name
   - Separates into INSERT, UPDATE, DELETE groups
   - Marks records as `committed=true` during processing
   - Returns `[insertRecords, updateRecords, deleteChangeList]`
   - **CRITICAL**: Use snake_case table names for V2 (e.g., `program`, `project`, `methodology`)
   - **CRITICAL**: For DELETE actions, generate delete changelist items with hex-encoded keys
   - **Note**: V2 table names don't need the "hacky fix" for units/projects (V1 uses `Units`/`Projects`, V2 uses `unit`/`project`)

**Reference**: V1 implementation in `src/models/staging/staging.model.js` lines 415-467

**PERFORMANCE OPTIMIZATION** (Medium Priority #7): Add database indexes on staging table
- Create migration to add indexes on `committed` and `table` columns
- Improves query performance for filtering unstaged records
- **Implementation**: Add to staging table migration or create separate migration file
- **SQL**: `CREATE INDEX idx_staging_committed ON staging(committed);` and `CREATE INDEX idx_staging_table ON staging(table);`
- **When**: Should be done in Phase 15.1 or earlier (before testing begins)

**Checkpoint 15.1**: Test seperateStagingDataIntoActionGroups method and verify indexes

```bash
# Write and run tests for seperateStagingDataIntoActionGroups
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/staging-v2.spec.js --reporter spec --exit --timeout 300000 --grep "seperateStagingDataIntoActionGroups"

# Verify indexes were created (optional check)
sqlite3 ~/.chia/mainnet/cadt/v2/data.sqlite3 "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='staging';"
# Should see: idx_staging_committed, idx_staging_table
```

**STOP HERE - User verifies seperateStagingDataIntoActionGroups works and indexes exist**

### 15.2a Optimize Shared Utility: transformFullXslsToChangeList (Prerequisite)

Before implementing model methods, optimize the shared utility to batch database queries.

**Modify `src/utils/xls.js` - `transformFullXslsToChangeList()` function**:

**File to Modify**: `src/utils/xls.js`
**Function**: `transformFullXslsToChangeList()` (lines 622-704)
**Import Needed**: Add `import { Sequelize } from 'sequelize';` at top of file (line ~11, after existing imports)
**Code Location**: Modify lines 634-692 (inside the `if (sheet) {` block)

**Current Problem** (lines 645-692):
- Calls `findByPk()` individually for each row in nested `Promise.all()` loops
- For 100 records, this makes 100 database queries
- Very slow for large datasets

**Optimization Approach**:
1. For each table/sheet in the `xsls` object:
   - Collect all primary key values from all rows first (before processing)
   - Batch query: `Model.findAll({ where: { [primaryKeyField]: { [Op.in]: primaryKeyValues } } })`
   - Create a `Map<primaryKey, record>` for O(1) lookup
2. Process rows as before, but use Map lookup instead of `findByPk()`
3. Maintain same output format and behavior

**Implementation Details**:

**Current Code Structure** (lines 645-692):
- Outer loop: `_.tail(sheet.data).map(async (row) => {`
- Inner loop: `rows.map(async (r) => {`
- Inside: `let isUpdate = await ModelKeys[key].findByPk(r[primaryKeyIndex])`

**Optimized Code Structure**:

Replace the section inside `if (sheet) {` block (after line 642, before the `Promise.all` at line 645):

```javascript
if (sheet) {
  const headerRow = sheet.data[0];
  const primaryKeyIndex = headerRow.findIndex((item) => {
    return item === primaryKeyNames[key];
  });

  if (!changeList[key]) {
    changeList[key] = [];
  }

  // NEW: Collect all primary keys BEFORE processing rows
  const primaryKeys = new Set();
  if (primaryKeyIndex >= 0 && ['update', 'insert'].includes(action)) {
    _.tail(sheet.data).forEach(row => {
      const rows = checkArrayOfArrays(row) ? row : [row];
      rows.forEach(r => {
        if (r && r[primaryKeyIndex] != null) {
          primaryKeys.add(r[primaryKeyIndex]);
        }
      });
    });
  }

  // NEW: Batch query all existing records at once
  let existingRecordsMap = new Map();
  if (['update', 'insert'].includes(action) && primaryKeys.size > 0) {
    const { Sequelize } = await import('sequelize');
    const existingRecords = await ModelKeys[key].findAll({
      where: {
        [primaryKeyNames[key]]: {
          [Sequelize.Op.in]: Array.from(primaryKeys)
        }
      },
      raw: true
    });

    // Create lookup map: primaryKey -> record
    existingRecordsMap = new Map(
      existingRecords.map(record => [record[primaryKeyNames[key]], record])
    );
  }

  // MODIFIED: Process rows using Map lookup instead of findByPk()
  await Promise.all(
    _.tail(sheet.data).map(async (row) => {
      const rows = checkArrayOfArrays(row) ? row : [row];
      await Promise.all(
        rows.map(async (r) => {
          const dataLayerKey = encodeHex(`${key}|${r[primaryKeyIndex]}`);

          if (['update', 'insert'].includes(action)) {
            // REPLACED: let isUpdate = await ModelKeys[key].findByPk(r[primaryKeyIndex])
            // WITH: Map lookup (O(1) instead of database query)
            const isUpdate = existingRecordsMap.get(r[primaryKeyIndex]);

            if (isUpdate) {
              const alreadyPushed = changeList[key].find(
                (change) =>
                  change.action === 'delete' &&
                  change.key === dataLayerKey,
              );

              if (!alreadyPushed) {
                changeList[key].push({
                  action: 'delete',
                  key: dataLayerKey,
                });
              }
            }
            changeList[key].push({
              action: 'insert',
              key: dataLayerKey,
              value: encodeHex(
                JSON.stringify(_.zipObject(headerRow, r)),
              ),
            });
          } else {
            changeList[key].push({
              action: action,
              key: dataLayerKey,
              value: encodeHex(
                JSON.stringify(_.zipObject(headerRow, r)),
              ),
            });
          }
        }),
      );
    }),
  );
}
```

**Key Changes**:
1. Collect all primary keys BEFORE processing rows (single pass through data)
2. Batch query once per table (not per row)
3. Create Map for O(1) lookups
4. Replace `findByPk()` with `Map.get()`
5. Only batch query for 'insert'/'update' actions (not needed for 'delete')
6. Handle empty primaryKeys set (skip query)
7. Maintain exact same output format and behavior

**Benefits**:
- Reduces N queries to 1 query per table
- Works for both V1 and V2 (backward compatible)
- Maintains exact same functionality
- Significant performance improvement for large commits

**Testing**:
- Verify V1 tests still pass (backward compatibility) - CRITICAL
- Verify optimization works with:
  - Single record commits
  - Multiple records (10, 100, 1000+ records)
  - Empty sheets
  - Mix of INSERT/UPDATE/DELETE actions
  - Multiple tables in same commit
- Performance test: Compare query counts before/after (should see massive reduction)
- Edge cases: null primary keys, missing primary key index, empty primaryKeys set

**Checkpoint 15.2a**: Verify utility optimization works

```bash
# Run V1 tests to ensure backward compatibility (CRITICAL)
npm test -- tests/integration/staging.spec.js

# Run V1 project/unit tests that use transformFullXslsToChangeList
npm test -- tests/integration/project.spec.js
npm test -- tests/integration/unit.spec.js

# Verify no regression in V1 functionality
# All V1 tests should pass with identical behavior
```

**Performance Verification** (optional but recommended):
- Add logging to count database queries before/after optimization
- Test with 100+ records and verify query count reduction
- Compare commit times before/after (should be significantly faster)

**STOP HERE - User verifies shared utility optimization works and all V1 tests pass**

### 15.2 Model Method: generateChangeListFromStagedData - Core Models (Part 1)

Add `generateChangeListFromStagedData(stagedData, comment, author)` method to core V2 models.

**Models to Implement** (in this order):
1. **ProgramV2** - No child tables (simplest)
2. **MethodologyV2** - No child tables
3. **LocationV2** - Belongs to Project (no child tables)

**Method Implementation** (for each model):
1. **PERFORMANCE**: Early exit if no staged records for this model
   - Check if any staged records match this table name
   - Return empty changelist if none found
2. Call `StagingV2.seperateStagingDataIntoActionGroups(stagedData, 'tableName')`
3. Define `primaryKeyMap` for the model (main table + any child tables)
   - For models with no children: `{ tableName: 'primaryKeyField' }`
   - Example: `{ program: 'cad_trust_program_id' }`
4. **PERFORMANCE**: Only call `getDeletedItems()` if UPDATE records exist
   - For UPDATE records: Call `getDeletedItems()` to find deleted child records
   - **Note**: `getDeletedItems()` already batches queries using `Op.in` (V1 implementation is already optimized)
   - **Note**: Models without children skip this step (return empty array)
5. Convert records to Excel format (only if records exist):
   - `createXlsFromSequelizeResults()` for INSERT records (if any)
   - `createXlsFromSequelizeResults()` for UPDATE records (if any)
   - `createXlsFromSequelizeResults()` for DELETE records (if any)
6. Convert Excel to changelist (only if Excel sheets were created):
   - `transformFullXslsToChangeList()` for INSERT (if any)
   - `transformFullXslsToChangeList()` for UPDATE (if any)
   - `transformFullXslsToChangeList()` for DELETE (if any)
   - **Note**: `transformFullXslsToChangeList()` will be optimized in Phase 15.2a to batch database queries
7. **PERFORMANCE**: Use passed-in metadata instead of fetching
   - Use `isUpdateComment` and `isUpdateAuthor` from parameters (not datalayer calls)
   - Use `registryId` from parameters (not `OrganizationsV2.getHomeOrg()`)
8. Return changelist object with structure:
   ```javascript
   {
     tableName: [...insertChangeList, ...updateChangeList, ...deleteChangeList],
     comment: commentChangeList,  // Only from first model that returns it
     author: authorChangeList      // Only from first model that returns it
   }
   ```

**Method Signature Change**:
```javascript
// V1 signature:
static async generateChangeListFromStagedData(stagedData, comment, author)

// V2 signature (with performance optimizations):
static async generateChangeListFromStagedData(stagedData, comment, author, registryId, isUpdateComment, isUpdateAuthor)
```

**CRITICAL Requirements**:
- Use V2 table names (snake_case): `program`, `methodology`, `location`
- Use V2 primary key field names: `cad_trust_program_id`, `cad_trust_methodology_id`, `cad_trust_location_id`
- Use V2 models: `ProgramV2`, `MethodologyV2`, `LocationV2`
- Use `OrganizationsV2.getHomeOrg()` instead of `Organization.getHomeOrg()`
- Use `dataLayer` service (same as V1)

**Reference**: V1 implementation in `src/models/projects/projects.model.js` lines 327-459

**Checkpoint 15.2**: Test generateChangeListFromStagedData for core models

```bash
# Test ProgramV2, MethodologyV2, LocationV2 generateChangeListFromStagedData
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/staging-v2.spec.js --reporter spec --exit --timeout 300000 --grep "generateChangeListFromStagedData.*Program|Methodology|Location"
```

**STOP HERE - User verifies core models work**

### 15.3 Model Method: generateChangeListFromStagedData - Project Model

Add `generateChangeListFromStagedData()` to **ProjectV2** model.

**Special Considerations**:
- ProjectV2 has multiple child tables: `location`, `estimation`, `rating`, `co_benefit`
- Need to implement `getAssociatedModels()` method returning:
  ```javascript
  [
    { model: LocationV2, pluralize: true },
    { model: EstimationV2, pluralize: true },
    { model: RatingV2, pluralize: true },
    { model: CoBenefitV2, pluralize: true },
  ]
  ```
- Primary key map:
  ```javascript
  {
    project: 'cad_trust_project_id',
    location: 'cad_trust_location_id',  // Note: location is child table
    estimation: 'cad_trust_estimation_id',
    rating: 'cad_trust_rating_id',
    co_benefit: 'cad_trust_co_benefit_id'
  }
  ```
- Return structure includes all child tables:
  ```javascript
  {
    project: [...],
    location: [...],
    estimation: [...],
    rating: [...],
    co_benefit: [...],
    comment: [...],
    author: [...]
  }
  ```

**Checkpoint 15.3**: Test ProjectV2 generateChangeListFromStagedData

```bash
# Test ProjectV2 generateChangeListFromStagedData with child tables
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/staging-v2.spec.js --reporter spec --exit --timeout 300000 --grep "generateChangeListFromStagedData.*Project"
```

**STOP HERE - User verifies ProjectV2 works**

### 15.4 Model Method: generateChangeListFromStagedData - Validation, Verification, Issuance

Add `generateChangeListFromStagedData()` to:
1. **ValidationV2** - Belongs to Project (no child tables)
2. **VerificationV2** - Belongs to Project and Validation (no child tables)
3. **IssuanceV2** - Belongs to Verification and Methodology (has Unit children)

**IssuanceV2 Special Considerations**:
- Has child table: `unit`
- Need `getAssociatedModels()` method
- Primary key map includes `unit: 'cad_trust_unit_id'`

**Checkpoint 15.4**: Test Validation, Verification, Issuance

```bash
# Test ValidationV2, VerificationV2, IssuanceV2 generateChangeListFromStagedData
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/staging-v2.spec.js --reporter spec --exit --timeout 300000 --grep "generateChangeListFromStagedData.*Validation|Verification|Issuance"
```

**STOP HERE - User verifies Validation/Verification/Issuance work**

### 15.5 Model Method: generateChangeListFromStagedData - Unit Model

Add `generateChangeListFromStagedData()` to **UnitV2** model.

**Special Considerations**:
- UnitV2 has child tables: `unit_label` (many-to-many via join table)
- Need `getAssociatedModels()` method:
  ```javascript
  [
    { model: UnitLabelV2, pluralize: true }  // Note: through join table
  ]
  ```
- Primary key map:
  ```javascript
  {
    unit: 'cad_trust_unit_id',
    unit_label: 'id'  // Join table uses 'id' as primary key
  }
  ```
- Handle many-to-many relationship correctly (via `unit_label` join table)

**Checkpoint 15.5**: Test UnitV2 generateChangeListFromStagedData

```bash
# Test UnitV2 generateChangeListFromStagedData with unit_label
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/staging-v2.spec.js --reporter spec --exit --timeout 300000 --grep "generateChangeListFromStagedData.*Unit"
```

**STOP HERE - User verifies UnitV2 works**

### 15.6 Model Method: generateChangeListFromStagedData - Join Tables and Independent Models

Add `generateChangeListFromStagedData()` to:
1. **ProjectMethodologyV2** - Join table (no child tables)
2. **StakeholderV2** - Independent (no child tables)
3. **StakeholderProjectV2** - Join table (no child tables)
4. **LabelV2** - Independent (no child tables)
5. **UnitLabelV2** - Join table (no child tables)

**Join Table Considerations**:
- Join tables typically have simple primary keys (`id`)
- Primary key map: `{ tableName: 'id' }`
- No child tables, so no `getDeletedItems()` call needed
- No `getAssociatedModels()` needed

**Checkpoint 15.6**: Test join tables and independent models

```bash
# Test join tables and independent models
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/staging-v2.spec.js --reporter spec --exit --timeout 300000 --grep "generateChangeListFromStagedData.*ProjectMethodology|Stakeholder|Label|UnitLabel"
```

**STOP HERE - User verifies join tables and independent models work**

### 15.7 Model Method: generateChangeListFromStagedData - AEF Models

Add `generateChangeListFromStagedData()` to AEF models:
1. **AefT1SubmissionV2** - Independent (no child tables)
2. **AefT5AuthorizedEntitiesV2** - Has dependencies (no child tables)
3. **AefT2AuthorizationsV2** - Has dependencies (no child tables)
4. **AefT3ActionsV2** - Has dependencies (no child tables)
5. **AefT4HoldingsV2** - Has dependencies (no child tables)

**AEF Models Considerations**:
- All AEF models are independent (no child tables)
- Use snake_case table names: `aef_t1_submission`, `aef_t5_authorized_entities`, etc.
- Primary key field names follow pattern: `cad_trust_aef_t1_submission_id`, etc.

**Checkpoint 15.7**: Test AEF models

```bash
# Test AEF models generateChangeListFromStagedData
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/staging-v2.spec.js --reporter spec --exit --timeout 300000 --grep "generateChangeListFromStagedData.*Aef"
```

**STOP HERE - User verifies AEF models work**

### 15.8 Staging Model: pushToDataLayer Method

Add `pushToDataLayer(tableToPush, comment, author, ids = [])` method to `src/models/v2/staging-v2.model.js`.

**Method Implementation** (with performance optimizations):
1. Build where clause: `committed=false`, optional table filter, optional ids filter
2. Read unstaged records from StagingV2 table (with `raw: true` for performance)
3. Validate records exist (throw error if none)
4. **PERFORMANCE OPTIMIZATION**: Fetch home organization ONCE per commit operation (not in each model method)
   - Call `OrganizationsV2.getHomeOrg()` to get `registryId` at the start of `pushToDataLayer()`
   - **Note**: This is scoped to the commit operation - not a persistent cache
   - **Safety**: `registryId` is immutable after org creation (only name/icon can change), so safe to cache within operation scope
5. **PERFORMANCE OPTIMIZATION**: Fetch comment/author metadata ONCE (not in each model method)
   - Call `dataLayer.getValue()` twice (once for comment, once for author)
   - Calculate `isUpdateComment` and `isUpdateAuthor` flags
6. **PERFORMANCE OPTIMIZATION**: Filter models that have staged data before processing
   - Build array of models that have records in staging table
   - Only call `generateChangeListFromStagedData()` for models with data
7. Call filtered model `generateChangeListFromStagedData()` methods in parallel:
   - Pass `registryId`, `isUpdateComment`, `isUpdateAuthor` as parameters
   - Models: ProgramV2, MethodologyV2, ProjectV2, ValidationV2, VerificationV2, IssuanceV2, UnitV2, LocationV2
   - EstimationV2, RatingV2, CoBenefitV2
   - ProjectMethodologyV2, StakeholderV2, StakeholderProjectV2, LabelV2, UnitLabelV2
   - AefT1SubmissionV2, AefT5AuthorizedEntitiesV2, AefT2AuthorizationsV2, AefT3ActionsV2, AefT4HoldingsV2
8. Merge changelists:
   - Combine all model changelists into unified object
   - Handle special keys (comment, author) - only include once (from first model that returns them)
   - Flatten to single array
   - Remove duplicates by `[action, key]` combination
   - Sort by action
9. Push to datalayer via `datalayer.pushDataLayerChangeList()`
10. Set up error callback to mark records as `failed_commit=true`

**CRITICAL Requirements**:
- Use `OrganizationsV2.getHomeOrg()` instead of `Organization.getHomeOrg()`
- Use `StagingV2` model (not `Staging`)
- Use snake_case field names: `failed_commit` (not `failedCommit`)
- Handle all 21 data models (not just 2 like V1)
- **MUST implement performance optimizations #1, #2, #3** (centralize metadata, cache org, early exit)

**Performance Impact**:
- Reduces datalayer RPC calls from 42 to 2 (95% reduction)
- Reduces database queries by ~20 (home org fetched once per commit operation)
- Skips processing for models with no staged data

**Cache Safety Notes**:
- **Home Org `registryId`**: Immutable after creation - safe to cache within commit operation scope
- **Home Org `name`/`icon`**: Can change via `editHomeOrg()`, but not used in datalayer operations
- **Home Org Changes**: Extremely rare (only during initial setup or org import). If home org is destroyed/recreated, the next commit operation will fetch the new one
- **No Persistent Cache**: Each `pushToDataLayer()` call fetches fresh data - we're just avoiding redundant fetches within a single operation
- **No Cache Invalidation Needed**: Since each operation fetches fresh, there's no stale cache to invalidate

**Future Consideration (Optional)**:
If we wanted to implement a persistent cache (e.g., in-memory cache with TTL), we would need:
- Cache invalidation on: `OrganizationsV2.create()`, `OrganizationsV2.update()` where `is_home=true`, `OrganizationsV2.destroy()` where `is_home=true`
- TTL-based expiration (e.g., 5 minutes) as safety net
- Cache key: `'home_org_v2'` or similar
- But this is NOT necessary for V2 - the per-operation optimization is sufficient and simpler

**Reference**: V1 implementation in `src/models/staging/staging.model.js` lines 477-533

**Checkpoint 15.8**: Test pushToDataLayer method

```bash
# Test pushToDataLayer with multiple models
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/staging-v2.spec.js --reporter spec --exit --timeout 300000 --grep "pushToDataLayer"
```

**STOP HERE - User verifies pushToDataLayer works**

### 15.8a Add Performance Monitoring to pushToDataLayer

Add comprehensive performance monitoring to the `pushToDataLayer()` method in `src/models/v2/staging-v2.model.js`.

**Implementation**: Integrate monitoring into existing `pushToDataLayer()` method using comprehensive approach.

**Monitoring Metrics to Track**:

1. **Timing Metrics**:
   - Total commit duration
   - Stage-by-stage timing (read staging, fetch metadata, process models, merge changelists, push to datalayer)
   - Per-model processing time (for each model's `generateChangeListFromStagedData()`)
   - Identify slowest model

2. **RPC Call Tracking**:
   - Count datalayer RPC calls (comment/author fetches = 2, push operation = 1)
   - Verify optimization is working (should see 3 total calls, not 42+)
   - Track RPC call breakdown

3. **Memory Usage**:
   - Capture `process.memoryUsage()` before and after commit
   - Track heap usage, RSS, external memory deltas
   - Warn if memory delta exceeds 100 MB threshold

4. **Performance Warnings**:
   - Warning threshold: 5 seconds
   - Error threshold: 30 seconds
   - Log warnings when thresholds exceeded

**Code Structure**:

```javascript
static async pushToDataLayer(tableToPush, comment, author, ids = []) {
  const commitStartTime = Date.now();
  const memoryBefore = process.memoryUsage();
  const monitor = {
    rpcCount: 0,
    modelTimings: {},
    stages: {}
  };

  try {
    // Stage 1: Read staging records
    const stage1Start = Date.now();
    const stagedRecords = await StagingV2.findAll({ where: whereClause, raw: true });
    monitor.stages.readStaging = Date.now() - stage1Start;

    // Stage 2: Fetch metadata (track RPC calls)
    const stage2Start = Date.now();
    monitor.rpcCount += 2; // comment + author
    const { registryId } = await OrganizationsV2.getHomeOrg();
    const commentValue = await dataLayer.getValue(registryId, encodeHex('comment'));
    const authorValue = await dataLayer.getValue(registryId, encodeHex('author'));
    const isUpdateComment = !_.isNil(commentValue) && commentValue !== false;
    const isUpdateAuthor = !_.isNil(authorValue) && authorValue !== false;
    monitor.stages.fetchMetadata = Date.now() - stage2Start;

    // Stage 3: Process models (track timing for each model)
    const stage3Start = Date.now();
    const modelsToProcess = [/* filtered list of models with staged data */];

    const modelResults = await Promise.all(
      modelsToProcess.map(async (ModelClass) => {
        const modelStart = Date.now();
        try {
          const result = await ModelClass.generateChangeListFromStagedData(
            stagedRecords, comment, author, registryId, isUpdateComment, isUpdateAuthor
          );
          const duration = Date.now() - modelStart;
          monitor.modelTimings[ModelClass.name] = duration;

          logger.debug(`Model ${ModelClass.name} processed in ${duration}ms`, {
            model: ModelClass.name,
            duration,
            action: 'generateChangeList',
            recordCount: stagedRecords.filter(r => r.table === ModelClass.tableName).length
          });

          return result;
        } catch (error) {
          const duration = Date.now() - modelStart;
          logger.error(`Model ${ModelClass.name} failed after ${duration}ms`, {
            model: ModelClass.name,
            duration,
            error: error.message
          });
          throw error;
        }
      })
    );
    monitor.stages.processModels = Date.now() - stage3Start;

    // Stage 4: Merge changelists
    const stage4Start = Date.now();
    const mergedChangeList = mergeChangeLists(modelResults);
    monitor.stages.mergeChangelists = Date.now() - stage4Start;

    // Stage 5: Push to datalayer
    const stage5Start = Date.now();
    monitor.rpcCount += 1; // pushDataLayerChangeList
    await datalayer.pushDataLayerChangeList(registryId, mergedChangeList, failedCallback);
    monitor.stages.pushToDatalayer = Date.now() - stage5Start;

    // Final summary log
    const totalDuration = Date.now() - commitStartTime;
    const memoryAfter = process.memoryUsage();

    logger.info('Commit completed with performance metrics', {
      duration: {
        total: totalDuration,
        stages: monitor.stages,
        models: monitor.modelTimings
      },
      memory: {
        heapUsedDelta: ((memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024).toFixed(2) + ' MB',
        rssDelta: ((memoryAfter.rss - memoryBefore.rss) / 1024 / 1024).toFixed(2) + ' MB'
      },
      rpc: {
        totalCalls: monitor.rpcCount,
        breakdown: {
          metadata: 2,
          push: 1
        }
      },
      data: {
        recordCount: stagedRecords.length,
        tableCount: new Set(stagedRecords.map(r => r.table)).size,
        changelistSize: mergedChangeList.length
      }
    });

    // Performance warnings
    const WARNING_THRESHOLD = 5000; // 5 seconds
    const ERROR_THRESHOLD = 30000; // 30 seconds

    if (totalDuration > ERROR_THRESHOLD) {
      logger.error('Commit exceeded error threshold', {
        duration: totalDuration,
        threshold: ERROR_THRESHOLD,
        recordCount: stagedRecords.length,
        tableCount: new Set(stagedRecords.map(r => r.table)).size,
        recommendation: 'Investigate performance bottleneck'
      });
    } else if (totalDuration > WARNING_THRESHOLD) {
      logger.warn('Commit exceeded warning threshold', {
        duration: totalDuration,
        threshold: WARNING_THRESHOLD,
        recordCount: stagedRecords.length,
        tableCount: new Set(stagedRecords.map(r => r.table)).size
      });
    }

    // Memory warning
    const memoryDelta = (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024; // MB
    if (memoryDelta > 100) {
      logger.warn('High memory usage during commit', {
        heapUsedDelta: memoryDelta.toFixed(2) + ' MB',
        recordCount: stagedRecords.length,
        recommendation: 'Consider batching commits for large datasets'
      });
    }

  } catch (error) {
    const totalDuration = Date.now() - commitStartTime;
    logger.error('Commit failed with performance metrics', {
      duration: totalDuration,
      error: error.message,
      metrics: monitor
    });
    throw error;
  }
}
```

**Log Levels Used**:
- `logger.info()` - Summary metrics for successful commits (always logged)
- `logger.debug()` - Per-model timing details (can be filtered by log level)
- `logger.warn()` - Performance threshold warnings (5s+ duration, 100MB+ memory)
- `logger.error()` - Errors and critical threshold violations (30s+ duration, failures)

**Benefits**:
- Identify which models are slow (modelTimings)
- Track RPC call counts (verify optimization is working - should see 3 calls, not 42+)
- Monitor memory usage (detect memory leaks or large commits)
- Performance warnings (alert on slow commits)
- All data in structured JSON format for easy parsing/analysis

**CRITICAL Requirements**:
- Use Winston logger with structured metadata (already imported)
- Maintain existing functionality (monitoring is additive)
- All metrics should be logged at appropriate levels
- Performance warnings should not interrupt normal operation

**Checkpoint 15.8a**: Verify monitoring is working

```bash
# Test commit and verify monitoring logs appear
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/staging-v2.spec.js --reporter spec --exit --timeout 300000 --grep "pushToDataLayer"

# Check logs for performance metrics
# Should see: "Commit completed with performance metrics" log entry with structured data
# Should see: Per-model timing in debug logs (if log level is debug)
# Should see: Performance warnings if commit exceeds thresholds
```

**STOP HERE - User verifies monitoring is working and logs are appearing correctly**

### 15.9 Staging Controller: Read Endpoints

Create `src/controllers/v2/staging-v2.controller.js` with read methods:

**Methods to Implement**:
1. **`findAll`**: Get staging records with pagination and filtering
   - Support `type` query param: `staged`, `pending`, `failed`
   - Support `table` query param: filter by table name
   - Include `diff` object for each record (call `StagingV2.getDiffObject()`)
   - Return paginated response

2. **`hasPendingCommits`**: Check if there are pending commits
   - Query for `committed=true` and `failed_commit=false`
   - Return confirmation status

**CRITICAL Requirements**:
- Use V2 models: `StagingV2`, `OrganizationsV2`
- Use V2 assertions: `assertIfReadOnlyModeV2`, `assertHomeOrgExistsV2`, etc.
- Use snake_case field names in queries

**Reference**: V1 implementation in `src/controllers/staging.controller.js`

**Checkpoint 15.9**: Test read endpoints

```bash
# Test staging read endpoints
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/staging-v2.spec.js --reporter spec --exit --timeout 300000 --grep "GET|findAll|hasPendingCommits"
```

**STOP HERE - User verifies read endpoints work**

### 15.10 Staging Controller: Commit Endpoint

Add **`commit`** method to `src/controllers/v2/staging-v2.controller.js`:

**Method Implementation**:
1. Run assertions:
   - `assertIfReadOnlyModeV2()`
   - `assertStagingTableNotEmptyV2()`
   - `assertHomeOrgExistsV2()`
   - `assertWalletIsSyncedV2()`
   - `assertNoPendingCommitsV2()`
2. Extract params: `table` (query), `comment`, `author`, `ids` (body)
3. Call `StagingV2.pushToDataLayer(table, comment, author, ids)`
4. Return success response

**CRITICAL Requirements**:
- Create V2 versions of all assertions if they don't exist
- Use V2 models and utilities

**Reference**: V1 implementation in `src/controllers/staging.controller.js` lines 93-120

**Checkpoint 15.10**: Test commit endpoint

```bash
# Test commit endpoint
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/staging-v2.spec.js --reporter spec --exit --timeout 300000 --grep "commit|POST.*commit"
```

**STOP HERE - User verifies commit endpoint works**

### 15.11 Staging Controller: Additional Endpoints

Add remaining methods to `src/controllers/v2/staging-v2.controller.js`:

1. **`destroy`**: Delete staging record by UUID
2. **`clean`**: Truncate all staging records
3. **`editRecord`**: Update staging record data
4. **`retryRecord`**: Reset failed commit for retry

**CRITICAL Requirements**:
- Use V2 assertions and models
- Use snake_case field names

**Checkpoint 15.11**: Test additional endpoints

```bash
# Test additional staging endpoints
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/staging-v2.spec.js --reporter spec --exit --timeout 300000 --grep "destroy|clean|editRecord|retryRecord"
```

**STOP HERE - User verifies additional endpoints work**

### 15.12 Staging Routes

Create `src/routes/v2/resources/staging-v2.js` with routes:

- `GET /v2/staging` - findAll
- `GET /v2/staging/pending` - hasPendingCommits
- `POST /v2/staging/commit` - commit
- `DELETE /v2/staging` - destroy
- `DELETE /v2/staging/clean` - clean
- `PUT /v2/staging` - editRecord
- `POST /v2/staging/retry` - retryRecord

Mount in `src/routes/v2/index.js`:
```javascript
import { StagingV2Router } from './resources/staging-v2.js';
V2Router.use('/staging', StagingV2Router);
```

**Checkpoint 15.12**: Test routes

```bash
# Test all staging routes via HTTP
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/staging-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies all routes work**

### 15.13 Staging Model: getDiffObject Method ✅

Add `getDiffObject(uuid, table, action, data)` method to `src/models/v2/staging-v2.model.js`.

**Method Implementation**:
- Similar to V1, but use V2 models ✅
- Handle all 21 data tables ✅
- Return diff object with `original` and `change` properties ✅
- Use V2 table names and primary key fields ✅
- Fetch original records for UPDATE and DELETE actions ✅
- Map table names to models and primary key fields ✅

**Reference**: V1 implementation in `src/models/staging/staging.model.js` lines 318-413

**Checkpoint 15.13**: Test getDiffObject ✅

```bash
# Test getDiffObject for various tables
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/staging-v2.spec.js --reporter spec --exit --timeout 300000 --grep "getDiffObject"
```

**STOP HERE - User verifies getDiffObject works**

### 15.14 Integration Tests and Validation ✅

Complete `tests/v2/integration/staging-v2.spec.js` with comprehensive tests:

1. **End-to-end commit flow**: Stage records → commit → verify datalayer ✅
2. **Multi-table commits**: Commit records from multiple tables simultaneously ✅
3. **Error handling**: Test failed commits, rollback scenarios ✅
4. **Edge cases**: Empty staging, duplicate keys, invalid records ✅
5. **V1/V2 isolation**: Verify V2 staging doesn't interfere with V1 ✅
6. **Staging Controller endpoints**: Read, commit, delete, clean, edit, retry ✅
7. **getDiffObject tests**: INSERT, UPDATE, DELETE actions with various models ✅

**Checkpoint 15.14**: Run all staging tests

```bash
# Run all staging tests
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/staging-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies all staging tests pass**

## Phase 16: V2 Organization Management

**Phase Overview**: Implement V2 organization creation and upgrade functionality, enabling new users to create V2-only organizations and existing V1 users to upgrade to V2.

**Key Requirements**:
- New users: Create V2 home org via V2 endpoint (no V1 org or V1 singleton)
- Existing users: Upgrade endpoint to create V2 org from existing V1 org
- Singleton structure: Add `v2` key to existing dataModelVersionStoreId singleton for upgraded orgs
- No auto-creation: V2 org should NOT be created automatically on startup

### 16.1 OrganizationsV2 Model: createHomeOrganization Method

Add `createHomeOrganization(name, icon, dataVersion = 'v2')` method to `src/models/v2/organizations-v2.model.js`.

**Method Implementation**:
- Similar to V1 `Organization.createHomeOrganization()` but for V2
- Create 4 datalayer stores:
  1. `orgUid` store (main organization store)
  2. `registryStoreId` store (V2 registry store)
  3. `dataModelVersionStoreId` store (singleton that maps versions to registry stores)
  4. `fileStoreId` store (file storage)
- Set up singleton structure:
  - orgUid store: `{ registryId: dataModelVersionStoreId, fileStoreId, name, icon }`
  - dataModelVersionStoreId store: `{ v2: registryStoreId }` (only V2 key for new users)
- Wait for blockchain confirmations (30s delays, waitForAllTransactionsToConfirm)
- Create OrganizationsV2 record in database with `is_home: true`
- Handle errors and rollback on failure

**Key Differences from V1**:
- Uses `OrganizationsV2` model (not `Organization`)
- Uses V2 database table (snake_case: `org_uid`, `is_home`, etc.)
- Creates singleton with only `v2` key (not `v1`)
- Uses `dataVersion = 'v2'` parameter

**CRITICAL Requirements**:
- Check for existing V2 home org before creating (return existing if found)
- Check for V1 home org in database - if exists, throw error (user should use upgrade endpoint instead)
- Check for V1 singleton in datalayer - if exists, throw error (user should use upgrade endpoint instead)
  - **How to check for V1 singleton**:
    1. Check if V1 org exists in database (`Organization.findOne({ where: { isHome: true } })`)
    2. If V1 org exists, read its `dataModelVersionStoreId`
    3. Read singleton data from datalayer: `datalayer.getStoreData(dataModelVersionStoreId)`
    4. Check if singleton has `v1` key
    5. If `v1` key exists, error: "V1 organization detected. Please use /v2/organizations/upgrade endpoint"
  - **Alternative check**: If no V1 org in database, but want to check datalayer directly, this may require scanning owned stores (less reliable)
- Use snake_case field names: `org_uid`, `is_home`, `registry_id`, etc.
- Use V2 datalayer utilities and services

**OrgUid Store Structure** (first datalayer store created):
- Key: `registryId` → Value: `dataModelVersionStoreId` (points to singleton)
- Key: `fileStoreId` → Value: `fileStoreId` (file store ID)
- Key: `name` → Value: organization name (string)
- Key: `icon` → Value: organization icon (base64 string)

**DataModelVersionStoreId Singleton Structure** (maps versions to registry stores):
- **For V1-only org**: `{ v1: v1RegistryStoreId }`
- **For new V2-only org**: `{ v2: v2RegistryStoreId }`
- **For upgraded org (V1 + V2)**: `{ v1: v1RegistryStoreId, v2: v2RegistryStoreId }`
- **Purpose**: The singleton allows multiple data model versions (v1, v2) to share the same organization while having separate registry stores
- **Key naming**: The key is the data version (`v1`, `v2`), the value is the registry store ID for that version

**Reference**: V1 implementation in `src/models/organizations/organizations.model.js` lines 125-263

**Checkpoint 16.1**: Test createHomeOrganization method

```bash
# Test V2 home org creation
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/organizations-v2.spec.js --reporter spec --exit --timeout 300000 --grep "createHomeOrganization"
```

**STOP HERE - User verifies createHomeOrganization works**

### 16.2 OrganizationsV2 Model: upgradeFromV1 Method

Add `upgradeFromV1()` method to `src/models/v2/organizations-v2.model.js`.

**Method Implementation**:
- Check if V1 home org exists (throw error if not)
- Check if V2 home org already exists (throw error if already upgraded)
- Get V1 org data: `name`, `icon`, `orgUid`, `dataModelVersionStoreId`, `registryId`, `fileStoreId`
- Create new V2 stores:
  1. **New `orgUid` store for V2** (completely new store ID, different from V1 orgUid)
  2. **New `registryStoreId` store for V2** (completely new store ID, different from V1 registryId)
  3. **New `fileStoreId` store for V2** (completely new store ID, separate from V1 fileStoreId)
  4. **CRITICAL**: Use existing `dataModelVersionStoreId` singleton (do NOT create new one)
- Add `v2` key to existing singleton:
  - Read current singleton data from datalayer (should have `v1: v1RegistryStoreId`)
  - Preserve existing `v1: v1RegistryStoreId` key
  - Add `v2: v2RegistryStoreId` key
  - Update singleton: `{ v1: v1RegistryStoreId, v2: v2RegistryStoreId }`
- Set up V2 orgUid store (completely new store):
  - `{ registryId: dataModelVersionStoreId, fileStoreId: v2FileStoreId, name, icon }`
  - **Note**: `registryId` points to the SHARED singleton (same as V1)
  - **Note**: `fileStoreId` is NEW (separate from V1)
- Wait for blockchain confirmations
- Create OrganizationsV2 record:
  - Copy `name`, `icon` from V1 org
  - Set `is_home: true`
  - Store new V2 store IDs: `org_uid` (new), `registry_id` (new), `file_store_subscribed` (new), `data_model_version_store_id` (SAME as V1 - shared singleton)

**CRITICAL Requirements**:
- Must have V1 home org (error if not)
- Must not have V2 home org already (error if exists)
- Must use existing `dataModelVersionStoreId` singleton (read V1 org's `dataModelVersionStoreId`)
- Must preserve existing singleton keys (add `v2` key, don't overwrite `v1` key)
- Use snake_case field names for V2 database
- Use V2 models and assertions

**Reference**: V1 implementation in `src/models/organizations/organizations.model.js` lines 125-263

**Checkpoint 16.2**: Test upgradeFromV1 method

```bash
# Test V2 org upgrade from V1
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/organizations-v2.spec.js --reporter spec --exit --timeout 300000 --grep "upgradeFromV1"
```

**STOP HERE - User verifies upgradeFromV1 works**

### 16.3 OrganizationsV2 Controller: Create Endpoint

Create `src/controllers/v2/organizations-v2.controller.js` with `create` method.

**Method Implementation**:
- Check assertions: `assertV2IfReadOnlyMode()`, `assertWalletIsSynced()`
- Check if V1 home org exists in database - if exists, return error (must use upgrade endpoint)
- Check if V1 singleton exists in datalayer - if exists, return error (must use upgrade endpoint)
  - **How to check**: If V1 org exists in database, read its `dataModelVersionStoreId` and check datalayer for `v1` key
  - If singleton exists with `v1` key, error: "V1 organization detected. Please use /v2/organizations/upgrade endpoint"
  - **Note**: Primary check is database (V1 org existence), secondary check is datalayer singleton verification
- Check if V2 home org exists - if exists, return error
- Extract `name` and `icon` from request (support file upload for icon)
- Call `OrganizationsV2.createHomeOrganization(name, icon, 'v2')`
- Return success response

**CRITICAL Requirements**:
- Use V2 assertions: `assertV2IfReadOnlyMode()`
- Check for V1 org existence - error if found (user should use upgrade endpoint)
- Use V2 model: `OrganizationsV2`
- Use V2 utilities and helpers

**Reference**: V1 implementation in `src/controllers/organization.controller.js` lines 84-127

**Checkpoint 16.3**: Test create endpoint

```bash
# Test V2 org creation endpoint
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/organizations-v2.spec.js --reporter spec --exit --timeout 300000 --grep "POST.*organizations"
```

**STOP HERE - User verifies create endpoint works**

### 16.4 OrganizationsV2 Controller: Upgrade Endpoint

Add `upgrade` method to `src/controllers/v2/organizations-v2.controller.js`.

**Method Implementation**:
- Check assertions: `assertV2IfReadOnlyMode()`, `assertWalletIsSynced()`, `assertNoPendingCommitsExcludingTransfers()`
- Check if V1 home org exists - if NOT, return error (must have V1 org to upgrade)
- Check if V2 home org already exists - if exists, return error (already upgraded)
- Call `OrganizationsV2.upgradeFromV1()`
- Return success response with V2 org details

**CRITICAL Requirements**:
- Use V2 assertions
- Must verify V1 home org exists (error if not)
- Must verify V2 home org does NOT exist (error if already upgraded)
- Use V1 model to read V1 org: `Organization.getHomeOrg()` (to get V1 data)
- Use V2 model to create V2 org: `OrganizationsV2.upgradeFromV1()`

**Reference**: V1 implementation patterns in `src/controllers/organization.controller.js`

**Checkpoint 16.4**: Test upgrade endpoint

```bash
# Test V2 org upgrade endpoint
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/organizations-v2.spec.js --reporter spec --exit --timeout 300000 --grep "upgrade"
```

**STOP HERE - User verifies upgrade endpoint works**

### 16.5 OrganizationsV2 Routes

Create `src/routes/v2/resources/organizations-v2.js` with routes:

- `POST /v2/organizations` - Create V2 home org (new users)
- `POST /v2/organizations/upgrade` - Upgrade from V1 to V2 (existing users)

Mount in `src/routes/v2/index.js`:
```javascript
import { OrganizationsV2Router } from './resources/organizations-v2.js';
V2Router.use('/organizations', OrganizationsV2Router);
```

**CRITICAL Requirements**:
- Support file upload for icon (use `upload.single('file')` middleware)
- Route `/v2/organizations/upgrade` must be before `/v2/organizations` (more specific route first)

**Reference**: V1 routes in `src/routes/v1/resources/organization.js`

**Checkpoint 16.5**: Test routes

```bash
# Test all organization routes
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/organizations-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies all routes work**

### 16.6 Verify No Auto-Creation on Startup ✅

**CRITICAL**: Ensure V2 organization is NOT automatically created on startup.

**Check Locations**:
- `src/server.js` - Check for any startup code that creates orgs ✅
- `src/tasks/` - Check for any scheduled tasks that create orgs ✅
- `src/middleware.js` - Check for any middleware that auto-creates orgs ✅
- Any initialization code that calls `OrganizationsV2.createHomeOrganization()` ✅

**Requirements**:
- V2 org should only be created via explicit API calls:
  - `POST /v2/organizations` (new users) ✅
  - `POST /v2/organizations/upgrade` (existing users) ✅
- No automatic creation on server startup ✅
- No automatic creation on first API call ✅

**Verification Results**:
- ✅ `src/server.js`: No org creation code found - only starts HTTP server
- ✅ `src/routes/index.js`: Only calls `prepareV2Db()` which runs migrations, no org creation
- ✅ `src/tasks/`: All tasks only work with V1 `Organization` model, no V2 org creation
- ✅ `src/middleware.js`: Only checks V1 `Organization.getHomeOrg()`, no V2 org creation
- ✅ All `OrganizationsV2.createHomeOrganization()` calls are only in:
  - `src/controllers/v2/organizations-v2.controller.js` (explicit API endpoint)
  - `src/models/v2/organizations-v2.model.js` (the method itself)
- ✅ Test created: `tests/v2/integration/organizations-v2-no-auto-creation.spec.js` - All tests passing

**Checkpoint 16.6**: ✅ Verified no auto-creation

```bash
# Test verification
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/organizations-v2-no-auto-creation.spec.js --reporter spec --exit --timeout 300000
# All 3 tests passing: no auto-creation on database initialization, no orgs after startup, requires explicit API call
```

**STOP HERE - User verifies no auto-creation occurs** ✅

### 16.7 Integration Tests

Create comprehensive tests in `tests/v2/integration/organizations-v2.spec.js`:

**Test Scenarios**:

1. **New User - V2 Org Creation**:
   - No V1 org exists in database
   - No V1 singleton exists in datalayer
   - Create V2 org via `POST /v2/organizations`
   - Verify V2 org created in database with `is_home: true`
   - Verify 4 new stores created: orgUid, registryId, dataModelVersionStoreId, fileStoreId
   - Verify singleton created with only `v2` key: `{ v2: v2RegistryStoreId }`
   - Verify orgUid store contains: `{ registryId: dataModelVersionStoreId, fileStoreId, name, icon }`
   - Verify V2 org is NOT in V1 table
   - Verify V2 orgUid is completely different from any V1 orgUid

2. **New User - Error Cases**:
   - Error if V1 org exists (must use upgrade)
   - Error if V1 singleton exists (must use upgrade)
   - Error if V2 org already exists

3. **Existing User - Upgrade**:
   - V1 org exists in database
   - V1 singleton exists in datalayer with `v1` key
   - Call `POST /v2/organizations/upgrade`
   - Verify V2 org created with same name/icon as V1
   - Verify V2 org has completely different store IDs than V1:
     - V2 `org_uid` ≠ V1 `orgUid` (new store)
     - V2 `registry_id` ≠ V1 `registryId` (new store)
     - V2 `file_store_subscribed` ≠ V1 `fileStoreId` (new store)
     - V2 `data_model_version_store_id` = V1 `dataModelVersionStoreId` (SAME - shared singleton)
   - Verify singleton has BOTH `v1` and `v2` keys: `{ v1: v1RegistryStoreId, v2: v2RegistryStoreId }`
   - Verify singleton `dataModelVersionStoreId` is the same as V1 (shared)
   - Verify V2 orgUid store contains: `{ registryId: dataModelVersionStoreId, fileStoreId: v2FileStoreId, name, icon }`
   - Verify V1 org remains unchanged

4. **Existing User - Upgrade Error Cases**:
   - Error if no V1 org exists
   - Error if V2 org already exists
   - Error if upgrade attempted twice

5. **Singleton Structure Verification**:
   - Verify singleton structure for new users (only `v2` key)
   - Verify singleton structure for upgraded users (`v1` and `v2` keys)
   - Verify singleton store ID is shared for upgraded users

**Checkpoint 16.7**: Run all integration tests

```bash
# Run all organization tests
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/organizations-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies all tests pass**

### 16.8 OrganizationsV2 Model: Read Operations

Add read methods to `src/models/v2/organizations-v2.model.js`:

**Methods to Add**:

1. **`getHomeOrg(includeAddress = true)`**:
   - Find V2 home org in database (`is_home: true`)
   - Parse metadata JSON if exists
   - Optionally include XCH address and file store subscription status
   - Return home org record

2. **`getOrgsMap()`**:
   - Get all organizations from V2 database
   - Return map/dictionary of orgUid -> org data
   - Similar to V1 but uses V2 models and snake_case

**CRITICAL Requirements**:
- Use `OrganizationsV2` model (not `Organization`)
- Use snake_case field names: `is_home`, `org_uid`, etc.
- Use V2 database connection

**Reference**: V1 implementation in `src/models/organizations/organizations.model.js` lines 28-64, 66-123

**Checkpoint 16.8**: Test read operations

```bash
# Test getHomeOrg and getOrgsMap
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/organizations-v2.spec.js --reporter spec --exit --timeout 300000 --grep "getHomeOrg|getOrgsMap"
```

**STOP HERE - User verifies read operations work**

### 16.9 OrganizationsV2 Controller: Read Endpoints

Add read endpoints to `src/controllers/v2/organizations-v2.controller.js`:

**Methods to Add**:

1. **`findAll`**:
   - Call `OrganizationsV2.getOrgsMap()`
   - Return JSON response with all organizations

2. **`homeOrgSyncStatus`**:
   - Check assertions: `assertV2HomeOrgExists()`, `assertWalletIsSynced()`
   - Get V2 home org via `OrganizationsV2.getHomeOrg()`
   - Get pending commits count from `StagingV2.count({ where: { committed: true } })`
   - Get sync status from datalayer
   - Return status object with `ready`, `wallet_synced`, `home_org_synced`, `pending_commits`, `home_org_profile_synced`

**CRITICAL Requirements**:
- Use V2 assertions: `assertV2HomeOrgExists()`
- Use V2 models: `OrganizationsV2`, `StagingV2`
- Use snake_case field names: `committed` (corrected spelling)

**Reference**: V1 implementation in `src/controllers/organization.controller.js` lines 16-49

**Checkpoint 16.9**: Test read endpoints

```bash
# Test findAll and homeOrgSyncStatus endpoints
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/organizations-v2.spec.js --reporter spec --exit --timeout 300000 --grep "GET.*organizations|status"
```

**STOP HERE - User verifies read endpoints work**

### 16.10 OrganizationsV2 Model: Edit and Metadata Operations

Add methods to `src/models/v2/organizations-v2.model.js`:

**Methods to Add**:

1. **`editOrgMeta({ name, icon })`**:
   - Update home org name and/or icon in datalayer
   - Update orgUid store with new name/icon
   - Update OrganizationsV2 database record
   - Use V2 datalayer utilities

2. **`addMetadata(payload)`**:
   - Add metadata to home org
   - Update metadata in orgUid store (with `meta_` prefix for metadata keys)
   - Update OrganizationsV2 database record (`metadata` field as JSON string)

**CRITICAL Requirements**:
- Use V2 models: `OrganizationsV2`
- Use V2 database connection
- Use snake_case field names
- Handle metadata as JSON string in database

**Reference**: V1 implementation in `src/models/organizations/organizations.model.js` lines 866-880, 882-889

**Checkpoint 16.10**: Test edit and metadata operations

```bash
# Test editOrgMeta and addMetadata
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/organizations-v2.spec.js --reporter spec --exit --timeout 300000 --grep "editOrgMeta|addMetadata"
```

**STOP HERE - User verifies edit and metadata operations work**

### 16.11 OrganizationsV2 Controller: Edit and Metadata Endpoints

Add endpoints to `src/controllers/v2/organizations-v2.controller.js`:

**Methods to Add**:

1. **`editHomeOrg`**:
   - Check assertions: `assertV2IfReadOnlyMode()`, `assertWalletIsSynced()`, `assertV2HomeOrgExists()`
   - Extract `name` from request body
   - Extract `icon` from file upload (if provided)
   - Call `OrganizationsV2.editOrgMeta({ name, icon })`
   - Return success response

2. **`addMetadata`**:
   - Check assertions: `assertV2IfReadOnlyMode()`, `assertWalletIsSynced()`, `assertV2HomeOrgExists()`
   - Extract metadata from request body
   - Call `OrganizationsV2.addMetadata(payload)`
   - Return success response

3. **`getMetaData`**:
   - Check assertions: `assertWalletIsSynced()`
   - Get org by `orgUid` from query params
   - Parse metadata JSON from database
   - Clean metadata keys (remove `meta_` prefix if present)
   - Return cleaned metadata

**CRITICAL Requirements**:
- Use V2 assertions and models
- Support file upload for icon (use `upload.single('file')` middleware)
- Handle metadata key prefixing/unprefixing

**Reference**: V1 implementation in `src/controllers/organization.controller.js` lines 51-82, 405-425, 447-471

**Checkpoint 16.11**: Test edit and metadata endpoints

```bash
# Test editHomeOrg, addMetadata, getMetaData endpoints
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/organizations-v2.spec.js --reporter spec --exit --timeout 300000 --grep "edit|metadata"
```

**STOP HERE - User verifies edit and metadata endpoints work**

### 16.12 OrganizationsV2 Model: Import and Subscription Operations

Add methods to `src/models/v2/organizations-v2.model.js`:

**Methods to Add**:

1. **`importOrganization(orgUid, isHome = false)`**:
   - Import organization from datalayer
   - Read org data from datalayer (orgUid store)
   - Extract `registryId` (dataModelVersionStoreId), `name`, `icon`, `fileStoreId`
   - Read singleton to get registry store ID for appropriate version (`v1` or `v2`)
   - Validate store ownership if `isHome = true`
   - Create OrganizationsV2 record
   - Subscribe to organization stores
   - **CRITICAL**: Handle V2 singleton structure - check for `v2` key in singleton, fallback to `v1` if needed

2. **`subscribeToOrganization(orgUid)`**:
   - Subscribe to orgUid store on datalayer
   - Read singleton to get registry store ID
   - Subscribe to registry store
   - Subscribe to file store (if AUTO_SUBSCRIBE_FILESTORE)
   - Mark organization as subscribed in database
   - Return organization store IDs
   - **CRITICAL**: Handle V2 singleton - check for `v2` key first, then `v1` if needed

3. **`unsubscribeFromOrganizationStores(organization)`**:
   - Unsubscribe from orgUid store
   - Unsubscribe from registry store
   - Unsubscribe from file store
   - Mark organization as unsubscribed in database

4. **`reconcileOrganization(organization)`**:
   - Validate store ownership if home org
   - Subscribe to organization (calls `subscribeToOrganization`)
   - Compare datalayer store IDs with database
   - Update database if discrepancies found
   - Handle V2 singleton structure

**CRITICAL Requirements**:
- Use V2 models: `OrganizationsV2`
- Handle V2 singleton structure (check for `v2` key, fallback to `v1`)
- Use V2 assertions: `assertV2HomeOrgExists()` for home org checks
- Use snake_case field names
- Support both V1 and V2 organizations (for import - may import V1 orgs)

**Reference**: V1 implementation in `src/models/organizations/organizations.model.js` lines 438-567, 569-683, 280-437

**Checkpoint 16.12**: Test import and subscription operations

```bash
# Test importOrganization, subscribeToOrganization, unsubscribeFromOrganizationStores, reconcileOrganization
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/organizations-v2.spec.js --reporter spec --exit --timeout 300000 --grep "import|subscribe|unsubscribe|reconcile"
```

**STOP HERE - User verifies import and subscription operations work**

### 16.13 OrganizationsV2 Controller: Import and Subscription Endpoints

Add endpoints to `src/controllers/v2/organizations-v2.controller.js`:

**Methods to Add**:

1. **`importOrganization`**:
   - Check assertions: `assertV2IfReadOnlyMode()`, `assertWalletIsSynced()`
   - Extract `orgUid`, `isHome` from request body
   - Check org doesn't exist: `assertV2OrgDoesNotExist(orgUid)` (need to create this assertion)
   - Call `OrganizationsV2.importOrganization(orgUid, isHome)`
   - Return success response

2. **`subscribeToOrganization`**:
   - Check assertions: `assertV2IfReadOnlyMode()`, `assertWalletIsSynced()`
   - Extract `orgUid` from request body
   - Call `OrganizationsV2.subscribeToOrganization(orgUid)`
   - Return success response

3. **`unsubscribeFromOrganization`**:
   - Check assertions: `assertV2IfReadOnlyMode()`, `assertWalletIsSynced()`
   - Extract `orgUid` from request body
   - Check if home org (error if trying to unsubscribe from home org)
   - If org exists in database: mark as unsubscribed
   - If org doesn't exist: check datalayer subscriptions and unsubscribe
   - Call `OrganizationsV2.unsubscribeFromOrganizationStores()`
   - Return success response

4. **`resyncOrganization`**:
   - Check assertions: `assertV2IfReadOnlyMode()`, `assertWalletIsSynced()`
   - Extract `orgUid` from request body
   - Verify org exists and is subscribed
   - Start transaction
   - Call `OrganizationsV2.reconcileOrganization(organization)`
   - Delete all data for org (V2 data tables)
   - Reset registry hash
   - Commit transaction
   - Return success response

**CRITICAL Requirements**:
- Use V2 assertions and models
- Use V2 data tables for resync (delete from V2 tables, not V1)
- Handle V2 singleton structure when reading from datalayer

**Reference**: V1 implementation in `src/controllers/organization.controller.js` lines 165-187, 189-207, 258-346, 348-403

**Checkpoint 16.13**: Test import and subscription endpoints

```bash
# Test importOrganization, subscribeToOrganization, unsubscribeFromOrganization, resyncOrganization endpoints
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/organizations-v2.spec.js --reporter spec --exit --timeout 300000 --grep "import|subscribe|unsubscribe|resync"
```

**STOP HERE - User verifies import and subscription endpoints work**

### 16.14 OrganizationsV2 Model: Delete and Sync Operations

Add methods to `src/models/v2/organizations-v2.model.js`:

**Methods to Add**:

1. **`deleteAllOrganizationData(orgUid)`**:
   - Delete all V2 data records for organization
   - Delete from all 21 data tables (program, project, methodology, etc.)
   - Delete from staging table
   - Delete from audit table
   - Delete from meta table
   - Delete organization record
   - **CRITICAL**: Only delete from V2 tables, not V1

2. **`syncOrganizationMeta()`**:
   - Get all subscribed organizations
   - For each org, sync metadata from datalayer
   - Update org metadata in database
   - Update org hash
   - Handle errors gracefully

**CRITICAL Requirements**:
- Use V2 models: `OrganizationsV2`, `StagingV2`, `AuditV2`, `MetaV2`, and all 21 data models
- Use V2 database connection
- Only affect V2 tables (V1/V2 isolation)

**Reference**: V1 implementation in `src/models/organizations/organizations.model.js` lines 753-791, 796-864

**Checkpoint 16.14**: Test delete and sync operations

```bash
# Test deleteAllOrganizationData and syncOrganizationMeta
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/organizations-v2.spec.js --reporter spec --exit --timeout 300000 --grep "deleteAllOrganizationData|syncOrganizationMeta"
```

**STOP HERE - User verifies delete and sync operations work**

### 16.15 OrganizationsV2 Controller: Delete and Sync Endpoints

Add endpoints to `src/controllers/v2/organizations-v2.controller.js`:

**Methods to Add**:

1. **`deleteOrganization`**:
   - Extract `orgUid` from params
   - Verify org exists
   - Call `OrganizationsV2.deleteAllOrganizationData(orgUid)`
   - If home org, return special message
   - If not home org, call `OrganizationsV2.unsubscribeFromOrganizationStores()` first
   - Return success response

2. **`sync`**:
   - Check assertions: `assertV2IfReadOnlyMode()` (optional - may not need for sync)
   - Call `OrganizationsV2.syncOrganizationMeta()`
   - Return success response

**CRITICAL Requirements**:
- Use V2 models and assertions
- Use V2 data tables for deletion
- Handle home org deletion appropriately

**Reference**: V1 implementation in `src/controllers/organization.controller.js` lines 209-256, 493-507

**Checkpoint 16.15**: Test delete and sync endpoints

```bash
# Test deleteOrganization and sync endpoints
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/organizations-v2.spec.js --reporter spec --exit --timeout 300000 --grep "delete|sync"
```

**STOP HERE - User verifies delete and sync endpoints work**

### 16.16 OrganizationsV2 Model: Mirror Operations

Add methods to `src/models/v2/organizations-v2.model.js`:

**Methods to Add**:

1. **`addMirror(storeId, url, force = false)`**:
   - Call `datalayer.addMirror(storeId, url, force)`
   - Simple wrapper around datalayer service

2. **`removeMirror(storeId, coinId)`**:
   - Call `datalayer.removeMirror(storeId, coinId)`
   - Simple wrapper around datalayer service

**CRITICAL Requirements**:
- These are simple wrappers around datalayer service
- No V2-specific logic needed (datalayer operations are version-agnostic)

**Reference**: V1 implementation in `src/models/organizations/organizations.model.js` lines 265-267, 891-900

**Checkpoint 16.16**: Test mirror operations

```bash
# Test addMirror and removeMirror
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/organizations-v2.spec.js --reporter spec --exit --timeout 300000 --grep "mirror"
```

**STOP HERE - User verifies mirror operations work**

### 16.17 OrganizationsV2 Controller: Mirror Endpoints

Add endpoints to `src/controllers/v2/organizations-v2.controller.js`:

**Methods to Add**:

1. **`addMirror`**:
   - Check assertions: `assertV2IfReadOnlyMode()`, `assertWalletIsSynced()`, `assertV2HomeOrgExists()`
   - Extract `storeId`, `url` from request body
   - Call `OrganizationsV2.addMirror(storeId, url)`
   - Return success response

2. **`removeMirror`**:
   - Check assertions: `assertV2IfReadOnlyMode()`, `assertWalletIsSynced()`, `assertV2HomeOrgExists()`
   - Extract `storeId`, `coinId` from request body
   - Call `OrganizationsV2.removeMirror(storeId, coinId)`
   - Return success response

**CRITICAL Requirements**:
- Use V2 assertions: `assertV2HomeOrgExists()`
- Use V2 model: `OrganizationsV2`

**Reference**: V1 implementation in `src/controllers/organization.controller.js` lines 427-445, 473-491

**Checkpoint 16.17**: Test mirror endpoints

```bash
# Test addMirror and removeMirror endpoints
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/organizations-v2.spec.js --reporter spec --exit --timeout 300000 --grep "mirror"
```

**STOP HERE - User verifies mirror endpoints work**

### 16.18 OrganizationsV2 Routes: Complete All Endpoints

Update `src/routes/v2/resources/organizations-v2.js` with all routes:

**Routes to Add**:

- `GET /v2/organizations` - findAll
- `GET /v2/organizations/status` - homeOrgSyncStatus
- `GET /v2/organizations/metadata` - getMetaData (query param: `orgUid`)
- `POST /v2/organizations` - create (new users)
- `POST /v2/organizations/upgrade` - upgrade (existing users)
- `POST /v2/organizations/metadata` - addMetadata
- `POST /v2/organizations/sync` - sync
- `POST /v2/organizations/mirror` - addMirror
- `POST /v2/organizations/remove-mirror` - removeMirror
- `PUT /v2/organizations/edit` - editHomeOrg (file upload support)
- `PUT /v2/organizations` - importOrganization
- `PUT /v2/organizations/subscribe` - subscribeToOrganization
- `PUT /v2/organizations/unsubscribe` - unsubscribeFromOrganization
- `PUT /v2/organizations/resync` - resyncOrganization
- `DELETE /v2/organizations/:orgUid` - deleteOrganization

**Route Ordering** (more specific routes first):
1. `/status` (before `/`)
2. `/upgrade` (before `/`)
3. `/edit` (before `/`)
4. `/metadata` (before `/`)
5. `/sync` (before `/`)
6. `/mirror` (before `/`)
7. `/remove-mirror` (before `/`)
8. `/subscribe` (before `/`)
9. `/unsubscribe` (before `/`)
10. `/resync` (before `/`)
11. `/:orgUid` (DELETE - before `/`)
12. `/` (GET, POST, PUT - catch-all)

**CRITICAL Requirements**:
- Support file upload for `/edit` endpoint: `upload.single('file')`
- Use validation schemas where applicable (similar to V1)
- Mount routes in correct order (more specific routes first)

**Reference**: V1 routes in `src/routes/v1/resources/organization.js`

**Checkpoint 16.18**: Test all routes

```bash
# Test all organization routes
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/organizations-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies all routes work**

### 16.19 V2 Data Assertions: Additional Assertions Needed

Add missing assertions to `src/utils/v2-data-assertions.js`:

**Assertions to Add**:

1. **`assertV2OrgDoesNotExist(orgUid)`**:
   - Check if org exists in V2 organizations table
   - Throw error if org exists
   - Similar to V1 `assertOrgDoesNotExist()` but for V2

**Reference**: V1 implementation in `src/utils/data-assertions.js`

**Checkpoint 16.19**: Verify assertions work

```bash
# Test that assertions are used correctly in organization endpoints
# This will be tested as part of organization endpoint tests
```

**STOP HERE - User verifies assertions work**

### 16.20 OrganizationsV2 Integration Tests: Complete Coverage

Add comprehensive tests to `tests/v2/integration/organizations-v2.spec.js` for all endpoints:

**Test Coverage**:

1. **Read Operations**:
   - Test `GET /v2/organizations` (findAll)
   - Test `GET /v2/organizations/status` (homeOrgSyncStatus)
   - Test `GET /v2/organizations/metadata` (getMetaData)

2. **Create/Upgrade**:
   - Test `POST /v2/organizations` (new users)
   - Test `POST /v2/organizations/upgrade` (existing users)
   - All error cases

3. **Edit Operations**:
   - Test `PUT /v2/organizations/edit` (editHomeOrg)
   - Test `POST /v2/organizations/metadata` (addMetadata)

4. **Import/Subscription**:
   - Test `PUT /v2/organizations` (importOrganization)
   - Test `PUT /v2/organizations/subscribe` (subscribeToOrganization)
   - Test `PUT /v2/organizations/unsubscribe` (unsubscribeFromOrganization)
   - Test `PUT /v2/organizations/resync` (resyncOrganization)

5. **Delete**:
   - Test `DELETE /v2/organizations/:orgUid` (deleteOrganization)
   - Test deletion of home org
   - Test deletion of non-home org
   - Verify V2 data is deleted, V1 data is preserved

6. **Sync**:
   - Test `POST /v2/organizations/sync` (syncOrganizationMeta)

7. **Mirror**:
   - Test `POST /v2/organizations/mirror` (addMirror)
   - Test `POST /v2/organizations/remove-mirror` (removeMirror)

8. **V1/V2 Isolation**:
   - Verify V2 operations don't affect V1 data
   - Verify V1 operations don't affect V2 data
   - Verify shared singleton works correctly

**Checkpoint 16.20**: Run all integration tests

```bash
# Run all organization tests
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/organizations-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies all organization tests pass**

### 15.14a Test Data Usage in Staging Tests

**Test Scenarios Using Generated Data**:

The comprehensive test suite in `tests/v2/integration/staging-v2.spec.js` should use the test data generators from Phase 15.0 to create various test scenarios:

1. **Single Table Commit Tests**:
   - Commit single Program record
   - Commit single Methodology record
   - Commit single Project record (with dependencies)
   - Test each of 21 tables individually

2. **Multi-Table Commit Tests**:
   - Commit Program + Methodology together
   - Commit Project with all child tables (Location, Estimation, Rating, CoBenefit)
   - Commit Unit with all dependencies (Issuance, Verification, etc.)
   - Commit random combinations of 3-5 tables

3. **Complex Relationship Tests**:
   - Commit complete project dataset (all related tables)
   - Commit complete unit dataset (all related tables)
   - Commit multiple projects with overlapping data
   - Commit records with join tables (ProjectMethodology, StakeholderProject, UnitLabel)

4. **Edge Case Tests**:
   - Commit empty staging (should fail)
   - Commit with only DELETE actions
   - Commit with only UPDATE actions
   - Commit with mixed INSERT/UPDATE/DELETE
   - Commit large datasets (100+ records across multiple tables)

5. **Data Integrity Tests**:
   - Verify committed data matches original staging data
   - Verify changelist format is correct
   - Verify hex encoding is correct
   - Verify foreign key relationships are preserved

**Test Data Flow**:
```
Test → Generate Test Data → Create Records via API (stages to staging table) → Commit → Verify Datalayer
```

**Example Test Pattern**:
```javascript
it('should commit multiple tables together', async function () {
  // Generate test data
  const programData = generateV2ProgramData();
  const methodologyData = generateV2MethodologyData();

  // Create records (stages to staging table)
  await supertest(app).post('/v2/program').send(programData);
  await supertest(app).post('/v2/methodology').send(methodologyData);

  // Commit all staged records
  const commitResponse = await supertest(app)
    .post('/v2/staging/commit')
    .send({ comment: 'Test commit', author: 'Test User' })
    .expect(200);

  // Verify staging records are marked as committed
  const stagingRecords = await StagingV2.findAll({
    where: { committed: true }
  });
  expect(stagingRecords.length).to.equal(2);

  // Verify datalayer received the data (if testing with real datalayer)
  // ... datalayer verification code ...
});
```

### 15.15 Key Implementation Notes

**Table Name Mapping**:
- V2 uses snake_case table names: `program`, `project`, `project_methodology`, etc. - Note: corrected spelling from `project_methodolgy`
- V2 table names match Sequelize model `tableName` property
- No special handling needed for pluralization (V1 has hacky fix for `Units`/`Projects`)

**Primary Key Field Names**:
- V2 uses snake_case: `cad_trust_program_id`, `cad_trust_project_id`, etc.
- V2 primary keys are UUIDs (varchar(36)), not integers
- Join tables use `id` as primary key (integer)

**Model Associations**:
- V2 models use Sequelize associations (belongsTo, hasMany, belongsToMany)
- `getAssociatedModels()` method returns array of association objects
- Used by `getDeletedItems()` to find deleted child records

**Datalayer Integration**:
- Uses same `datalayer` service as V1
- Uses same `dataLayer` RPC client
- Hex encoding/decoding handled by `encodeHex()` utility
- Changelist format is identical to V1

**V1/V2 Isolation**:
- V2 staging table is separate from V1
- V2 models are separate from V1
- V2 organizations are separate from V1
- No shared state between V1 and V2 staging

**Performance Considerations**:

**V1 Performance Issues Identified**:

1. **Sequential Datalayer Calls**: Each model makes 2 sequential `dataLayer.getValue()` calls for comment/author (42 total calls for 21 models)
2. **Deep Cloning Overhead**: `JSON.parse(JSON.stringify(rows))` in `createXlsFromSequelizeResults()` is expensive for large datasets
3. **Redundant Database Queries**: `getDeletedItems()` queries database for every UPDATE record, and `transformFullXslsToChangeList()` calls `findByPk()` for every row
4. **No Early Exit**: Models with no staged data still process through all steps
5. **No Caching**: Home organization fetched in each model method (21 times)
6. **Nested Promise.all**: Could cause memory issues with very large datasets

**V2 Performance Optimizations**:

1. **Centralize Comment/Author Metadata** (CRITICAL):
   - Fetch comment/author from datalayer ONCE in `pushToDataLayer()` before calling model methods
   - Pass `isUpdateComment` and `isUpdateAuthor` flags to each model method
   - Eliminates 40 redundant datalayer RPC calls (from 42 to 2)

2. **Early Exit for Empty Models**:
   - Check if model has staged records before processing
   - Skip models with no data to avoid unnecessary processing
   - Example: `if (!stagedRecords.some(r => r.table === 'program')) return emptyChangeList;`

3. **Cache Home Organization** (Per-Operation Scope):
   - Fetch home organization once in `pushToDataLayer()` at the start
   - Pass `registryId` to each model method instead of fetching it 21 times
   - Eliminates 20 redundant database queries
   - **Important**: This is NOT a persistent cache - it's scoped to a single commit operation
   - **Safety**: The `registryId` doesn't change after initial org creation (only `name`/`icon` can change via `editHomeOrg()`)
   - **Edge Case**: If home org is destroyed/recreated (extremely rare setup operation), the commit would use the new registryId on the next operation
   - **Alternative**: For extra safety, could add a verification check at end of `pushToDataLayer()` to ensure registryId hasn't changed (but adds one extra query)

4. **Batch Database Queries**:
   - For `getDeletedItems()`: Batch all UPDATE record queries into single query with `IN` clause
   - For `transformFullXslsToChangeList()`: Batch all `findByPk()` calls into single query per table
   - Use `Promise.all()` with batching to avoid overwhelming database

5. **Optimize Data Transformation**:
   - Consider streaming/lazy evaluation for `createXlsFromSequelizeResults()` with large datasets
   - Cache column maps and transformations instead of recalculating
   - Use object pooling or reuse for frequently created objects

6. **Smart Parallelization**:
   - Group models by dependency level (process independent models first)
   - Use worker threads or process pool for CPU-intensive transformations (if needed)
   - Limit concurrent model processing to avoid memory spikes (e.g., process in batches of 5-10 models)

7. **Staging Table Optimization**:
   - Add database indexes on `committed` and `table` columns for faster filtering
   - Use `raw: true` option (already done in V1, keep in V2)
   - Consider pagination for very large staging tables (1000+ records)

8. **Memory Management**:
   - Process models in batches instead of all 21 at once
   - Clear intermediate data structures after merging
   - Use streaming for changelist merging if total size exceeds threshold

9. **Conditional Processing**:
   - Only call `getDeletedItems()` if there are UPDATE records
   - Skip `transformFullXslsToChangeList()` if no records to process
   - Early return from model methods if no staged data

10. **Monitoring and Metrics**:
    - Add timing logs for each model's processing time
    - Track datalayer RPC call counts
    - Monitor memory usage during large commits
    - Add performance warnings for commits exceeding time thresholds

**Implementation Priority**:

1. **High Priority** (Must Implement) - ✅ **INTEGRATED INTO PHASES**:
   - ✅ Centralize comment/author metadata (#1) - Phase 15.8 step 5, Phase 15.2 step 7
   - ✅ Cache home organization (#3) - Phase 15.8 step 4, Phase 15.2 step 7
   - ✅ Early exit for empty models (#2) - Phase 15.8 step 6, Phase 15.2 step 1

2. **Medium Priority** (Should Implement) - ✅ **INTEGRATED INTO PHASES**:
   - ✅ Batch database queries (#4) - Phase 15.2 step 6
     - `getDeletedItems()` already batches using `Op.in` (V1 implementation is optimized)
     - `transformFullXslsToChangeList()` will be modified to batch `findByPk()` calls - see Phase 15.2 step 6
     - **Decision**: Modify shared utility `src/utils/xls.js` (improves both V1 and V2 performance)
   - ✅ Conditional processing (#9) - Phase 15.2 step 4 (only call `getDeletedItems()` if UPDATE records exist)
   - ✅ Staging table indexes (#7) - Phase 15.1 (indexes added to migration)

3. **Low Priority** (Nice to Have):
   - Optimize data transformation (#5)
   - Smart parallelization (#6)
   - Memory management (#8)
   - Monitoring (#10)

**Low Priority Items Analysis**:

**5. Optimize Data Transformation** (#5):
- **Complexity**: Medium-High
  - Requires refactoring `createXlsFromSequelizeResults()` which is a complex recursive function
  - Streaming/lazy evaluation would require significant architectural changes
  - Object pooling adds complexity but is straightforward
- **Risks/Downsides**:
  - **High Risk**: Modifying `createXlsFromSequelizeResults()` affects both V1 and V2
  - Risk of breaking existing functionality if not careful
  - The `JSON.parse(JSON.stringify(rows))` is used to "simplify sequelize's return shape" - removing it requires understanding Sequelize internals
  - Streaming adds complexity but may not provide significant benefits for typical commit sizes (<100 records)
- **Rework Required**: YES - Would require modifying `src/utils/xls.js` `createXlsFromSequelizeResults()` function
- **Forward-Only**: NO - This is a shared utility used by both V1 and V2
- **Recommendation**: Defer unless performance profiling shows this is a real bottleneck (likely only matters for very large commits with 1000+ records)

**6. Smart Parallelization** (#6):
- **Complexity**: Medium
  - Dependency level grouping is straightforward (models with no children first)
  - Worker threads/process pool is complex and likely unnecessary
  - Batch processing (5-10 models at a time) is simple to implement
- **Risks/Downsides**:
  - **Low Risk**: Can be implemented incrementally (start with dependency grouping, add batching if needed)
  - Worker threads add complexity and may not help (I/O bound operations, not CPU bound)
  - Dependency analysis requires understanding all 21 models' relationships
- **Rework Required**: PARTIAL - Would modify `pushToDataLayer()` in Phase 15.8, but can be added later without breaking existing code
- **Forward-Only**: YES - Can be added as enhancement to Phase 15.8 without affecting existing V1 code
- **Recommendation**: Implement dependency grouping (simple, low risk) and batch processing (5-10 models). Skip worker threads unless profiling shows CPU bottleneck.

**8. Memory Management** (#8):
- **Complexity**: Low-Medium
  - Batching models is simple (already partially done with Promise.all)
  - Clearing intermediate data is straightforward
  - Streaming for changelist merging is more complex
- **Risks/Downsides**:
  - **Low Risk**: These are defensive optimizations
  - Batching may slow down small commits (adds overhead for grouping)
  - Memory issues are unlikely with typical commit sizes (<100 records)
  - Only matters for very large commits (1000+ records)
- **Rework Required**: PARTIAL - Would modify `pushToDataLayer()` but can be added incrementally
- **Forward-Only**: YES - Can be added as enhancement without breaking existing code
- **Recommendation**: Implement if memory issues are observed in production. Otherwise defer. Low priority because typical commits are small.

**10. Monitoring and Metrics** (#10):
- **Complexity**: Low
  - Adding timing logs is straightforward
  - Tracking RPC calls is simple counting
  - Memory monitoring uses standard Node.js APIs
- **Risks/Downsides**:
  - **Very Low Risk**: Pure additive feature (logging/metrics)
  - Logging overhead is minimal but exists
  - May clutter logs if not filtered properly
- **Rework Required**: NO - Can be added to existing code without changing behavior
- **Forward-Only**: YES - Can be added incrementally without affecting functionality
- **Recommendation**: **EASIEST TO IMPLEMENT** - Add basic timing logs and RPC call tracking. This helps identify bottlenecks without risk. Good for production visibility.

**Implementation Guide for Monitoring (#10)**:

**Where to Add Monitoring**:
- Primary location: `src/models/v2/staging-v2.model.js` - `pushToDataLayer()` method
- Secondary locations: Each model's `generateChangeListFromStagedData()` method
- Optional: Wrap datalayer service calls to track RPC counts

**1. Timing Logs for Each Model's Processing Time**:

Add timing around each model's `generateChangeListFromStagedData()` call:

```javascript
// In pushToDataLayer() method
const modelTimings = {};
const modelStartTime = Date.now();

// Track which models are being processed
const modelsToProcess = [
  'ProgramV2', 'MethodologyV2', 'ProjectV2', 'ValidationV2',
  'VerificationV2', 'IssuanceV2', 'UnitV2', 'LocationV2',
  // ... all 21 models
];

// For each model in parallel processing:
const modelResults = await Promise.all(
  modelsToProcess.map(async (ModelClass) => {
    const modelStart = Date.now();
    try {
      const result = await ModelClass.generateChangeListFromStagedData(
        stagedRecords, comment, author, registryId, isUpdateComment, isUpdateAuthor
      );
      const duration = Date.now() - modelStart;
      modelTimings[ModelClass.name] = duration;

      logger.debug(`Model ${ModelClass.name} processed in ${duration}ms`, {
        model: ModelClass.name,
        duration,
        action: 'generateChangeList',
        recordCount: stagedRecords.filter(r => r.table === ModelClass.tableName).length
      });

      return result;
    } catch (error) {
      const duration = Date.now() - modelStart;
      logger.error(`Model ${ModelClass.name} failed after ${duration}ms`, {
        model: ModelClass.name,
        duration,
        error: error.message
      });
      throw error;
    }
  })
);

// Log summary after all models processed
const totalDuration = Date.now() - modelStartTime;
logger.info(`All models processed in ${totalDuration}ms`, {
  totalDuration,
  modelTimings,
  modelCount: Object.keys(modelTimings).length,
  slowestModel: Object.entries(modelTimings)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none'
});
```

**2. Track Datalayer RPC Call Counts**:

Create a wrapper or track calls directly:

```javascript
// Option A: Track in pushToDataLayer() directly
let datalayerRpcCount = 0;

// Before calling dataLayer.getValue() for comment/author
datalayerRpcCount += 2; // We know we're making 2 calls

// Log RPC count summary
logger.info('Datalayer RPC calls made', {
  rpcCount: datalayerRpcCount,
  comment: 'comment/author metadata',
  location: 'pushToDataLayer'
});

// Option B: Create monitoring wrapper (more comprehensive)
// Create src/utils/datalayer-monitor.js
class DatalayerMonitor {
  constructor() {
    this.rpcCount = 0;
    this.rpcCalls = [];
  }

  trackRpcCall(operation, duration) {
    this.rpcCount++;
    this.rpcCalls.push({ operation, duration, timestamp: Date.now() });
  }

  getSummary() {
    return {
      totalRpcCalls: this.rpcCount,
      calls: this.rpcCalls,
      operations: this.rpcCalls.reduce((acc, call) => {
        acc[call.operation] = (acc[call.operation] || 0) + 1;
        return acc;
      }, {})
    };
  }

  reset() {
    this.rpcCount = 0;
    this.rpcCalls = [];
  }
}

// In pushToDataLayer():
const monitor = new DatalayerMonitor();

// Track comment/author fetches
const commentStart = Date.now();
const commentValue = await dataLayer.getValue(registryId, encodeHex('comment'));
monitor.trackRpcCall('getValue.comment', Date.now() - commentStart);

const authorStart = Date.now();
const authorValue = await dataLayer.getValue(registryId, encodeHex('author'));
monitor.trackRpcCall('getValue.author', Date.now() - authorStart);

// Log summary
logger.info('Datalayer RPC summary', monitor.getSummary());
```

**3. Monitor Memory Usage During Large Commits**:

```javascript
// In pushToDataLayer() method
const memoryBefore = process.memoryUsage();

// ... process models ...

const memoryAfter = process.memoryUsage();
const memoryDelta = {
  heapUsed: (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024, // MB
  heapTotal: (memoryAfter.heapTotal - memoryBefore.heapTotal) / 1024 / 1024, // MB
  external: (memoryAfter.external - memoryBefore.external) / 1024 / 1024, // MB
  rss: (memoryAfter.rss - memoryBefore.rss) / 1024 / 1024, // MB
};

logger.info('Memory usage during commit', {
  before: {
    heapUsed: (memoryBefore.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
    heapTotal: (memoryBefore.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
    rss: (memoryBefore.rss / 1024 / 1024).toFixed(2) + ' MB'
  },
  after: {
    heapUsed: (memoryAfter.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
    heapTotal: (memoryAfter.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
    rss: (memoryAfter.rss / 1024 / 1024).toFixed(2) + ' MB'
  },
  delta: {
    heapUsed: memoryDelta.heapUsed.toFixed(2) + ' MB',
    heapTotal: memoryDelta.heapTotal.toFixed(2) + ' MB',
    rss: memoryDelta.rss.toFixed(2) + ' MB'
  },
  recordCount: stagedRecords.length,
  tableCount: new Set(stagedRecords.map(r => r.table)).size
});

// Warn if memory usage is high
if (memoryDelta.heapUsed > 100) { // 100 MB threshold
  logger.warn('High memory usage during commit', {
    heapUsedDelta: memoryDelta.heapUsed.toFixed(2) + ' MB',
    recordCount: stagedRecords.length,
    recommendation: 'Consider batching commits for large datasets'
  });
}
```

**4. Performance Warnings for Commits Exceeding Time Thresholds**:

```javascript
// In pushToDataLayer() method
const commitStartTime = Date.now();
const WARNING_THRESHOLD = 5000; // 5 seconds
const ERROR_THRESHOLD = 30000; // 30 seconds

try {
  // ... all commit processing ...

  const totalDuration = Date.now() - commitStartTime;

  if (totalDuration > ERROR_THRESHOLD) {
    logger.error('Commit exceeded error threshold', {
      duration: totalDuration,
      threshold: ERROR_THRESHOLD,
      recordCount: stagedRecords.length,
      tableCount: new Set(stagedRecords.map(r => r.table)).size,
      recommendation: 'Investigate performance bottleneck'
    });
  } else if (totalDuration > WARNING_THRESHOLD) {
    logger.warn('Commit exceeded warning threshold', {
      duration: totalDuration,
      threshold: WARNING_THRESHOLD,
      recordCount: stagedRecords.length,
      tableCount: new Set(stagedRecords.map(r => r.table)).size
    });
  } else {
    logger.info('Commit completed successfully', {
      duration: totalDuration,
      recordCount: stagedRecords.length,
      tableCount: new Set(stagedRecords.map(r => r.table)).size
    });
  }
} catch (error) {
  const totalDuration = Date.now() - commitStartTime;
  logger.error('Commit failed', {
    duration: totalDuration,
    error: error.message,
    recordCount: stagedRecords.length
  });
  throw error;
}
```

**5. Complete Monitoring Implementation Example**:

```javascript
// In src/models/v2/staging-v2.model.js - pushToDataLayer() method

static async pushToDataLayer(tableToPush, comment, author, ids = []) {
  const commitStartTime = Date.now();
  const memoryBefore = process.memoryUsage();
  const monitor = {
    rpcCount: 0,
    modelTimings: {},
    stages: {}
  };

  try {
    // Stage 1: Read staging records
    const stage1Start = Date.now();
    const stagedRecords = await StagingV2.findAll({ where: whereClause, raw: true });
    monitor.stages.readStaging = Date.now() - stage1Start;

    // Stage 2: Fetch metadata (track RPC calls)
    const stage2Start = Date.now();
    monitor.rpcCount += 2; // comment + author
    const { registryId } = await OrganizationsV2.getHomeOrg();
    const commentValue = await dataLayer.getValue(registryId, encodeHex('comment'));
    const authorValue = await dataLayer.getValue(registryId, encodeHex('author'));
    monitor.stages.fetchMetadata = Date.now() - stage2Start;

    // Stage 3: Process models (track timing)
    const stage3Start = Date.now();
    const modelResults = await Promise.all(
      modelsToProcess.map(async (ModelClass) => {
        const modelStart = Date.now();
        const result = await ModelClass.generateChangeListFromStagedData(
          stagedRecords, comment, author, registryId, isUpdateComment, isUpdateAuthor
        );
        monitor.modelTimings[ModelClass.name] = Date.now() - modelStart;
        return result;
      })
    );
    monitor.stages.processModels = Date.now() - stage3Start;

    // Stage 4: Merge changelists
    const stage4Start = Date.now();
    const mergedChangeList = mergeChangeLists(modelResults);
    monitor.stages.mergeChangelists = Date.now() - stage4Start;

    // Stage 5: Push to datalayer
    const stage5Start = Date.now();
    monitor.rpcCount += 1; // pushDataLayerChangeList
    await datalayer.pushDataLayerChangeList(registryId, mergedChangeList, failedCallback);
    monitor.stages.pushToDatalayer = Date.now() - stage5Start;

    // Final summary log
    const totalDuration = Date.now() - commitStartTime;
    const memoryAfter = process.memoryUsage();

    logger.info('Commit completed with performance metrics', {
      duration: {
        total: totalDuration,
        stages: monitor.stages,
        models: monitor.modelTimings
      },
      memory: {
        heapUsedDelta: ((memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024).toFixed(2) + ' MB',
        rssDelta: ((memoryAfter.rss - memoryBefore.rss) / 1024 / 1024).toFixed(2) + ' MB'
      },
      rpc: {
        totalCalls: monitor.rpcCount,
        breakdown: {
          metadata: 2,
          push: 1
        }
      },
      data: {
        recordCount: stagedRecords.length,
        tableCount: new Set(stagedRecords.map(r => r.table)).size,
        changelistSize: mergedChangeList.length
      }
    });

    // Performance warnings
    if (totalDuration > 30000) {
      logger.error('Commit exceeded 30 second threshold', { totalDuration });
    } else if (totalDuration > 5000) {
      logger.warn('Commit exceeded 5 second threshold', { totalDuration });
    }

  } catch (error) {
    const totalDuration = Date.now() - commitStartTime;
    logger.error('Commit failed with performance metrics', {
      duration: totalDuration,
      error: error.message,
      metrics: monitor
    });
    throw error;
  }
}
```

**Log Levels to Use**:
- `logger.info()` - Summary metrics, successful commits
- `logger.debug()` - Detailed per-model timing (can be filtered)
- `logger.warn()` - Performance threshold warnings
- `logger.error()` - Errors and critical threshold violations

**Benefits**:
- Identify which models are slow (modelTimings)
- Track RPC call counts (verify optimization is working)
- Monitor memory usage (detect leaks or large commits)
- Performance warnings (alert on slow commits)
- All data is in structured JSON format for easy parsing/analysis

**Summary Recommendations**:
1. **Monitoring (#10)**: ✅ **IMPLEMENTED** - Phase 15.8a adds comprehensive monitoring with timing, RPC tracking, memory usage, and performance warnings
2. **Smart Parallelization (#6)**: Implement dependency grouping and basic batching - simple, low risk
3. **Memory Management (#8)**: Defer unless memory issues observed - only matters for very large commits
4. **Data Transformation (#5)**: Defer unless profiling shows it's a bottleneck - high risk, complex, affects shared utility

**Expected Performance Improvements**:
- **Datalayer RPC calls**: Reduced from 42 to 2 (95% reduction)
- **Database queries**: Reduced from ~63+ to ~23+ (64% reduction for typical commit)
- **Processing time**: 30-50% faster for typical commits with 5-10 tables
- **Memory usage**: 20-30% reduction through batching and early exits

**Error Handling**:
- Failed commits mark records as `failed_commit=true`
- Rollback callbacks restore previous state
- Error messages should be clear and actionable

**Testing Strategy**:
- Test each model's `generateChangeListFromStagedData()` individually
- Test `pushToDataLayer()` with single table
- Test `pushToDataLayer()` with multiple tables
- Test error scenarios (failed commits, invalid data)
- Test V1/V2 isolation
