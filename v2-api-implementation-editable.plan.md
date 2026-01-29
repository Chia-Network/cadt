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
- ✅ **Phase 16**: V2 Organization Management (Complete with all 20 subsections: create, upgrade, read, edit, import/subscribe, delete/sync, mirror operations, and comprehensive tests)
- ✅ **Phase 17**: Audit Endpoints (Complete with 4 endpoints: findAll, findConflicts, resetToGeneration, resetToDate, and comprehensive tests)
- ✅ **Phase 18**: Offer/Transfer Endpoints (Complete with 6 endpoints: generateOfferFile, getCurrentOfferInfo, importOfferFile, commitImportedOffer, cancelActiveOffer, cancelImportedOffer, and comprehensive tests)
- ✅ **Phase 19**: Filestore Endpoints (Complete with 6 endpoints: subscribe, unsubscribe, getFileList, addFile, getFile, deleteFile, and comprehensive tests)
- ✅ **Phase 20**: Projects Advanced Features (Complete with transfer, xlsx, batch upload, and advanced query features: columns, xls export, projectIds filter, generic filter, sorting, and comprehensive tests)
- ✅ **Phase 21**: Units Advanced Features (Complete with split, xlsx, batch upload, and advanced query features: columns, xls export, generic filter, sorting, and comprehensive tests)
- ✅ **Phase 22**: Staging Advanced Features (Complete with offer file generation for project transfers)
- ✅ **Phase 23**: Governance Advanced Features (Complete with subscribe endpoint)
- ✅ **Phase 24**: V2 API Documentation (Complete with comprehensive documentation for all V2 endpoints)
- ✅ **Phase 25**: Add orgUid Field to Projects and Units Tables (Complete - orgUid automatically set from home organization, validation rejects user-provided orgUid, filtering support added, all tests passing)
- ✅ **Phase 26**: Full-Text Search (FTS5) Implementation (Complete - FTS5 tables and triggers created, search methods implemented for Projects and Units, comprehensive integration tests passing, all 35 FTS tests passing)
- ✅ **Phase 27**: Datalayer Registry Sync Background Tasks (Complete - Automatic organization import, registry data sync, organization metadata sync tasks, ModelKeysV2 utility, MetaV2 methods, V2 mutexes, comprehensive sync logic implemented, basic tests passing)
- ✅ **Phase 28**: Additional V2 Background Tasks (Complete - Mirror check, organization validation, picklist syncing, failed org cleanup tasks implemented and registered, basic tests passing)
- ✅ **Phase 29**: Websocket Support for V2 (Complete - ProjectV2 and UnitV2 websocket support implemented, websocket handler updated, basic tests passing)
- ✅ **Phase 31**: Marketplace and Tokenization Features (Complete - Added marketplace fields to Units table, query parameters for marketplace filtering, project-level marketplace filtering, FTS integration, comprehensive tests (23 tests passing), and API documentation)

**CURRENT STATUS:** ✅ V2 API is fully implemented with 22 endpoints (21 data endpoints + 1 governance system endpoint). ✅ Datalayer sync integration complete - V2 can commit staged records to Chia datalayer. ✅ V2 Organization Management complete - Full organization lifecycle management with create, upgrade, import, subscription, and mirror operations. ✅ Offer/Transfer Endpoints complete - Full offer generation, import, commit, and cancellation functionality. ✅ Filestore Endpoints complete - Full file storage and management functionality. ✅ Projects Advanced Features complete - Transfer, XLSX import, CSV batch upload, and advanced query features. ✅ Units Advanced Features complete - Split, XLSX import, CSV batch upload, and advanced query features. ✅ Staging Advanced Features complete - Offer file generation for project transfers. ✅ Governance Advanced Features complete - Subscribe to governance body functionality. ✅ V2 API Documentation complete - Comprehensive documentation for all V2 endpoints following V1 structure and style. ✅ orgUid Field Integration complete - Projects and Units tables now include orgUid field with automatic assignment from home organization. ✅ FTS5 Implementation complete - Full-text search with BM25 ranking, automatic triggers, orgUid filtering, and comprehensive test coverage (35 tests passing). ✅ Datalayer Registry Sync Background Tasks complete - Automatic organization import, registry data sync, and organization metadata sync tasks implemented with comprehensive sync logic. ✅ Additional V2 Background Tasks complete - Mirror check, organization validation, picklist syncing, and failed org cleanup tasks implemented. ✅ Websocket Support for V2 complete - Real-time change notifications for ProjectV2 and UnitV2 models implemented. ✅ Marketplace and Tokenization Features complete - Marketplace fields added to Units table, query parameters for marketplace filtering, project-level marketplace filtering, FTS integration, comprehensive tests (23 tests passing), and API documentation.

**PENDING PHASES:**
- 🔄 **Phase 30**: Unified Configuration File Migration (Pending - Migrate from separate V1/V2 config files to unified config.yaml with APP/V1/V2 sections, implement migration logic, update all config loading code)

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

## Phase 16: V2 Organization Management ✅ COMPLETE

**Phase Overview**: Implement V2 organization creation and upgrade functionality, enabling new users to create V2-only organizations and existing V1 users to upgrade to V2.

**STATUS**: ✅ **COMPLETE** - All 20 subsections (16.1-16.20) implemented and tested. V2 organization management is fully operational.

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

---

## Phase 17: Audit Endpoints ✅ COMPLETE

Implement V2 audit functionality for tracking data history and managing conflicts.

### 17.1 AuditV2 Model: Core Methods

Create model methods for audit operations.

**File**: `src/models/v2/audit-v2.model.js`

**Methods to Implement**:
1. `findAll(orgUid, order, limit, page)` - Get audit history with pagination
2. `findConflicts(orgUid)` - Find conflicts in audit history
3. `resetToGeneration(orgUid, generation)` - Reset organization to specific generation
4. `resetToDate(orgUid, date)` - Reset organization to specific date

**Implementation Notes**:
- Follow V1 audit model structure
- Use V2 database schema (snake_case)
- Ensure V1/V2 isolation
- Support pagination for findAll
- Validate orgUid exists in V2 organizations

**Checkpoint 17.1**: Verify model methods work correctly

```bash
# Test model methods
node -e "import('./src/models/v2/audit-v2.model.js').then(m => console.log('AuditV2 model loaded'))"
```

### 17.2 AuditV2 Controller: Read Endpoints

Create controller endpoints for audit read operations.

**File**: `src/controllers/v2/audit-v2.controller.js`

**Endpoints to Implement**:
1. `findAll(req, res)` - GET /v2/audit (with query params: orgUid, order, limit, page)
2. `findConflicts(req, res)` - GET /v2/audit/findConflicts (with query param: orgUid)

**Implementation Notes**:
- Validate query parameters
- Use pagination helpers
- Return proper error responses
- Follow V1 response format

**Checkpoint 17.2**: Verify controller endpoints work correctly

### 17.3 AuditV2 Controller: Reset Endpoints

Create controller endpoints for audit reset operations.

**File**: `src/controllers/v2/audit-v2.controller.js`

**Endpoints to Implement**:
1. `resetToGeneration(req, res)` - POST /v2/audit/resetToGeneration
2. `resetToDate(req, res)` - POST /v2/audit/resetToDate

**Implementation Notes**:
- Validate request body (orgUid, generation/date)
- Add assertions for V2 read-only mode and home org existence
- Implement reset logic following V1 patterns
- Return proper success/error responses

**Checkpoint 17.3**: Verify reset endpoints work correctly

### 17.4 AuditV2 Routes

Create routes for audit endpoints.

**File**: `src/routes/v2/resources/audit-v2.js`

**Routes to Implement**:
- GET `/v2/audit` - findAll
- GET `/v2/audit/findConflicts` - findConflicts
- POST `/v2/audit/resetToGeneration` - resetToGeneration
- POST `/v2/audit/resetToDate` - resetToDate

**Implementation Notes**:
- Add routes to V2 router in `src/routes/v2/index.js`
- Use validation middleware for query/body params
- Follow V1 route structure

**Checkpoint 17.4**: Verify routes are registered correctly

### 17.5 AuditV2 Integration Tests

Create comprehensive integration tests for audit endpoints.

**File**: `tests/v2/integration/audit-v2.spec.js`

**Test Cases**:
1. GET /v2/audit - Get audit history with pagination
2. GET /v2/audit - Get audit history filtered by orgUid
3. GET /v2/audit - Get audit history with ordering
4. GET /v2/audit/findConflicts - Find conflicts
5. POST /v2/audit/resetToGeneration - Reset to generation
6. POST /v2/audit/resetToDate - Reset to date
7. Error handling - Invalid orgUid
8. Error handling - Missing required parameters
9. V1/V2 isolation - Verify V2 audit doesn't affect V1

**Checkpoint 17.5**: Run tests and verify all pass

```bash
# Run audit tests
NODE_ENV=test USE_SIMULATOR=true npx mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/audit-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies all audit tests pass**

---

## Phase 18: Offer/Transfer Endpoints ✅ COMPLETE

Implement V2 offer functionality for project transfers between organizations.

### 18.1 OfferV2 Model: Core Methods

Create model methods for offer operations.

**File**: `src/models/v2/offer-v2.model.js`

**Methods to Implement**:
1. `generateOfferFile()` - Generate offer file from staging
2. `getCurrentOfferInfo()` - Get details of currently uploaded offer
3. `importOfferFile(file)` - Import and parse offer file
4. `commitImportedOffer()` - Commit imported offer file
5. `cancelActiveOffer()` - Cancel active offer
6. `cancelImportedOffer()` - Reject imported offer file

**Implementation Notes**:
- Follow V1 offer model structure
- Use V2 staging table
- Ensure V1/V2 isolation
- Handle file uploads (multer)
- Validate offer file format

**Checkpoint 18.1**: Verify model methods work correctly

### 18.2 OfferV2 Controller: All Endpoints

Create controller endpoints for all offer operations.

**File**: `src/controllers/v2/offer-v2.controller.js`

**Endpoints to Implement**:
1. `generateOfferFile(req, res)` - GET /v2/offer
2. `getCurrentOfferInfo(req, res)` - GET /v2/offer/accept
3. `importOfferFile(req, res)` - POST /v2/offer/accept/import (with file upload)
4. `commitImportedOffer(req, res)` - POST /v2/offer/accept/commit
5. `cancelActiveOffer(req, res)` - DELETE /v2/offer
6. `cancelImportedOffer(req, res)` - DELETE /v2/offer/accept/cancel

**Implementation Notes**:
- Add assertions for V2 read-only mode and home org existence
- Handle file uploads with multer
- Validate offer file format
- Follow V1 response format
- Return proper error responses

**Checkpoint 18.2**: Verify controller endpoints work correctly

### 18.3 OfferV2 Routes

Create routes for offer endpoints.

**File**: `src/routes/v2/resources/offer-v2.js`

**Routes to Implement**:
- GET `/v2/offer` - generateOfferFile
- GET `/v2/offer/accept` - getCurrentOfferInfo
- POST `/v2/offer/accept/import` - importOfferFile (with multer)
- POST `/v2/offer/accept/commit` - commitImportedOffer
- DELETE `/v2/offer` - cancelActiveOffer
- DELETE `/v2/offer/accept/cancel` - cancelImportedOffer

**Implementation Notes**:
- Add routes to V2 router in `src/routes/v2/index.js`
- Configure multer for file uploads
- Follow V1 route structure

**Checkpoint 18.3**: Verify routes are registered correctly

### 18.4 OfferV2 Integration Tests

Create comprehensive integration tests for offer endpoints.

**File**: `tests/v2/integration/offer-v2.spec.js`

**Test Cases**:
1. GET /v2/offer - Generate offer file
2. GET /v2/offer/accept - Get current offer info (no offer)
3. POST /v2/offer/accept/import - Import offer file
4. GET /v2/offer/accept - Get current offer info (with offer)
5. POST /v2/offer/accept/commit - Commit imported offer
6. DELETE /v2/offer - Cancel active offer
7. DELETE /v2/offer/accept/cancel - Reject imported offer
8. Error handling - Invalid offer file format
9. Error handling - Missing required parameters
10. V1/V2 isolation - Verify V2 offers don't affect V1

**Checkpoint 18.4**: Run tests and verify all pass

```bash
# Run offer tests
NODE_ENV=test USE_SIMULATOR=true npx mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/offer-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies all offer tests pass**

---

## Phase 19: Filestore Endpoints

Implement V2 filestore functionality for file storage and management.

### 19.1 FilestoreV2 Model: Core Methods

Create model methods for filestore operations.

**File**: `src/models/v2/filestore-v2.model.js`

**Methods to Implement**:
1. `getFile(fileId)` - Get file by ID
2. `getFileList()` - List all files in filestore
3. `addFile(file, metadata)` - Add file to filestore
4. `subscribeToFileStore(storeId)` - Subscribe to filestore
5. `unsubscribeFromFileStore(storeId)` - Unsubscribe from filestore
6. `deleteFile(fileId)` - Delete file from filestore

**Implementation Notes**:
- Follow V1 filestore model structure
- Use V2 datalayer integration
- Ensure V1/V2 isolation
- Handle file uploads
- Validate file IDs and store IDs

**Checkpoint 19.1**: Verify model methods work correctly

### 19.2 FilestoreV2 Controller: All Endpoints

Create controller endpoints for all filestore operations.

**File**: `src/controllers/v2/filestore-v2.controller.js`

**Endpoints to Implement**:
1. `getFile(req, res)` - GET /v2/filestore/get_file
2. `getFileList(req, res)` - GET /v2/filestore/get_file_list
3. `addFile(req, res)` - POST /v2/filestore/add_file (with file upload)
4. `subscribeToFileStore(req, res)` - POST /v2/filestore/subscribe
5. `unsubscribeFromFileStore(req, res)` - POST /v2/filestore/unsubscribe
6. `deleteFile(req, res)` - DELETE /v2/filestore/delete_file

**Implementation Notes**:
- Add assertions for V2 read-only mode and home org existence
- Handle file uploads with multer
- Validate file IDs and store IDs
- Follow V1 response format
- Return proper error responses

**Checkpoint 19.2**: Verify controller endpoints work correctly

### 19.3 FilestoreV2 Routes

Create routes for filestore endpoints.

**File**: `src/routes/v2/resources/filestore-v2.js`

**Routes to Implement**:
- GET `/v2/filestore/get_file` - getFile
- GET `/v2/filestore/get_file_list` - getFileList
- POST `/v2/filestore/add_file` - addFile (with multer)
- POST `/v2/filestore/subscribe` - subscribeToFileStore
- POST `/v2/filestore/unsubscribe` - unsubscribeFromFileStore
- DELETE `/v2/filestore/delete_file` - deleteFile

**Implementation Notes**:
- Add routes to V2 router in `src/routes/v2/index.js`
- Configure multer for file uploads
- Follow V1 route structure

**Checkpoint 19.3**: Verify routes are registered correctly

### 19.4 FilestoreV2 Integration Tests

Create comprehensive integration tests for filestore endpoints.

**File**: `tests/v2/integration/filestore-v2.spec.js`

**Test Cases**:
1. GET /v2/filestore/get_file - Get file by ID
2. GET /v2/filestore/get_file_list - List files
3. POST /v2/filestore/add_file - Add file to filestore
4. POST /v2/filestore/subscribe - Subscribe to filestore
5. POST /v2/filestore/unsubscribe - Unsubscribe from filestore
6. DELETE /v2/filestore/delete_file - Delete file
7. Error handling - Invalid file ID
8. Error handling - Missing required parameters
9. V1/V2 isolation - Verify V2 filestore doesn't affect V1

**Checkpoint 19.4**: Run tests and verify all pass

```bash
# Run filestore tests
NODE_ENV=test USE_SIMULATOR=true npx mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/filestore-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies all filestore tests pass**

---

## Phase 20: Projects Advanced Features ✅ COMPLETE

Implement advanced features for Projects endpoint: transfer, XLSX import, batch upload, and advanced query parameters.

### 20.1 ProjectV2 Model: Advanced Methods

Add advanced methods to ProjectV2 model.

**File**: `src/models/v2/project-v2.model.js`

**Methods to Implement**:
1. `transfer(projectId, targetOrgUid)` - Transfer project between organizations
2. `updateFromXLS(file)` - Update projects from XLSX file
3. `batchUpload(csvData)` - Batch upload from CSV

**Implementation Notes**:
- Follow V1 project transfer logic
- Use V2 staging table for transfers
- Validate target organization exists
- Handle XLSX/CSV parsing
- Support bulk operations

**Checkpoint 20.1**: Verify model methods work correctly

### 20.2 ProjectV2 Controller: Advanced Endpoints

Add advanced endpoints to ProjectV2 controller.

**File**: `src/controllers/v2/project-v2.controller.js`

**Endpoints to Implement**:
1. `transfer(req, res)` - PUT /v2/project/transfer
2. `updateFromXLS(req, res)` - PUT /v2/project/xlsx (with file upload)
3. `batchUpload(req, res)` - POST /v2/project/batch (with CSV file upload)

**Implementation Notes**:
- Add assertions for V2 read-only mode and home org existence
- Handle file uploads with multer
- Validate request data
- Follow V1 response format

**Checkpoint 20.2**: Verify controller endpoints work correctly

### 20.3 ProjectV2 Controller: Advanced Query Features

Enhance findAll method with advanced query parameters.

**File**: `src/controllers/v2/project-v2.controller.js`

**Query Parameters to Add**:
- `search` - Full-text search
- `orgUid` - Filter by organization
- `columns` - Select specific columns
- `xls` - Export to Excel
- `onlyMarketplaceProjects` - Filter marketplace projects
- `projectIds` - Filter by project IDs
- `filter` - Generic filter (e.g., `filter=field:value:eq`)
- `order` - Sort order (e.g., `order=field:DESC`)

**Implementation Notes**:
- Enhance existing findAll method
- Add full-text search support (FTS)
- Implement column selection
- Add Excel export functionality
- Support generic filtering
- Support sorting

**Checkpoint 20.3**: Verify advanced query features work correctly

### 20.4 ProjectV2 Routes: Advanced Endpoints

Add routes for advanced project endpoints.

**File**: `src/routes/v2/resources/project-v2.js`

**Routes to Add**:
- PUT `/v2/project/transfer` - transfer
- PUT `/v2/project/xlsx` - updateFromXLS (with multer)
- POST `/v2/project/batch` - batchUpload (with multer)

**Implementation Notes**:
- Configure multer for file uploads
- Ensure route ordering (specific routes before generic)
- Follow V1 route structure

**Checkpoint 20.4**: Verify routes are registered correctly

### 20.5 ProjectV2 Integration Tests: Advanced Features

Create comprehensive integration tests for advanced project features.

**File**: `tests/v2/integration/project-v2.spec.js` (add to existing file)

**Test Cases to Add**:
1. PUT /v2/project/transfer - Transfer project
2. PUT /v2/project/xlsx - Update from XLSX
3. POST /v2/project/batch - Batch upload from CSV
4. GET /v2/project?search=keyword - Full-text search
5. GET /v2/project?orgUid=xxx - Filter by orgUid
6. GET /v2/project?columns=field1&columns=field2 - Column selection
7. GET /v2/project?xls=true - Excel export
8. GET /v2/project?onlyMarketplaceProjects=true - Marketplace filter
9. GET /v2/project?filter=field:value:eq - Generic filter
10. GET /v2/project?order=field:DESC - Sorting
11. Error handling - Invalid file format
12. Error handling - Invalid target orgUid
13. V1/V2 isolation - Verify V2 operations don't affect V1

**Checkpoint 20.5**: Run tests and verify all pass

```bash
# Run project tests
NODE_ENV=test USE_SIMULATOR=true npx mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/project-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies all project advanced feature tests pass**

---

## Phase 21: Units Advanced Features ✅ COMPLETE

Implement advanced features for Units endpoint: split, XLSX import, batch upload, and advanced query parameters.

### 21.1 UnitV2 Model: Advanced Methods

Add advanced methods to UnitV2 model.

**File**: `src/models/v2/unit-v2.model.js`

**Methods to Implement**:
1. `split(unitId, records)` - Split units into multiple units
2. `updateFromXLS(file)` - Update units from XLSX file
3. `batchUpload(csvData)` - Batch upload from CSV

**Implementation Notes**:
- Follow V1 unit split logic
- Use V2 staging table for operations
- Validate split records
- Handle XLSX/CSV parsing
- Support bulk operations

**Checkpoint 21.1**: Verify model methods work correctly

### 21.2 UnitV2 Controller: Advanced Endpoints

Add advanced endpoints to UnitV2 controller.

**File**: `src/controllers/v2/unit-v2.controller.js`

**Endpoints to Implement**:
1. `split(req, res)` - POST /v2/unit/split
2. `updateFromXLS(req, res)` - PUT /v2/unit/xlsx (with file upload)
3. `batchUpload(req, res)` - POST /v2/unit/batch (with CSV file upload)

**Implementation Notes**:
- Add assertions for V2 read-only mode and home org existence
- Handle file uploads with multer
- Validate request data
- Follow V1 response format

**Checkpoint 21.2**: Verify controller endpoints work correctly

### 21.3 UnitV2 Controller: Advanced Query Features

Enhance findAll method with advanced query parameters.

**File**: `src/controllers/v2/unit-v2.controller.js`

**Query Parameters to Add**:
- `search` - Full-text search
- `orgUid` - Filter by organization
- `columns` - Select specific columns
- `xls` - Export to Excel
- `includeProjectInfoInSearch` - Include project info in search
- `marketplaceIdentifiers` - Filter by marketplace identifiers
- `hasMarketplaceIdentifier` - Filter units with marketplace identifiers
- `onlyTokenizedUnits` - Filter tokenized units
- `filter` - Generic filter (e.g., `filter=field:value:eq`)
- `order` - Sort order (e.g., `order=field:DESC`)

**Implementation Notes**:
- Enhance existing findAll method
- Add full-text search support (FTS)
- Implement column selection
- Add Excel export functionality
- Support generic filtering
- Support sorting
- Support project info in search

**Checkpoint 21.3**: Verify advanced query features work correctly

### 21.4 UnitV2 Routes: Advanced Endpoints

Add routes for advanced unit endpoints.

**File**: `src/routes/v2/resources/unit-v2.js`

**Routes to Add**:
- POST `/v2/unit/split` - split
- PUT `/v2/unit/xlsx` - updateFromXLS (with multer)
- POST `/v2/unit/batch` - batchUpload (with multer)

**Implementation Notes**:
- Configure multer for file uploads
- Ensure route ordering (specific routes before generic)
- Follow V1 route structure

**Checkpoint 21.4**: Verify routes are registered correctly

### 21.5 UnitV2 Integration Tests: Advanced Features

Create comprehensive integration tests for advanced unit features.

**File**: `tests/v2/integration/unit-v2.spec.js` (add to existing file)

**Test Cases to Add**:
1. POST /v2/unit/split - Split units
2. PUT /v2/unit/xlsx - Update from XLSX
3. POST /v2/unit/batch - Batch upload from CSV
4. GET /v2/unit?search=keyword - Full-text search
5. GET /v2/unit?orgUid=xxx - Filter by orgUid
6. GET /v2/unit?columns=field1&columns=field2 - Column selection
7. GET /v2/unit?xls=true - Excel export
8. GET /v2/unit?includeProjectInfoInSearch=true - Project info in search
9. GET /v2/unit?marketplaceIdentifiers=xxx - Marketplace filter
10. GET /v2/unit?onlyTokenizedUnits=true - Tokenized units filter
11. GET /v2/unit?filter=field:value:eq - Generic filter
12. GET /v2/unit?order=field:DESC - Sorting
13. Error handling - Invalid file format
14. Error handling - Invalid split records
15. V1/V2 isolation - Verify V2 operations don't affect V1

**Checkpoint 21.5**: Run tests and verify all pass

```bash
# Run unit tests
NODE_ENV=test USE_SIMULATOR=true npx mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/unit-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies all unit advanced feature tests pass**

---

## Phase 22: Staging Advanced Features ✅ COMPLETE

Implement advanced staging feature: offer file generation.

### 22.1 StagingV2 Controller: Offer File Generation

Add offer file generation endpoint to staging controller.

**File**: `src/controllers/v2/staging-v2.controller.js`

**Endpoint to Implement**:
1. `generateOfferFile(req, res)` - GET /v2/staging/offer

**Implementation Notes**:
- Follow V1 staging offer file generation logic
- Use V2 staging table
- Generate offer file format compatible with V1
- Return file download response

**Checkpoint 22.1**: Verify controller endpoint works correctly

### 22.2 StagingV2 Routes: Offer Endpoint

Add route for staging offer file generation.

**File**: `src/routes/v2/resources/staging-v2.js`

**Route to Add**:
- GET `/v2/staging/offer` - generateOfferFile

**Implementation Notes**:
- Ensure route ordering (specific routes before generic)
- Follow V1 route structure

**Checkpoint 22.2**: Verify route is registered correctly

### 22.3 StagingV2 Integration Tests: Offer Feature

Add integration test for staging offer file generation.

**File**: `tests/v2/integration/staging-v2.spec.js` (add to existing file)

**Test Cases to Add**:
1. GET /v2/staging/offer - Generate offer file from staging
2. GET /v2/staging/offer - Generate offer file with no staging records
3. Error handling - Invalid staging state

**Checkpoint 22.3**: Run tests and verify all pass

```bash
# Run staging tests
NODE_ENV=test USE_SIMULATOR=true npx mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/staging-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies all staging advanced feature tests pass**

---

## Phase 23: Governance Advanced Features ✅ COMPLETE

Implement governance subscribe endpoint.

### 23.1 GovernanceV2 Controller: Subscribe Endpoint

Add subscribe endpoint to governance controller.

**File**: `src/controllers/v2/governance-v2.controller.js`

**Endpoint to Implement**:
1. `subscribeToGovernanceBody(req, res)` - POST /v2/governance/subscribe

**Implementation Notes**:
- Follow V1 governance subscribe logic
- Validate request body (governance body identifier)
- Use V2 datalayer integration
- Return proper success/error responses

**Checkpoint 23.1**: Verify controller endpoint works correctly

### 23.2 GovernanceV2 Routes: Subscribe Endpoint

Add route for governance subscribe.

**File**: `src/routes/v2/resources/governance-v2.js`

**Route to Add**:
- POST `/v2/governance/subscribe` - subscribeToGovernanceBody

**Implementation Notes**:
- Add validation middleware
- Follow V1 route structure

**Checkpoint 23.2**: Verify route is registered correctly

### 23.3 GovernanceV2 Integration Tests: Subscribe Feature

Add integration test for governance subscribe.

**File**: `tests/v2/integration/governance-v2.spec.js` (add to existing file)

**Test Cases to Add**:
1. POST /v2/governance/subscribe - Subscribe to governance body
2. Error handling - Invalid governance body identifier
3. Error handling - Missing required parameters
4. V1/V2 isolation - Verify V2 subscription doesn't affect V1

**Checkpoint 23.3**: Run tests and verify all pass

```bash
# Run governance tests
NODE_ENV=test USE_SIMULATOR=true npx mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/governance-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies all governance advanced feature tests pass**

---

## Phase 24: V2 API Documentation

Create comprehensive API documentation for ALL V2 API endpoints following the V1 documentation structure and style.

**File Location**: `/docs/cadt_rpc_api_v2.md`

**Documentation Requirements**:

1. **Structure and Format**:
   - Follow the exact formatting, style, and structure of `/docs/cadt_rpc_api.md`
   - Use same markdown structure (headers, code blocks, tables)
   - Maintain same level of detail as V1 documentation
   - Can be slightly more thorough where helpful, but not significantly more detailed
   - Include same table of contents structure with links to all sections

2. **Content Sections**:
   - **Introduction**: Update to reference V2 API (`/v2` instead of `/v1`)
   - **Workflow Description**: Update staging workflow description for V2 (same concept, V2-specific details)
   - **All Endpoint Sections**: Document all V2 endpoints organized by resource type
   - Use same example data from V1 where applicable
   - Create new example data for V2-specific endpoints and data models

3. **All V2 Endpoints to Document** (organized by section - document ALL actual endpoints):

   **Organizations** (15 endpoints):
   - `GET /v2/organizations` - List all organizations
   - `GET /v2/organizations/status` - Get home org sync status
   - `GET /v2/organizations/metadata` - Get metadata (with orgUid query param)
   - `POST /v2/organizations` - Create V2 home org (new users) - supports both JSON body and file upload
   - `POST /v2/organizations/upgrade` - Upgrade from V1 to V2 (existing users)
   - `POST /v2/organizations/metadata` - Add metadata to home organization
   - `POST /v2/organizations/sync` - Sync organization metadata
   - `POST /v2/organizations/mirror` - Add mirror for a store
   - `POST /v2/organizations/remove-mirror` - Remove mirror for a store
   - `PUT /v2/organizations/edit` - Edit home organization (name and/or icon) - supports file upload
   - `PUT /v2/organizations` - Import organization from datalayer
   - `PUT /v2/organizations/subscribe` - Subscribe to organization
   - `PUT /v2/organizations/unsubscribe` - Unsubscribe from organization
   - `PUT /v2/organizations/resync` - Resync organization
   - `DELETE /v2/organizations/:orgUid` - Delete organization

   **Core Data Endpoints** (8 resource types, 5 CRUD operations each = 40 endpoints):
   - `methodology`:
     - `POST /v2/methodology` - Create methodology
     - `GET /v2/methodology` - List all methodologies
     - `GET /v2/methodology/:id` - Get single methodology
     - `PUT /v2/methodology/:id` - Update methodology
     - `DELETE /v2/methodology/:id` - Delete methodology
   - `program`:
     - `POST /v2/program` - Create program
     - `GET /v2/program` - List all programs
     - `GET /v2/program/:id` - Get single program
     - `PUT /v2/program/:id` - Update program
     - `DELETE /v2/program/:id` - Delete program
   - `project`:
     - `POST /v2/project` - Create project
     - `GET /v2/project` - List all projects
     - `GET /v2/project/:id` - Get single project
     - `PUT /v2/project/:id` - Update project
     - `DELETE /v2/project/:id` - Delete project
   - `validation`:
     - `POST /v2/validation` - Create validation
     - `GET /v2/validation` - List all validations
     - `GET /v2/validation/:id` - Get single validation
     - `PUT /v2/validation/:id` - Update validation
     - `DELETE /v2/validation/:id` - Delete validation
   - `verification`:
     - `POST /v2/verification` - Create verification
     - `GET /v2/verification` - List all verifications
     - `GET /v2/verification/:id` - Get single verification
     - `PUT /v2/verification/:id` - Update verification
     - `DELETE /v2/verification/:id` - Delete verification
   - `issuance`:
     - `POST /v2/issuance` - Create issuance
     - `GET /v2/issuance` - List all issuances
     - `GET /v2/issuance/:id` - Get single issuance
     - `PUT /v2/issuance/:id` - Update issuance
     - `DELETE /v2/issuance/:id` - Delete issuance
   - `unit`:
     - `POST /v2/unit` - Create unit
     - `GET /v2/unit` - List all units
     - `GET /v2/unit/:id` - Get single unit
     - `PUT /v2/unit/:id` - Update unit
     - `DELETE /v2/unit/:id` - Delete unit
   - `location`:
     - `POST /v2/location` - Create location
     - `GET /v2/location` - List all locations
     - `GET /v2/location/:id` - Get single location
     - `PUT /v2/location/:id` - Update location
     - `DELETE /v2/location/:id` - Delete location

   **Tier 1 Dependencies** (3 resource types, 5 CRUD operations each = 15 endpoints):
   - `estimation`:
     - `POST /v2/estimation` - Create estimation
     - `GET /v2/estimation` - List all estimations
     - `GET /v2/estimation/:id` - Get single estimation
     - `PUT /v2/estimation/:id` - Update estimation
     - `DELETE /v2/estimation/:id` - Delete estimation
   - `rating`:
     - `POST /v2/rating` - Create rating
     - `GET /v2/rating` - List all ratings
     - `GET /v2/rating/:id` - Get single rating
     - `PUT /v2/rating/:id` - Update rating
     - `DELETE /v2/rating/:id` - Delete rating
   - `co-benefit`:
     - `POST /v2/co-benefit` - Create co-benefit
     - `GET /v2/co-benefit` - List all co-benefits
     - `GET /v2/co-benefit/:id` - Get single co-benefit
     - `PUT /v2/co-benefit/:id` - Update co-benefit
     - `DELETE /v2/co-benefit/:id` - Delete co-benefit

   **Tier 4 Join Tables** (5 resource types with varying route patterns):
   - `project-methodology`:
     - `POST /v2/project-methodology` - Create project-methodology relationship
     - `GET /v2/project-methodology` - List all project-methodology relationships
     - `GET /v2/project-methodology/project/:projectId/methodology/:methodologyId` - Get single relationship
     - `PUT /v2/project-methodology/project/:projectId/methodology/:methodologyId` - Update relationship
     - `DELETE /v2/project-methodology/project/:projectId/methodology/:methodologyId` - Delete relationship
   - `stakeholder`:
     - `POST /v2/stakeholder` - Create stakeholder
     - `GET /v2/stakeholder` - List all stakeholders
     - `GET /v2/stakeholder/:id` - Get single stakeholder
     - `PUT /v2/stakeholder/:id` - Update stakeholder
     - `DELETE /v2/stakeholder/:id` - Delete stakeholder
   - `stakeholder-projects`:
     - `POST /v2/stakeholder-projects` - Create stakeholder-project relationship
     - `GET /v2/stakeholder-projects` - List all stakeholder-project relationships
     - `GET /v2/stakeholder-projects/:id` - Get single relationship
     - `PUT /v2/stakeholder-projects/:id` - Update relationship
     - `DELETE /v2/stakeholder-projects/:id` - Delete relationship
   - `label`:
     - `POST /v2/label` - Create label
     - `GET /v2/label` - List all labels
     - `GET /v2/label/:id` - Get single label
     - `PUT /v2/label/:id` - Update label
     - `DELETE /v2/label/:id` - Delete label
   - `unit-label`:
     - `POST /v2/unit-label` - Create unit-label relationship
     - `GET /v2/unit-label` - List all unit-label relationships
     - `GET /v2/unit-label/:cadTrustLabelId/:cadTrustUnitId` - Get single relationship (composite key)
     - `PUT /v2/unit-label/:cadTrustLabelId/:cadTrustUnitId` - Update relationship
     - `DELETE /v2/unit-label/:cadTrustLabelId/:cadTrustUnitId` - Delete relationship

   **Tier 5 AEF Tables** (5 resource types, 5 CRUD operations each = 25 endpoints):
   - `aef-t1-submission`:
     - `POST /v2/aef-t1-submission` - Create AEF-T1-Submission
     - `GET /v2/aef-t1-submission` - List all AEF-T1-Submissions
     - `GET /v2/aef-t1-submission/:cadTrustAefT1SubmissionId` - Get single submission
     - `PUT /v2/aef-t1-submission/:cadTrustAefT1SubmissionId` - Update submission
     - `DELETE /v2/aef-t1-submission/:cadTrustAefT1SubmissionId` - Delete submission
   - `aef-t5-authorized-entities`:
     - `POST /v2/aef-t5-authorized-entities` - Create AEF-T5-Authorized-Entities
     - `GET /v2/aef-t5-authorized-entities` - List all AEF-T5-Authorized-Entities
     - `GET /v2/aef-t5-authorized-entities/:cadTrustAefT5AuthorizedEntitiesId` - Get single entity
     - `PUT /v2/aef-t5-authorized-entities/:cadTrustAefT5AuthorizedEntitiesId` - Update entity
     - `DELETE /v2/aef-t5-authorized-entities/:cadTrustAefT5AuthorizedEntitiesId` - Delete entity
   - `aef-t2-authorizations`:
     - `POST /v2/aef-t2-authorizations` - Create AEF-T2-Authorizations
     - `GET /v2/aef-t2-authorizations` - List all AEF-T2-Authorizations
     - `GET /v2/aef-t2-authorizations/:cadTrustAefT2AuthorizationsId` - Get single authorization
     - `PUT /v2/aef-t2-authorizations/:cadTrustAefT2AuthorizationsId` - Update authorization
     - `DELETE /v2/aef-t2-authorizations/:cadTrustAefT2AuthorizationsId` - Delete authorization
   - `aef-t3-actions`:
     - `POST /v2/aef-t3-actions` - Create AEF-T3-Actions
     - `GET /v2/aef-t3-actions` - List all AEF-T3-Actions
     - `GET /v2/aef-t3-actions/:cadTrustAefT3ActionsId` - Get single action
     - `PUT /v2/aef-t3-actions/:cadTrustAefT3ActionsId` - Update action
     - `DELETE /v2/aef-t3-actions/:cadTrustAefT3ActionsId` - Delete action
   - `aef-t4-holdings`:
     - `POST /v2/aef-t4-holdings` - Create AEF-T4-Holdings
     - `GET /v2/aef-t4-holdings` - List all AEF-T4-Holdings
     - `GET /v2/aef-t4-holdings/:cadTrustAefT4HoldingsId` - Get single holding
     - `PUT /v2/aef-t4-holdings/:cadTrustAefT4HoldingsId` - Update holding
     - `DELETE /v2/aef-t4-holdings/:cadTrustAefT4HoldingsId` - Delete holding

   **System Endpoints**:
   - `governance` (10 endpoints):
     - `GET /v2/governance` - Get all governance data
     - `GET /v2/governance/exists` - Check if governance body exists
     - `GET /v2/governance/sync` - Sync governance data
     - `GET /v2/governance/meta/orgList` - Get organization list
     - `GET /v2/governance/meta/pickList` - Get picklist data
     - `GET /v2/governance/meta/glossary` - Get glossary data
     - `POST /v2/governance` - Create governance body
     - `POST /v2/governance/meta/orgList` - Set organization list
     - `POST /v2/governance/meta/pickList` - Set picklist data
     - `POST /v2/governance/meta/glossary` - Set glossary data
   - `staging` (7 endpoints):
     - `GET /v2/staging` - List staged records (with query params: page, limit, type, table)
     - `GET /v2/staging/pending` - Check for pending commits
     - `POST /v2/staging/commit` - Commit staged records
     - `POST /v2/staging/retry` - Retry failed commit
     - `PUT /v2/staging` - Edit staged record
     - `DELETE /v2/staging` - Delete specific staged record
     - `DELETE /v2/staging/clean` - Clean all staging records

   **Health Check**:
   - `GET /v2/health` - Health check endpoint

4. **Documentation Format for Each Endpoint**:
   - **Functionality**: Brief description
   - **Options/Parameters**: Table format (same as V1) - document query params, body params, etc.
   - **Examples**: Request and Response with curl commands
   - **Notes**: Any important warnings, timing information, or V2-specific behaviors

5. **Example Data Guidelines**:
   - Reuse V1 example data where possible (orgUids, projectIds, unitIds, etc.)
   - For V2-specific endpoints (upgrade, new data models), create new example data
   - Ensure example data is consistent throughout the documentation
   - Use realistic but clearly example data (not production values)
   - Maintain consistency in UUIDs, names, and other identifiers across examples

6. **Key Differences from V1 to Highlight**:
   - V2 uses `/v2` prefix instead of `/v1`
   - V2 field names use camelCase in API (matching database snake_case)
   - V2 organizations: `POST /organizations` supports both JSON body and file upload
   - V2 organizations: Has `/upgrade` endpoint for V1→V2 migration
   - V2 organizations: Edit endpoint is `PUT /organizations/edit` (not `PUT /organizations`)
   - V2 staging: Uses V2-specific staging table and commit process
   - V2 data models: All use UUID v4 primary keys (not auto-increment integers)
   - V2 data models: Foreign key validation checks both main table and staging table

7. **Section Organization** (organize by actual V2 endpoint structure, not V1 structure):
   - Commands table of contents (with links to all sections)
   - Organizations section (detailed - all 15 endpoints)
   - Staging section (V2-specific staging operations - all 7 endpoints)
   - Governance section (all 10 endpoints)
   - Core data model sections (Methodology, Program, Project, Validation, Verification, Issuance, Unit, Location - 5 CRUD operations each)
   - Tier 1 Dependencies sections (Estimation, Rating, Co-Benefit - 5 CRUD operations each)
   - Tier 4 Join Tables sections (Project-Methodology, Stakeholder, Stakeholder-Projects, Label, Unit-Label - note composite key routes where applicable)
   - Tier 5 AEF Tables sections (AEF-T1-Submission, AEF-T5-Authorized-Entities, AEF-T2-Authorizations, AEF-T3-Actions, AEF-T4-Holdings - 5 CRUD operations each)
   - Health Check section
   - Additional resources sections for each endpoint group (match V1 format)

8. **V2-Specific Documentation Notes**:
   - Document staging workflow for V2 (same concept as V1 but V2-specific)
   - Document V1/V2 isolation (V2 operations don't affect V1 data)
   - Document upgrade path from V1 to V2
   - Document any V2-specific validation rules or behaviors
   - Document camelCase field naming convention

**Reference**: V1 documentation at `/docs/cadt_rpc_api.md` (entire file)

**Checkpoint 24.1**: Review documentation for completeness and accuracy

```bash
# Review the generated documentation
cat docs/cadt_rpc_api_v2.md
```

**STOP HERE - User reviews and approves V2 API documentation**

---

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
      data: {label:archived-readytodelete
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

---

## Phase 25: Add orgUid Field to Projects and Units Tables ✅ COMPLETE

Add `orgUid` field to the `project` and `unit` tables to enable direct organization filtering, similar to V1 implementation.

**STATUS**: ✅ **COMPLETE** - All subsections (25.1-25.10) implemented and tested. The `orgUid` field is automatically set from the home organization in both Project and Unit controllers, validation rejects user-provided `orgUid`, filtering by `orgUid` works in `findAll` methods, and all 850 tests pass.

**Goals**:
- Add `org_uid` column to `project` and `unit` tables
- Update API endpoints to accept and return `orgUid` field
- Add validation for `orgUid` in request schemas
- Update tests to account for `orgUid`
- Update API documentation to reflect `orgUid` field

**Important Notes**:
- **No migration needed**: Since there are no production V2 instances, we can simply add the field to the table creation code
- **Database recreation**: Any existing V2 databases can be deleted and recreated
- **Keep it simple**: Don't create complex migrations - just add the field to the table definitions
- **V1 Behavior**: In V1, `orgUid` is automatically set from the home organization - users cannot provide it. We should follow the same pattern in V2.

### 25.1 Update Project Table Schema

Add `org_uid` column to the `project` table definition.

**File**: `src/models/v2/project-v2.model.js`

**Changes**:
1. Add `orgUid` field to model definition:
   ```javascript
   orgUid: {
     type: Sequelize.STRING(64),
     allowNull: false, // Required - automatically set from home organization
     field: 'org_uid',
     comment: 'Organization UID - identifies which organization owns this project. Automatically set from home organization.'
   }
   ```

2. Update table creation in migration/model sync to include the column:
   ```sql
   org_uid VARCHAR(64) NOT NULL
   ```

3. Update mirror model to include `orgUid` field:
   **File**: `src/models/v2/project-v2.model.mirror.js`
   - Add `orgUid` field definition (same as main model)
   - Note: Migrations run on both SQLite and MySQL mirror, so column will be created automatically

**Checkpoint 25.1**: Verify project table includes `org_uid` column after database recreation

### 25.2 Update Unit Table Schema

Add `org_uid` column to the `unit` table definition.

**File**: `src/models/v2/unit-v2.model.js`

**Changes**:
1. Add `orgUid` field to model definition:
   ```javascript
   orgUid: {
     type: Sequelize.STRING(64),
     allowNull: false, // Required - automatically set from home organization
     field: 'org_uid',
     comment: 'Organization UID - identifies which organization owns this unit. Automatically set from home organization.'
   }
   ```

2. Update table creation in migration/model sync to include the column:
   ```sql
   org_uid VARCHAR(64) NOT NULL
   ```

3. Update mirror model to include `orgUid` field:
   **File**: `src/models/v2/unit-v2.model.mirror.js`
   - Add `orgUid` field definition (same as main model)
   - Note: Migrations run on both SQLite and MySQL mirror, so column will be created automatically

**Checkpoint 25.2**: Verify unit table includes `org_uid` column after database recreation

### 25.3 Update Project API Validation Schema

Reject `orgUid` if provided in API requests (it's automatically set by the controller).

**File**: `src/validators/v2/project-v2.validator.js`

**Changes**:
1. **Do NOT add `orgUid` to validation schemas** - it should be rejected if provided
2. Add validation check in controller to reject `orgUid` if present in request body (similar to how `createdAt`, `updatedAt`, `cadTrustProjectId` are rejected)

**Note**: Following V1 pattern - `orgUid` is automatically set from the home organization and cannot be user-provided.

**Checkpoint 25.3**: Verify validation rejects `orgUid` if provided in POST and PUT requests

### 25.4 Update Unit API Validation Schema

Reject `orgUid` if provided in API requests (it's automatically set by the controller).

**File**: `src/validators/v2/unit-v2.validator.js`

**Changes**:
1. **Do NOT add `orgUid` to validation schemas** - it should be rejected if provided
2. Add validation check in controller to reject `orgUid` if present in request body (similar to how `createdAt`, `updatedAt`, `cadTrustUnitId` are rejected)

**Note**: Following V1 pattern - `orgUid` is automatically set from the home organization and cannot be user-provided.

**Checkpoint 25.4**: Verify validation rejects `orgUid` if provided in POST and PUT requests

### 25.5 Update Project Controller

Ensure Project controller automatically sets `orgUid` from home organization (like V1).

**File**: `src/controllers/v2/project-v2.controller.js`

**Changes**:
1. **Reject `orgUid` if provided** in request body (add check similar to `createdAt`/`updatedAt` rejection)
2. **Automatically set `orgUid`** from home organization in `create` method:
   ```javascript
   // Get home organization
   const homeOrg = await OrganizationsV2.getHomeOrg();
   if (!homeOrg) {
     throw new Error('Home organization not found');
   }

   // Set orgUid automatically (user cannot provide it)
   dbRecord.org_uid = homeOrg.orgUid;
   ```
3. **Automatically set `orgUid`** from home organization in `update` method (for non-transfer updates)
4. **Preserve `orgUid`** from original record in transfer operations (if applicable)
5. Verify `orgUid` is included in response serialization (should be automatic via model)
6. Add `orgUid` filtering support to `findAll` method:
   ```javascript
   if (orgUid) {
     if (!where) {
       where = {};
     }
     where.orgUid = orgUid;
   }
   ```

**Checkpoint 25.5**: Test creating/updating projects - verify `orgUid` is automatically set and filtering by `orgUid` works

### 25.6 Update Unit Controller

Ensure Unit controller automatically sets `orgUid` from home organization (like V1).

**File**: `src/controllers/v2/unit-v2.controller.js`

**Changes**:
1. **Reject `orgUid` if provided** in request body (add check similar to `createdAt`/`updatedAt` rejection)
2. **Automatically set `orgUid`** from home organization in `create` method:
   ```javascript
   // Get home organization
   const homeOrg = await OrganizationsV2.getHomeOrg();
   if (!homeOrg) {
     throw new Error('Home organization not found');
   }

   // Set orgUid automatically (user cannot provide it)
   dbRecord.org_uid = homeOrg.orgUid;
   ```
3. **Automatically set `orgUid`** from home organization in `update` method
4. Verify `orgUid` is included in response serialization (should be automatic via model)
5. Add `orgUid` filtering support to `findAll` method:
   ```javascript
   if (orgUid) {
     if (!where) {
       where = {};
     }
     where.orgUid = orgUid;
   }
   ```

**Checkpoint 25.6**: Test creating/updating units - verify `orgUid` is automatically set and filtering by `orgUid` works

### 25.7 Update Project Tests

Update Project tests to account for `orgUid` field.

**Files**:
- `tests/v2/integration/project-v2.spec.js`
- `tests/v2/unit/project-v2.spec.js`

**Changes**:
1. Update test fixtures to expect `orgUid` to be automatically set (not provided in request)
2. Add test cases for:
   - Creating project - verify `orgUid` is automatically set from home organization
   - Rejecting `orgUid` if provided in request body
   - Updating project - verify `orgUid` is automatically set from home organization
   - Filtering projects by `orgUid` query parameter
   - Verifying `orgUid` is returned in responses
3. Update existing tests to account for automatic `orgUid` assignment

**Checkpoint 25.7**: Run Project tests and verify they pass with `orgUid` field

### 25.8 Update Unit Tests

Update Unit tests to account for `orgUid` field.

**Files**:
- `tests/v2/integration/unit-v2.spec.js`
- `tests/v2/unit/unit-v2.spec.js`

**Changes**:
1. Update test fixtures to expect `orgUid` to be automatically set (not provided in request)
2. Add test cases for:
   - Creating unit - verify `orgUid` is automatically set from home organization
   - Rejecting `orgUid` if provided in request body
   - Updating unit - verify `orgUid` is automatically set from home organization
   - Filtering units by `orgUid` query parameter
   - Verifying `orgUid` is returned in responses
3. Update existing tests to account for automatic `orgUid` assignment

**Checkpoint 25.8**: Run Unit tests and verify they pass with `orgUid` field

### 25.9 Update API Documentation

Update V2 API documentation to reflect `orgUid` field in Projects and Units endpoints.

**File**: `docs/cadt_rpc_api_v2.md`

**Changes**:
1. **Projects Section**:
   - Add `orgUid` to field descriptions (note: automatically set, not user-provided)
   - Add `orgUid` to response examples (show it in responses)
   - Document `orgUid` query parameter for filtering (`?orgUid=xxx`)
   - Note that `orgUid` cannot be provided in POST/PUT requests (automatically set from home organization)
   - Update examples to show `orgUid` in responses and filtering usage

2. **Units Section**:
   - Add `orgUid` to field descriptions (note: automatically set, not user-provided)
   - Add `orgUid` to response examples (show it in responses)
   - Document `orgUid` query parameter for filtering (`?orgUid=xxx`)
   - Note that `orgUid` cannot be provided in POST/PUT requests (automatically set from home organization)
   - Update examples to show `orgUid` in responses and filtering usage

**Checkpoint 25.9**: Review documentation to ensure `orgUid` is properly documented

### 25.10 Run Full Test Suite

Run the complete V2 test suite to ensure all changes work correctly together.

**Command**:
```bash
npm run test:v2
```

**Important**: After adding `orgUid` as a required field to `project` and `unit` tables, other test files that create `ProjectV2` or `UnitV2` records directly (not via API) will need to be updated to include `orgUid`. These tests will fail with `notNull Violation` errors until updated.

**Test Files That May Need Updates**:
- `tests/v2/integration/aef-t2-authorizations-v2.spec.js`
- `tests/v2/integration/aef-t3-actions-v2.spec.js`
- `tests/v2/integration/aef-t4-holdings-v2.spec.js`
- `tests/v2/integration/aef-t5-authorized-entities-v2.spec.js`
- `tests/v2/integration/co-benefit-v2.spec.js`
- `tests/v2/integration/estimation-v2.spec.js`
- `tests/v2/integration/issuance-v2.spec.js`
- `tests/v2/integration/location-v2.spec.js`
- `tests/v2/integration/offer-v2.spec.js`
- `tests/v2/integration/project-methodology-v2.spec.js`
- `tests/v2/integration/rating-v2.spec.js`
- `tests/v2/integration/staging-v2.spec.js`
- `tests/v2/integration/stakeholder-projects-v2.spec.js`
- `tests/v2/integration/unit-label-v2.spec.js`
- `tests/v2/integration/uuid-migration-validation-simple.spec.js`
- `tests/v2/integration/uuid-migration-validation.spec.js`
- `tests/v2/integration/validation-v2.spec.js`
- `tests/v2/integration/verification-v2.spec.js`

**Fix Pattern**: For each test file that creates `ProjectV2` or `UnitV2` records directly:
1. Import `getV2HomeOrgId` from `tests/v2/utils/v2-test-helpers.js`
2. Get the home org UID: `const homeOrgId = await getV2HomeOrgId();`
3. Add `orgUid: homeOrgId` to all `ProjectV2.create()` and `UnitV2.create()` calls
4. Add `orgUid: homeOrgId` to all `ProjectV2.bulkCreate()` and `UnitV2.bulkCreate()` calls

**Note**: This should be done as part of Phase 25.10 to ensure all tests pass before moving to Phase 26.

**Checkpoint 25.10**: Verify all V2 tests pass (including fixing other test files that create ProjectV2/UnitV2 records)

**STOP HERE - User verifies all tests pass and documentation is complete**

---

## Phase 26: Full-Text Search (FTS5) Implementation

Implement SQLite FTS5 full-text search for Projects and Units endpoints with improvements over V1 implementation.

**Goals**:
- Add `?search=xxx` query parameter support to Projects and Units endpoints
- Implement FTS5 virtual tables with automatic maintenance via triggers
- Fix performance and correctness issues from V1 implementation
- Use BM25 ranking for better relevance
- Improve query sanitization
- Add error handling and recovery utilities
- Support `orgUid` filtering in FTS queries (now that field exists)

**V2-Specific Considerations**:
- V2 projects/units now have `orgUid` field (can filter by orgUid in FTS queries)
- Map V2 snake_case field names correctly in FTS tables
- Handle V2's relationship structure (units → issuance → project)
- Use V2 database connection (`sequelizeV2`)

**Improvements Over V1**:
1. **Performance**: Use `COUNT(*)` instead of loading all rows for count
2. **Ranking**: Use BM25 ranking instead of default `rank` (better relevance)
3. **Query Sanitization**: Better sanitization that preserves user intent (don't force prefix matching)
4. **Trigger Efficiency**: Use `INSERT OR REPLACE` instead of DELETE + INSERT
5. **UNION Queries**: Fix rank ordering for units UNION queries
6. **Error Handling**: Add recovery for corrupted/missing FTS tables
7. **Rebuild Utility**: Add utility to rebuild FTS tables if needed

### 26.1 FTS5 Migration: Create Virtual Tables

Create migration to set up FTS5 virtual tables for Projects and Units.

**File**: `src/database/v2/migrations/YYYYMMDDHHMMSS-create-fts5-tables.js`

**Migration Steps**:

1. **Create `projects_v2_fts` virtual table** (includes `org_uid`):
   ```sql
   CREATE VIRTUAL TABLE projects_v2_fts USING fts5(
     cad_trust_project_id,
     org_uid,
     project_registry_name,
     project_id,
     project_crediting_program,
     project_name,
     project_link,
     project_description,
     project_sector,
     project_type,
     project_subtype,
     project_status,
     project_status_date,
     project_unit_metric,
     cad_trust_reference_project_id,
     cad_trust_program_id
   );
   ```

2. **Create `units_v2_fts` virtual table** (includes `org_uid`):
   ```sql
   CREATE VIRTUAL TABLE units_v2_fts USING fts5(
     cad_trust_unit_id,
     org_uid,
     unit_serial_id,
     unit_start_block,
     unit_end_block,
     unit_count,
     unit_type,
     unit_vintage_year,
     unit_status,
     unit_status_reason,
     unit_status_date,
     unit_retirement_detail,
     unit_retirement_beneficiary,
     unit_retirement_beneficiary_id,
     unit_link,
     unit_metric,
     unit_current_owner,
     unit_itmos_reference_id,
     cad_trust_issuance_id
   );
   ```

3. **Populate initial data** (includes `org_uid`):
   ```sql
   INSERT INTO projects_v2_fts SELECT
     cad_trust_project_id,
     org_uid,
     project_registry_name,
     project_id,
     project_crediting_program,
     project_name,
     project_link,
     project_description,
     project_sector,
     project_type,
     project_subtype,
     project_status,
     project_status_date,
     project_unit_metric,
     cad_trust_reference_project_id,
     cad_trust_program_id
   FROM project;

   INSERT INTO units_v2_fts SELECT
     cad_trust_unit_id,
     org_uid,
     unit_serial_id,
     unit_start_block,
     unit_end_block,
     unit_count,
     unit_type,
     unit_vintage_year,
     unit_status,
     unit_status_reason,
     unit_status_date,
     unit_retirement_detail,
     unit_retirement_beneficiary,
     unit_retirement_beneficiary_id,
     unit_link,
     unit_metric,
     unit_current_owner,
     unit_itmos_reference_id,
     cad_trust_issuance_id
   FROM unit;
   ```

**Checkpoint 26.1**: Verify migration runs successfully and FTS tables are created with `org_uid` field

### 26.2 FTS5 Triggers: Automatic Maintenance

Create triggers to automatically maintain FTS tables when data changes.

**File**: `src/database/v2/migrations/YYYYMMDDHHMMSS-create-fts5-triggers.js`

**Trigger Implementation**:

1. **Projects INSERT trigger** (includes `org_uid`):
   ```sql
   CREATE TRIGGER project_v2_insert_fts AFTER INSERT ON project BEGIN
     INSERT INTO projects_v2_fts(
       cad_trust_project_id,
       org_uid,
       project_registry_name,
       project_id,
       project_crediting_program,
       project_name,
       project_link,
       project_description,
       project_sector,
       project_type,
       project_subtype,
       project_status,
       project_status_date,
       project_unit_metric,
       cad_trust_reference_project_id,
       cad_trust_program_id
     ) VALUES (
       new.cad_trust_project_id,
       new.org_uid,
       new.project_registry_name,
       new.project_id,
       new.project_crediting_program,
       new.project_name,
       new.project_link,
       new.project_description,
       new.project_sector,
       new.project_type,
       new.project_subtype,
       new.project_status,
       new.project_status_date,
       new.project_unit_metric,
       new.cad_trust_reference_project_id,
       new.cad_trust_program_id
     );
   END;
   ```

2. **Projects UPDATE trigger** (using INSERT OR REPLACE for efficiency, includes `org_uid`):
   ```sql
   CREATE TRIGGER project_v2_update_fts AFTER UPDATE ON project BEGIN
     INSERT OR REPLACE INTO projects_v2_fts(
       cad_trust_project_id,
       org_uid,
       -- ... all fields
     ) VALUES (
       new.cad_trust_project_id,
       new.org_uid,
       -- ... all values
     );
   END;
   ```

3. **Projects DELETE trigger**:
   ```sql
   CREATE TRIGGER project_v2_delete_fts AFTER DELETE ON project BEGIN
     DELETE FROM projects_v2_fts WHERE cad_trust_project_id = old.cad_trust_project_id;
   END;
   ```

4. **Units INSERT trigger** (similar structure to projects, includes `org_uid`)

5. **Units UPDATE trigger** (using INSERT OR REPLACE, includes `org_uid`)

6. **Units DELETE trigger** (similar structure to projects)

**Checkpoint 26.2**: Verify triggers work correctly by inserting/updating/deleting test records with `org_uid`

### 26.3 Improved Query Sanitization Utility

Create improved query sanitization function for FTS5 queries.

**File**: `src/utils/v2-fts-utils.js`

**Function**: `sanitizeSqliteFtsQuery(query)`

**Improvements Over V1**:
- Don't force prefix matching (remove automatic `*` suffix)
- Better handling of special characters
- Preserve user intent (phrases, exact matches)
- Proper escaping of FTS5 special characters: `" ' * + - AND OR NOT`

**Implementation**:
```javascript
export const sanitizeSqliteFtsQuery = (query) => {
  if (!query || typeof query !== 'string') {
    return '';
  }

  // Trim whitespace
  query = query.trim();

  // Empty query returns empty string (will match nothing)
  if (!query) {
    return '';
  }

  // Escape double quotes (FTS5 uses double quotes for phrases)
  query = query.replace(/"/g, '""');

  // Note: Don't force prefix matching - let users control it
  // Users can add '*' themselves if they want prefix matching

  return query;
};
```

**Checkpoint 26.3**: Test sanitization with various query inputs (phrases, special chars, empty strings)

### 26.4 ProjectV2 Model: FTS Methods

Add FTS methods to ProjectV2 model with improvements.

**File**: `src/models/v2/project-v2.model.js`

**Methods to Add**:

1. **`static async fts(searchStr, pagination, columns = [], orgUid = null)`**:
   - Dialect detection (SQLite only for V2)
   - Call `findAllSqliteFts` method
   - Filter columns appropriately
   - Pass `orgUid` parameter for filtering

2. **`static async findAllSqliteFts(searchStr, pagination, columns = [], orgUid = null)`**:
   - Use BM25 ranking instead of default `rank`
   - Use `COUNT(*)` for efficient count query
   - Handle empty search strings
   - Filter by `orgUid` if provided (using WHERE clause on FTS table)
   - Return matching `cadTrustProjectId` values

**Improvements**:
- Use `ORDER BY bm25(projects_v2_fts) ASC` (lower scores = better matches)
- Use `SELECT COUNT(*)` instead of loading all rows
- Better error handling
- Support `orgUid` filtering in FTS queries

**Implementation Notes**:
- Map V2 snake_case field names correctly
- Use `sequelizeV2` connection
- Include `orgUid` filtering when provided: `WHERE projects_v2_fts.org_uid = :orgUid`

**Checkpoint 26.4**: Test FTS method with various search queries, including `orgUid` filtering

### 26.5 UnitV2 Model: FTS Methods

Add FTS methods to UnitV2 model with improvements.

**File**: `src/models/v2/unit-v2.model.js`

**Methods to Add**:

1. **`static async fts(searchStr, pagination, columns = [], includeProjectInfo = false, orgUid = null)`**:
   - Dialect detection (SQLite only)
   - Call `findAllSqliteFts` method
   - Support `includeProjectInfo` flag for searching related project data
   - Pass `orgUid` parameter for filtering

2. **`static async findAllSqliteFts(searchStr, pagination, columns = [], includeProjectInfo = false, orgUid = null)`**:
   - Use BM25 ranking
   - Use `COUNT(*)` for count
   - Fix UNION query rank ordering (use subquery with BM25)
   - Handle `includeProjectInfo` flag (join with projects_v2_fts via issuance)
   - Filter by `orgUid` if provided

**Improvements**:
- Fix UNION rank ordering: Use subquery with BM25 ranking
- Use `ORDER BY bm25(units_v2_fts) ASC` for relevance
- Proper handling of UNION deduplication in count
- Support `orgUid` filtering in FTS queries

**Implementation Notes**:
- Map V2 snake_case field names
- Handle V2 relationships (units → issuance → project)
- Include `orgUid` filtering when provided: `WHERE units_v2_fts.org_uid = :orgUid`
- Support searching project info via `includeProjectInfo` flag

**Checkpoint 26.5**: Test FTS method with various queries, including `includeProjectInfo=true` and `orgUid` filtering

### 26.6 ProjectV2 Controller: Search Integration

Integrate FTS search into ProjectV2 controller.

**File**: `src/controllers/v2/project-v2.controller.js`

**Changes to `findAll` method**:

1. **Add `search` parameter** to query params extraction
2. **Extract `orgUid` parameter** (already exists for filtering)
3. **Call FTS method** when search is provided:
   ```javascript
   if (search) {
     const ftsResults = await ProjectV2.fts(
       search,
       pagination,
       columns.filter((col) => col !== 'methodology2'), // Exclude if needed
       orgUid // Pass orgUid for FTS filtering
     );
     const mappedResults = ftsResults.rows.map((ftsResult) =>
       _.get(ftsResult, 'dataValues.cadTrustProjectId'),
     );

     if (!where) {
       where = {};
     }

     where.cadTrustProjectId = {
       [Sequelize.Op.in]: mappedResults,
     };

     // Note: orgUid filtering is handled in FTS query, so don't add it to where clause again
   }
   ```

**Implementation Notes**:
- Use V2 field names (`cadTrustProjectId` instead of `warehouseProjectId`)
- Integrate with existing filter/order/columns logic
- Maintain compatibility with other query parameters
- Pass `orgUid` to FTS method for efficient filtering

**Checkpoint 26.6**: Test search parameter with various queries and combinations with other params, including `orgUid`

### 26.7 UnitV2 Controller: Search Integration

Integrate FTS search into UnitV2 controller.

**File**: `src/controllers/v2/unit-v2.controller.js`

**Changes to `findAll` method**:

1. **Add `search` and `includeProjectInfoInSearch` parameters**
2. **Extract `orgUid` parameter** (already exists for filtering)
3. **Call FTS method** when search is provided:
   ```javascript
   if (search) {
     const ftsResults = await UnitV2.fts(
       search,
       pagination,
       columns,
       includeProjectInfoInSearch === 'true',
       orgUid // Pass orgUid for FTS filtering
     );
     const mappedResults = ftsResults.rows.map((ftsResult) =>
       _.get(ftsResult, 'dataValues.cadTrustUnitId'),
     );

     if (!where) {
       where = {};
     }

     where.cadTrustUnitId = {
       [Sequelize.Op.in]: mappedResults,
     };

     // Note: orgUid filtering is handled in FTS query, so don't add it to where clause again
   }
   ```

**Implementation Notes**:
- Use V2 field names (`cadTrustUnitId` instead of `warehouseUnitId`)
- Support `includeProjectInfoInSearch` flag
- Integrate with existing query parameters
- Pass `orgUid` to FTS method for efficient filtering

**Checkpoint 26.7**: Test search parameter with various queries, including project info search and `orgUid` filtering

### 26.8 FTS Rebuild Utility

Add utility methods to rebuild FTS tables if they get corrupted or out of sync.

**Files**:
- `src/models/v2/project-v2.model.js`
- `src/models/v2/unit-v2.model.js`

**Methods to Add**:

1. **`static async rebuildFtsTable()`**:
   ```javascript
   static async rebuildFtsTable() {
     await sequelizeV2.query('DELETE FROM projects_v2_fts');
     await sequelizeV2.query(`
       INSERT INTO projects_v2_fts SELECT
         cad_trust_project_id,
         project_registry_name,
         -- ... all fields
       FROM project
     `);
   }
   ```

2. **Add error handling** to FTS methods:
   ```javascript
   try {
     // ... FTS query logic
   } catch (error) {
     if (error.message.includes('no such table: projects_v2_fts')) {
       logger.error('FTS table missing, attempting rebuild');
       await ProjectV2.rebuildFtsTable();
       // Retry query
       return ProjectV2.findAllSqliteFts(searchStr, pagination, columns);
     }
     throw error;
   }
   ```

**Checkpoint 26.8**: Test rebuild utility and error handling

### 26.9 FTS Integration Tests

Create comprehensive integration tests for FTS functionality.

**File**: `tests/v2/integration/fts-v2.spec.js`

**Test Cases**:

**Projects FTS Tests**:
1. Search projects by project name
2. Search projects by sector
3. Search projects by methodology
4. Search projects with multiple words
5. Search projects with special characters
6. Search projects with empty string (should return no results)
7. Search projects combined with filter parameter
8. Search projects combined with columns parameter
9. Search projects combined with order parameter
10. Search projects with pagination
11. Search projects with XLS export
12. Search projects filtered by `orgUid`
13. Search projects with `orgUid` and other query parameters combined
14. Verify BM25 ranking (better matches appear first)
15. Verify count query efficiency (doesn't load all rows)

**Units FTS Tests**:
1. Search units by unit owner
2. Search units by unit status
3. Search units by serial number block
4. Search units with `includeProjectInfoInSearch=true` (searches project data)
5. Search units with UNION query (handles assetId search)
6. Search units combined with other query parameters
7. Search units filtered by `orgUid`
8. Search units with `orgUid` and `includeProjectInfoInSearch=true` combined
9. Verify BM25 ranking
10. Verify UNION rank ordering works correctly
11. Verify count query efficiency

**Error Handling Tests**:
1. Test rebuild utility when FTS table is missing
2. Test rebuild utility when FTS table is corrupted
3. Test error handling for invalid queries

**Performance Tests**:
1. Verify COUNT(*) is used (not loading all rows)
2. Verify BM25 ranking is used (not default rank)
3. Measure query performance with large datasets

**Checkpoint 26.9**: Run all FTS tests and verify they pass

```bash
# Run FTS tests
NODE_ENV=test USE_SIMULATOR=true npx mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/fts-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies all FTS tests pass**

---

## Summary of Phase 26 Improvements

**Performance Improvements**:
- ✅ Use `COUNT(*)` instead of loading all rows (major performance gain)
- ✅ Use BM25 ranking for better relevance
- ✅ Use `INSERT OR REPLACE` in triggers (more efficient)

**Correctness Improvements**:
- ✅ Fix UNION rank ordering (proper ranking across UNION results)
- ✅ Better query sanitization (preserves user intent)

**Reliability Improvements**:
- ✅ Add error handling for corrupted/missing FTS tables
- ✅ Add rebuild utility for maintenance

**V2-Specific Adaptations**:
- ✅ Map snake_case field names correctly
- ✅ Handle V2 relationships (units → issuance → project)
- ✅ Use V2 database connection
- ✅ Support `orgUid` filtering in FTS queries (field now exists in tables)

**Expected Results**:
- Full-text search works for Projects and Units endpoints
- Better search relevance than V1 (BM25 ranking)
- Better performance than V1 (efficient count queries)
- More reliable than V1 (error handling and recovery)

---

## Phase 27: Datalayer Registry Sync Background Tasks

Implement automatic background tasks for V2 datalayer synchronization, enabling V2 to automatically discover organizations from governance and sync registry data from subscribed organizations.

**Phase Overview**: V2 currently has the ability to commit staged records to datalayer (outbound sync), but lacks the automatic background tasks that sync data FROM other organizations (inbound sync). This phase implements the critical infrastructure needed for V2 to function as a distributed registry system.

**STATUS**: ✅ **COMPLETE** - Background tasks for automatic organization discovery and registry data synchronization implemented.

**Key Requirements**:
- Automatically import organizations from governance orgList
- Automatically sync registry data from all subscribed organizations
- Automatically sync organization metadata
- Handle V2 schema differences (snake_case, UUID primary keys)
- Use V2 models and database connections
- Maintain V1/V2 isolation

**Critical Gap Identified**:
Without these background tasks, V2 cannot automatically receive and process data from other organizations in the network. The database becomes stale unless manually triggered, defeating the purpose of a distributed registry system.

### 27.1 V2 Model Keys Mapping Utility

Create V2 equivalent of V1's `ModelKeys` mapping to enable registry sync to map datalayer keys to V2 models.

**File**: `src/utils/v2-model-utils.js` (new file)

**Purpose**: Map datalayer keys (e.g., `"project|{uuid}"`) to V2 Sequelize models for automatic upsert/delete operations during registry sync.

**Implementation**:

1. **Create ModelKeysV2 object**:
   ```javascript
   import {
     ProgramV2, MethodologyV2, ProjectV2, ValidationV2, VerificationV2,
     IssuanceV2, UnitV2, LocationV2, EstimationV2, RatingV2, CoBenefitV2,
     ProjectMethodologyV2, StakeholderV2, StakeholderProjectV2, LabelV2, UnitLabelV2,
     AefT1SubmissionV2, AefT5AuthorizedEntitiesV2, AefT2AuthorizationsV2,
     AefT3ActionsV2, AefT4HoldingsV2
   } from '../models/v2/index.js';

   export const ModelKeysV2 = {
     program: ProgramV2,
     methodology: MethodologyV2,
     project: ProjectV2,
     validation: ValidationV2,
     verification: VerificationV2,
     issuance: IssuanceV2,
     unit: UnitV2,
     location: LocationV2,
     estimation: EstimationV2,
     rating: RatingV2,
     co_benefit: CoBenefitV2,
     project_methodology: ProjectMethodologyV2,
     stakeholder: StakeholderV2,
     stakeholder_projects: StakeholderProjectV2,
     label: LabelV2,
     unit_label: UnitLabelV2,
     aef_t1_submission: AefT1SubmissionV2,
     aef_t5_authorized_entities: AefT5AuthorizedEntitiesV2,
     aef_t2_authorizations: AefT2AuthorizationsV2,
     aef_t3_actions: AefT3ActionsV2,
     aef_t4_holdings: AefT4HoldingsV2,
   };
   ```

2. **Add helper function to get primary key field name**:
   ```javascript
   export const getV2PrimaryKeyField = (modelKey) => {
     const primaryKeyMap = {
       program: 'cad_trust_program_id',
       methodology: 'cad_trust_methodology_id',
       project: 'cad_trust_project_id',
       validation: 'cad_trust_validation_id',
       verification: 'cad_trust_verification_id',
       issuance: 'cad_trust_issuance_id',
       unit: 'cad_trust_unit_id',
       location: 'cad_trust_location_id',
       estimation: 'cad_trust_estimation_id',
       rating: 'cad_trust_rating_id',
       co_benefit: 'cad_trust_co_benefit_id',
       project_methodology: 'id',
       stakeholder: 'cad_trust_stakeholder_id',
       stakeholder_projects: 'id',
       label: 'cad_trust_label_id',
       unit_label: 'id',
       aef_t1_submission: 'cad_trust_aef_t1_submission_id',
       aef_t5_authorized_entities: 'cad_trust_aef_t5_authorized_entities_id',
       aef_t2_authorizations: 'cad_trust_aef_t2_authorizations_id',
       aef_t3_actions: 'cad_trust_aef_t3_actions_id',
       aef_t4_holdings: 'cad_trust_aef_t4_holdings_id',
     };
     return primaryKeyMap[modelKey];
   };
   ```

**CRITICAL Requirements**:
- Use V2 table names (snake_case): `program`, `project`, `project_methodology`, etc.
- Map to V2 models (ProgramV2, ProjectV2, etc.)
- Include all 21 data models
- Primary key field names match V2 schema (snake_case)

**Reference**: V1 implementation in `src/utils/model-utils.js` (ModelKeys object)

**Checkpoint 27.1**: Verify ModelKeysV2 mapping works correctly

```bash
# Test that ModelKeysV2 can be imported and used
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/sync-registries-v2.spec.js --reporter spec --exit --timeout 300000 --grep "ModelKeysV2"
```

**STOP HERE - User verifies ModelKeysV2 mapping works**

### 27.2 V2 Meta Model: User Deleted Orgs Support

Add support for tracking user-deleted organizations in V2 (similar to V1's Meta.getUserDeletedOrgUids).

**File**: `src/models/v2/meta-v2.model.js`

**Methods to Add**:

1. **`static async getUserDeletedOrgUids()`**:
   - Query MetaV2 for `meta_key = 'userDeletedOrgUids'`
   - Parse JSON array from `meta_value`
   - Return array of orgUids (or empty array if not found)

2. **`static async addUserDeletedOrgUid(orgUid)`**:
   - Get current list of deleted orgUids
   - Add new orgUid if not already present
   - Update MetaV2 record

3. **`static async removeUserDeletedOrgUid(orgUid)`**:
   - Get current list of deleted orgUids
   - Remove orgUid from list
   - Update MetaV2 record

**CRITICAL Requirements**:
- Use MetaV2 model (not Meta)
- Use snake_case: `meta_key`, `meta_value`
- Store as JSON array in `meta_value`

**Reference**: V1 implementation in `src/models/meta/meta.model.js`

**Checkpoint 27.2**: Test user deleted orgs methods

```bash
# Test getUserDeletedOrgUids, addUserDeletedOrgUid, removeUserDeletedOrgUid
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/meta-v2.spec.js --reporter spec --exit --timeout 300000 --grep "userDeletedOrgUids"
```

**STOP HERE - User verifies user deleted orgs methods work**

### 27.3 Background Task: Sync Default Organizations V2

Create background task to automatically import organizations from governance orgList.

**File**: `src/tasks/sync-default-organizations-v2.js` (new file)

**Task Implementation**:

1. **Get default organization list from V2 governance**:
   - Use `getDefaultOrganizationListV2()` from `src/utils/v2-data-loaders.js`
   - Get list of orgUids from governance orgList

2. **Get user-deleted organizations**:
   - Call `MetaV2.getUserDeletedOrgUids()` to get list of orgs user explicitly removed
   - Skip any orgs in this list

3. **For each org in default list**:
   - Check if org exists in OrganizationsV2 table
   - If missing, call `OrganizationsV2.importOrganization(orgUid)`
   - Log success/failure

4. **Error handling**:
   - Catch errors and log with retry information
   - Don't throw (task scheduler will retry)

**Task Configuration**:
- Frequency: Every 5 minutes (default: 300 seconds)
- Run immediately: true
- Prevent overrun: true
- Task ID: `sync-default-organizations-v2`

**CRITICAL Requirements**:
- Use V2 models: `OrganizationsV2`, `MetaV2`, `GovernanceV2`
- Use V2 utilities: `getDefaultOrganizationListV2()`
- Use V2 assertions: `assertDataLayerAvailable()`, `assertWalletIsSynced()`
- Skip simulator mode (only run in production)
- Respect user-deleted orgs (don't re-add orgs user removed)

**Reference**: V1 implementation in `src/tasks/sync-default-organizations.js`

**Checkpoint 27.3**: Test sync-default-organizations-v2 task

```bash
# Test that task can be imported and runs without errors
# Test that it imports missing organizations from governance orgList
# Test that it respects user-deleted orgs
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/sync-default-organizations-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies sync-default-organizations-v2 task works**

### 27.4 Background Task: Sync Organization Meta V2

Create background task to automatically sync organization metadata.

**File**: `src/tasks/sync-organization-meta-v2.js` (new file)

**Task Implementation**:

1. **Get all subscribed V2 organizations**:
   - Query OrganizationsV2 for `subscribed: true`

2. **For each organization**:
   - Call `OrganizationsV2.syncOrganizationMeta()` (method already exists)
   - This updates name, icon, and metadata from datalayer

3. **Error handling**:
   - Catch errors and log
   - Don't throw (task scheduler will retry)

**Task Configuration**:
- Frequency: Every 5 minutes (default: 300 seconds)
- Run immediately: true
- Prevent overrun: true
- Task ID: `sync-organization-meta-v2`

**CRITICAL Requirements**:
- Use V2 models: `OrganizationsV2`
- Use V2 assertions
- Skip simulator mode (only run in production)
- Method `syncOrganizationMeta()` already exists in OrganizationsV2 model

**Reference**: V1 implementation in `src/tasks/sync-organization-meta.js`

**Checkpoint 27.4**: Test sync-organization-meta-v2 task

```bash
# Test that task can be imported and runs without errors
# Test that it syncs metadata for subscribed organizations
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/sync-organization-meta-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies sync-organization-meta-v2 task works**

### 27.5 Background Task: Sync Registries V2 (CRITICAL)

Create background task to automatically sync registry data from all subscribed organizations.

**File**: `src/tasks/sync-registries-v2.js` (new file)

**Task Implementation**:

This is the most critical task - it syncs registry data from subscribed organizations by processing kv diffs from datalayer and updating V2 models.

**Core Functionality**:

1. **Get all subscribed V2 organizations**:
   - Query OrganizationsV2 for `subscribed: true`

2. **For each organization**:
   - Get root history from datalayer for organization's registry store
   - Compare with AuditV2 table to find unsynced generations
   - For each unsynced generation:
     - Get kv diff between generations using `datalayer.getRootDiff()`
     - Process INSERT/DELETE operations:
       - INSERT: Upsert records into V2 models using ModelKeysV2
       - DELETE: Delete records from V2 models
     - Create AuditV2 records for each change
     - Update OrganizationsV2.registry_hash

3. **Handle edge cases**:
   - Generation mismatch detection and reset
   - Waiting for datalayer sync completion
   - Transaction management (prevents DB locks)
   - Handle empty diffs (NO CHANGE audit records)

**Key Differences from V1**:
- Uses OrganizationsV2 instead of Organization
- Uses AuditV2 instead of Audit
- Uses ModelKeysV2 instead of ModelKeys
- Uses sequelizeV2 instead of sequelize
- Uses V2 table names (snake_case)
- Uses V2 primary key fields (UUID strings, not integers)
- Processes V2 models (21 models vs 2 in V1)

**Task Configuration**:
- Frequency: Every 10 seconds (same as V1 for real-time sync)
- Run immediately: true
- Prevent overrun: true
- Task ID: `sync-registries-v2`
- Mutex protection: Use `syncRegistriesTaskMutexV2` (create V2 version)

**CRITICAL Requirements**:
- Use V2 models: `OrganizationsV2`, `AuditV2`, `StagingV2`, and all 21 data models via ModelKeysV2
- Use V2 database connection: `sequelizeV2`
- Use V2 table names: `project`, `unit`, `project_methodology`, etc. (snake_case)
- Use V2 primary key fields: `cad_trust_project_id`, `cad_trust_unit_id`, etc.
- Handle V2 schema differences:
  - UUID primary keys (not integers)
  - Snake_case field names
  - Different field names (e.g., `cad_trust_project_id` vs `warehouseProjectId`)
- Map datalayer keys correctly:
  - Datalayer keys format: `"project|{uuid}"` or `"unit|{uuid}"`
  - Extract model key: `key.split('|')[0]` → `"project"` or `"unit"`
  - Map to V2 model: `ModelKeysV2[modelKey]`
- Handle staging table truncation:
  - After home org sync, truncate V2 staging table (not V1)
- Transaction management:
  - Use V2 mutex: `syncRegistriesTaskMutexV2`
  - Use V2 transaction: `sequelizeV2.transaction()`
- Error handling:
  - Log errors but don't throw (task scheduler will retry)
  - Handle missing root history gracefully
  - Handle generation mismatches

**Implementation Structure** (similar to V1):

```javascript
import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { OrganizationsV2, AuditV2, StagingV2 } from '../models/v2/index.js';
import { ModelKeysV2, getV2PrimaryKeyField } from '../utils/v2-model-utils.js';
import datalayer from '../datalayer';
import { logger } from '../config/logger.js';
import { sequelizeV2 } from '../database/v2/index.js';
import { getConfig } from '../utils/config-loader';
import { assertDataLayerAvailable, assertWalletIsSynced } from '../utils/v2-data-assertions.js';
import { decodeHex, encodeHex, optimizeAndSortKvDiff } from '../utils/datalayer-utils';
import { syncRegistriesTaskMutexV2, processingSyncRegistriesTransactionMutexV2 } from '../utils/v2-model-utils.js';

const CONFIG = getConfig().APP;

const task = new Task('sync-registries-v2', async () => {
  logger.debug('sync registries v2 task invoked');
  if (!syncRegistriesTaskMutexV2.isLocked()) {
    const releaseSyncTaskMutex = await syncRegistriesTaskMutexV2.acquire();
    try {
      await processJob();
    } catch (error) {
      logger.error(`Error during V2 datasync: ${error.message}`);
      console.trace(error);
    } finally {
      releaseSyncTaskMutex();
    }
  } else {
    logger.debug('could not acquire sync registries v2 mutex. trying again shortly');
  }
});

const job = new SimpleIntervalJob(
  {
    seconds: 10,
    runImmediately: true,
  },
  task,
  { id: 'sync-registries-v2', preventOverrun: true },
);

const processJob = async () => {
  await assertDataLayerAvailable();
  await assertWalletIsSynced();

  logger.debug('running sync-registries-v2 processJob()');
  const organizations = await OrganizationsV2.findAll({
    where: { subscribed: true },
    raw: true,
  });

  for (const organization of organizations) {
    await syncOrganizationAuditV2(organization);
  }
};

const syncOrganizationAuditV2 = async (organization) => {
  // Implementation similar to V1 syncOrganizationAudit but using V2 models
  // See V1 implementation in src/tasks/sync-registries.js lines 231-632
  // Adapt for V2:
  // - Use OrganizationsV2, AuditV2, ModelKeysV2
  // - Use sequelizeV2
  // - Use V2 table names and primary key fields
  // - Handle V2 schema differences
};
```

**Reference**: V1 implementation in `src/tasks/sync-registries.js` (entire file, especially `syncOrganizationAudit` function lines 231-632)

**Checkpoint 27.5**: Test sync-registries-v2 task with basic functionality

```bash
# Test that task can be imported and runs without errors
# Test that it processes organizations correctly
# Test that it creates audit records
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/sync-registries-v2.spec.js --reporter spec --exit --timeout 300000 --grep "basic|import|process"
```

**STOP HERE - User verifies sync-registries-v2 task basic functionality works**

### 27.6 Sync Registries V2: Core Sync Logic

Implement the core `syncOrganizationAuditV2` function that processes registry data for a single organization.

**File**: `src/tasks/sync-registries-v2.js`

**Function Implementation**:

1. **Get root history and sync status**:
   - Get root history from datalayer: `datalayer.getRootHistory(organization.registry_id)`
   - Get sync status: `datalayer.getDataLayerStoreSyncStatus(organization.registry_id)`
   - Validate root history exists

2. **Find last processed generation**:
   - Query AuditV2 for last record: `AuditV2.findOne({ where: { registry_id: organization.registry_id }, order: [['generation', 'DESC']] })`
   - Handle case where no audit records exist (new registry - create CREATE REGISTRY audit entry)

3. **Calculate sync status**:
   - Compare root history length with last processed generation index
   - Update OrganizationsV2 with sync status: `synced`, `sync_remaining`

4. **Process unsynced generations**:
   - For each unsynced generation:
     - Get kv diff: `datalayer.getRootDiff(registryId, lastRoot.root_hash, newRoot.root_hash)`
     - Optimize kv diff: `optimizeAndSortKvDiff(kvDiff)`
     - Process each diff entry:
       - Extract model key: `key.split('|')[0]` → `"project"`, `"unit"`, etc.
       - Map to V2 model: `ModelKeysV2[modelKey]`
       - For INSERT: Parse JSON record, upsert to V2 model
       - For DELETE: Delete from V2 model using primary key
       - Create AuditV2 record
     - Update OrganizationsV2.registry_hash

5. **Handle special cases**:
   - Empty diffs (NO CHANGE audit records)
   - Comment and author extraction from kv diff
   - Transaction management
   - Staging table truncation for home org

**CRITICAL Requirements**:
- Use V2 models and database connection
- Use V2 table names and primary key fields
- Handle UUID primary keys correctly (not integers)
- Map datalayer keys to V2 models correctly
- Use V2 mutex and transaction management
- Handle V2 schema differences in record parsing

**Key Adaptations from V1**:

1. **Model Key Mapping**:
   ```javascript
   // V1: ModelKeys[key] (e.g., ModelKeys['project'])
   // V2: ModelKeysV2[modelKey] (e.g., ModelKeysV2['project'])
   const modelKey = key.split('|')[0]; // Extract "project" from "project|uuid"
   if (modelKey && Object.keys(ModelKeysV2).includes(modelKey)) {
     const ModelClass = ModelKeysV2[modelKey];
     // Process record...
   }
   ```

2. **Primary Key Field Names**:
   ```javascript
   // V1: Uses model.primaryKeyAttributes[0] (e.g., 'warehouseProjectId')
   // V2: Use getV2PrimaryKeyField(modelKey) (e.g., 'cad_trust_project_id')
   const primaryKeyField = getV2PrimaryKeyField(modelKey);
   const primaryKeyValue = record[primaryKeyField];
   ```

3. **Record Parsing**:
   ```javascript
   // V1: Record may have camelCase fields
   // V2: Record has snake_case fields (matching database)
   const record = JSON.parse(decodeHex(diff.value));
   // Record fields: cad_trust_project_id, org_uid, etc.
   ```

4. **Upsert Operations**:
   ```javascript
   // V1: ModelKeys[key].upsert(record, { transaction, mirrorTransaction })
   // V2: ModelKeysV2[modelKey].upsert(record, { transaction })
   // Note: V2 doesn't have mirrorTransaction (mirror DB handled separately if needed)
   await ModelKeysV2[modelKey].upsert(record, { transaction });
   ```

5. **Delete Operations**:
   ```javascript
   // V1: Uses primaryKeyAttributes[0]
   // V2: Uses getV2PrimaryKeyField()
   await ModelKeysV2[modelKey].destroy({
     where: {
       [getV2PrimaryKeyField(modelKey)]: primaryKeyValue,
     },
     transaction,
   });
   ```

6. **Audit Record Creation**:
   ```javascript
   // V1: Audit.create(auditData, { transaction, mirrorTransaction })
   // V2: AuditV2.create(auditData, { transaction })
   await AuditV2.create({
     org_uid: organization.org_uid,
     registry_id: organization.registry_id,
     root_hash: rootToBeProcessed.root_hash,
     type: diff.type,
     table: modelKey,
     change: decodeHex(diff.value),
     onchain_confirmation_time_stamp: rootToBeProcessed.timestamp,
     generation: toBeProcessedDatalayerGenerationIndex,
     comment: extractedComment,
     author: extractedAuthor,
   }, { transaction });
   ```

7. **Staging Table Truncation**:
   ```javascript
   // V1: Staging.truncate({ transaction })
   // V2: StagingV2.truncate({ transaction })
   if (organization.org_uid === homeOrg?.org_uid) {
     await StagingV2.truncate({ transaction });
   }
   ```

**Reference**: V1 implementation in `src/tasks/sync-registries.js` lines 231-632 (`syncOrganizationAudit` function)

**Checkpoint 27.6**: Test syncOrganizationAuditV2 with real organization data

```bash
# Test that syncOrganizationAuditV2 processes registry data correctly
# Test INSERT operations (upsert records)
# Test DELETE operations
# Test audit record creation
# Test generation tracking
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/sync-registries-v2.spec.js --reporter spec --exit --timeout 300000 --grep "syncOrganizationAuditV2|INSERT|DELETE|audit"
```

**STOP HERE - User verifies syncOrganizationAuditV2 core logic works**

### 27.7 Sync Registries V2: Edge Cases and Error Handling

Implement edge case handling and error recovery for sync-registries-v2 task.

**File**: `src/tasks/sync-registries-v2.js`

**Edge Cases to Handle**:

1. **Generation Mismatch Detection**:
   - If CADT generation is ahead of datalayer generation (due to reorg)
   - Reset organization to 2 generations back from highest datalayer generation
   - Use `AuditV2.resetToGeneration()` method

2. **Missing Root History**:
   - If root history is empty, log warning and skip organization
   - Return early without processing

3. **Sync Status Validation**:
   - Verify root history length matches sync status generation
   - If mismatch, pause sync until resolved
   - Log warnings for debugging

4. **Unconfirmed Roots**:
   - Wait for roots to be confirmed before processing
   - Skip generation if root not yet confirmed
   - Return early and retry on next task run

5. **Empty Diffs**:
   - Create NO CHANGE audit record if kv diff is empty
   - Still update registry hash

6. **Transaction Failures**:
   - Rollback transaction on error
   - Log error details
   - Don't update registry hash on failure

7. **Model Key Not Found**:
   - Skip unknown model keys (log warning)
   - Don't fail entire sync for unknown keys
   - Continue processing other diffs

8. **Invalid Record Data**:
   - Handle JSON parse errors gracefully
   - Log error and skip invalid record
   - Continue processing other records

**Error Handling Functions**:

1. **`orgGenerationMismatchCheckV2`**:
   - Similar to V1 `orgGenerationMismatchCheck`
   - Uses AuditV2.resetToGeneration()
   - Returns boolean indicating if reset occurred

2. **Transaction Wrapper**:
   - `createAndProcessTransactionV2(callback, afterCommitCallbacks)`
   - Uses sequelizeV2.transaction()
   - Uses processingSyncRegistriesTransactionMutexV2
   - Handles rollback on error

**CRITICAL Requirements**:
- Use V2 models and methods for all operations
- Handle errors gracefully (log but don't throw)
- Maintain transaction integrity
- Don't skip organizations permanently (retry on next run)

**Reference**: V1 implementation in `src/tasks/sync-registries.js`:
- `orgGenerationMismatchCheck` function (lines 650-676)
- `createAndProcessTransaction` function (lines 149-194)
- Error handling in `syncOrganizationAudit` (lines 231-632)

**Checkpoint 27.7**: Test edge cases and error handling

```bash
# Test generation mismatch detection and reset
# Test missing root history handling
# Test unconfirmed roots handling
# Test transaction rollback on error
# Test invalid record data handling
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/sync-registries-v2.spec.js --reporter spec --exit --timeout 300000 --grep "edge|error|mismatch|rollback"
```

**STOP HERE - User verifies edge cases and error handling work**

### 27.8 V2 Mutex Utilities

Create V2 versions of mutex utilities needed for sync-registries-v2 task.

**File**: `src/utils/v2-model-utils.js` (add to existing file or create new section)

**Mutexes to Create**:

1. **`syncRegistriesTaskMutexV2`**:
   - Prevents multiple sync-registries-v2 tasks from running simultaneously
   - Similar to V1 `syncRegistriesTaskMutex`

2. **`processingSyncRegistriesTransactionMutexV2`**:
   - Prevents other operations from interfering with sync transactions
   - Similar to V1 `processingSyncRegistriesTransactionMutex`

**Implementation**:
```javascript
import { Mutex } from 'async-mutex';

export const syncRegistriesTaskMutexV2 = new Mutex();
export const processingSyncRegistriesTransactionMutexV2 = new Mutex();
```

**CRITICAL Requirements**:
- Separate from V1 mutexes (V1/V2 isolation)
- Use same Mutex class from async-mutex
- Export for use in sync-registries-v2 task

**Reference**: V1 implementation in `src/utils/model-utils.js` lines 21-28

**Checkpoint 27.8**: Verify mutexes work correctly

```bash
# Test that mutexes can be imported and used
# Test that they prevent concurrent execution
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/sync-registries-v2.spec.js --reporter spec --exit --timeout 300000 --grep "mutex"
```

**STOP HERE - User verifies V2 mutexes work**

### 27.9 Register V2 Background Tasks

Register all V2 background tasks in the task scheduler.

**File**: `src/tasks/index.js`

**Changes**:

1. **Import V2 tasks**:
   ```javascript
   import syncDefaultOrganizationsV2 from './sync-default-organizations-v2.js';
   import syncOrganizationMetaV2 from './sync-organization-meta-v2.js';
   import syncRegistriesV2 from './sync-registries-v2.js';
   ```

2. **Add V2 tasks to scheduler**:
   ```javascript
   const start = () => {
     // Existing V1 tasks
     const defaultJobs = [
       syncGovernanceBody,
       syncDefaultOrganizations,
       syncPickLists,
       syncRegistries,
       syncOrganizationMeta,
       mirrorCheck,
       resetAuditTable,
       validateOrganizationTableAndSubscriptions,
       cleanUpFailedOrg,
     ];

     // Add V2 tasks
     const v2Jobs = [
       syncDefaultOrganizationsV2,
       syncOrganizationMetaV2,
       syncRegistriesV2,
     ];

     // Register all tasks
     [...defaultJobs, ...v2Jobs].forEach((job) => {
       jobRegistry[job.id] = job;
       scheduler.addSimpleIntervalJob(job);
     });
   };
   ```

**CRITICAL Requirements**:
- V2 tasks run alongside V1 tasks (both systems active)
- V2 tasks use different task IDs (no conflicts)
- V2 tasks are independent (V1/V2 isolation)

**Checkpoint 27.9**: Verify V2 tasks are registered and start correctly

```bash
# Test that V2 tasks are registered in scheduler
# Test that they start without errors
# Test that they don't conflict with V1 tasks
node -e "import('./src/tasks/index.js').then(m => { m.default.start(); console.log('Tasks started'); setTimeout(() => process.exit(0), 1000); })"
```

**STOP HERE - User verifies V2 tasks are registered**

### 27.10 Integration Tests: Sync Default Organizations V2

Create comprehensive integration tests for sync-default-organizations-v2 task.

**File**: `tests/v2/integration/sync-default-organizations-v2.spec.js` (new file)

**Test Cases**:

1. **Basic Functionality**:
   - Task imports organizations from governance orgList
   - Task skips organizations that already exist
   - Task respects user-deleted organizations

2. **Organization Import**:
   - Test importing single organization
   - Test importing multiple organizations
   - Test that imported organizations are subscribed

3. **User Deleted Orgs**:
   - Test that user-deleted orgs are not re-imported
   - Test that removing org from deleted list allows re-import

4. **Error Handling**:
   - Test handling of missing governance data
   - Test handling of invalid orgUids in orgList
   - Test handling of import failures

5. **V1/V2 Isolation**:
   - Verify V2 task doesn't affect V1 organizations
   - Verify V1 task doesn't affect V2 organizations

**Checkpoint 27.10**: Run sync-default-organizations-v2 tests

```bash
# Run all sync-default-organizations-v2 tests
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/sync-default-organizations-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies all sync-default-organizations-v2 tests pass**

### 27.11 Integration Tests: Sync Organization Meta V2

Create comprehensive integration tests for sync-organization-meta-v2 task.

**File**: `tests/v2/integration/sync-organization-meta-v2.spec.js` (new file)

**Test Cases**:

1. **Basic Functionality**:
   - Task syncs metadata for subscribed organizations
   - Task updates name, icon, and metadata fields
   - Task updates org_hash field

2. **Metadata Updates**:
   - Test syncing name changes
   - Test syncing icon changes
   - Test syncing custom metadata (meta_* fields)

3. **Error Handling**:
   - Test handling of missing organization stores
   - Test handling of sync failures
   - Test that errors don't stop task execution

4. **V1/V2 Isolation**:
   - Verify V2 task doesn't affect V1 organizations
   - Verify V1 task doesn't affect V2 organizations

**Checkpoint 27.11**: Run sync-organization-meta-v2 tests

```bash
# Run all sync-organization-meta-v2 tests
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/sync-organization-meta-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies all sync-organization-meta-v2 tests pass**

### 27.12 Integration Tests: Sync Registries V2

Create comprehensive integration tests for sync-registries-v2 task.

**File**: `tests/v2/integration/sync-registries-v2.spec.js` (new file)

**Test Cases**:

1. **Basic Functionality**:
   - Task processes subscribed organizations
   - Task creates audit records for changes
   - Task updates registry hash

2. **INSERT Operations**:
   - Test upserting new project records
   - Test upserting new unit records
   - Test upserting records for all 21 models
   - Test that records are correctly parsed and stored

3. **DELETE Operations**:
   - Test deleting project records
   - Test deleting unit records
   - Test deleting records for all 21 models

4. **Generation Tracking**:
   - Test tracking generations correctly
   - Test handling new registries (CREATE REGISTRY audit)
   - Test handling NO CHANGE generations

5. **Edge Cases**:
   - Test generation mismatch detection and reset
   - Test missing root history handling
   - Test unconfirmed roots handling
   - Test empty diffs (NO CHANGE records)
   - Test invalid record data handling

6. **Transaction Management**:
   - Test transaction rollback on error
   - Test staging table truncation for home org
   - Test mutex prevents concurrent execution

7. **Model Key Mapping**:
   - Test all 21 models are mapped correctly
   - Test primary key field extraction
   - Test unknown model keys are skipped

8. **V1/V2 Isolation**:
   - Verify V2 sync doesn't affect V1 data
   - Verify V1 sync doesn't affect V2 data
   - Verify both systems can run simultaneously

9. **Performance**:
   - Test processing multiple generations
   - Test processing large kv diffs
   - Test processing multiple organizations

**Checkpoint 27.12**: Run sync-registries-v2 tests

```bash
# Run all sync-registries-v2 tests
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/sync-registries-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies all sync-registries-v2 tests pass**

### 27.13 End-to-End Integration Test

Create end-to-end integration test that verifies all three V2 sync tasks work together.

**File**: `tests/v2/integration/sync-tasks-e2e-v2.spec.js` (new file)

**Test Scenarios**:

1. **Complete Sync Flow**:
   - Governance syncs orgList
   - Sync-default-organizations-v2 imports orgs from orgList
   - Organizations subscribe to registry stores
   - Sync-registries-v2 syncs registry data
   - Sync-organization-meta-v2 syncs metadata
   - Verify all data is correctly imported and synced

2. **Multi-Organization Sync**:
   - Import multiple organizations
   - Sync registry data from all organizations
   - Verify data from each org is correctly stored
   - Verify orgUid filtering works correctly

3. **Continuous Sync**:
   - Simulate new data being published by organizations
   - Verify sync-registries-v2 picks up new generations
   - Verify audit trail is maintained
   - Verify data is correctly updated

**Checkpoint 27.13**: Run end-to-end integration test

```bash
# Run end-to-end integration test
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/sync-tasks-e2e-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies end-to-end integration test passes**

### 27.14 Comprehensive End-to-End Tests with Datalayer Simulation

Create comprehensive end-to-end tests that simulate real datalayer interactions and registry sync scenarios.

**File**: `tests/v2/integration/sync-registries-v2-comprehensive.spec.js` (new file)

**Purpose**: These tests provide comprehensive coverage of sync-registries-v2 functionality by simulating real-world datalayer scenarios, including root history, kv diffs, and model updates.

**Test Infrastructure**:

1. **Datalayer Mocking/Simulation**:
   - Mock `datalayer.getRootHistory()` to return simulated root history
   - Mock `datalayer.getRootDiff()` to return simulated kv diffs
   - Mock `datalayer.getDataLayerStoreSyncStatus()` to return sync status
   - Support multiple generations and root hashes

2. **Test Data Setup**:
   - Create test organizations with registry IDs
   - Set up governance data with orgList
   - Create test root history with multiple generations
   - Create test kv diffs with INSERT/DELETE operations

**Comprehensive Test Cases**:

1. **Registry Sync: New Registry**:
   - Organization has no audit records
   - Verify CREATE REGISTRY audit record is created
   - Verify generation 0 is processed correctly
   - Verify organization registry_hash is updated

2. **Registry Sync: INSERT Operations**:
   - Simulate kv diff with INSERT operations for all 21 models
   - Verify records are upserted correctly
   - Verify AuditV2 records are created with correct type
   - Verify primary keys are extracted correctly (UUID vs 'id')
   - Verify snake_case field names are handled correctly
   - Verify timestamps (created_at/updated_at) are handled correctly

3. **Registry Sync: DELETE Operations**:
   - Simulate kv diff with DELETE operations
   - Verify records are deleted correctly
   - Verify AuditV2 records are created with DELETE type
   - Verify primary key extraction works for deletes

4. **Registry Sync: Multiple Generations**:
   - Simulate processing multiple generations sequentially
   - Verify each generation creates correct audit records
   - Verify registry_hash is updated after each generation
   - Verify sync_remaining count decreases correctly
   - Verify synced flag is set when all generations processed

5. **Registry Sync: NO CHANGE Generations**:
   - Simulate empty kv diff (no changes)
   - Verify NO CHANGE audit record is created
   - Verify registry_hash is still updated
   - Verify no model updates occur

6. **Registry Sync: Comment and Author Extraction**:
   - Simulate kv diff with comment and author fields
   - Verify comment is extracted and stored in AuditV2
   - Verify author is extracted and stored in AuditV2
   - Verify comment/author are empty strings if not present

7. **Registry Sync: Generation Mismatch Detection**:
   - Simulate CADT being ahead of datalayer (reorg scenario)
   - Verify orgGenerationMismatchCheckV2 detects mismatch
   - Verify AuditV2.resetToGeneration() is called
   - Verify sync resumes from correct generation

8. **Registry Sync: Transaction Management**:
   - Simulate error during model upsert
   - Verify transaction is rolled back
   - Verify registry_hash is NOT updated on failure
   - Verify no partial data is committed

9. **Registry Sync: Staging Table Truncation**:
   - Sync home organization registry
   - Verify staging table is truncated after successful sync
   - Verify truncation only happens for home org
   - Verify truncation happens after transaction commit

10. **Registry Sync: Mutex Protection**:
    - Simulate concurrent sync attempts
    - Verify mutex prevents concurrent execution
    - Verify second attempt waits for first to complete
    - Verify no data corruption occurs

11. **Registry Sync: Model Key Mapping**:
    - Test all 21 model keys are mapped correctly
    - Test unknown model keys are skipped (logged but don't fail)
    - Test primary key field extraction for all models
    - Test join tables use 'id' as primary key

12. **Registry Sync: Edge Cases**:
    - Missing root history (should pause sync)
    - Unconfirmed roots (should wait)
    - Root history length mismatch (should pause)
    - Invalid JSON in kv diff values (should skip record)
    - Missing primary key in record (should handle gracefully)

13. **Registry Sync: Performance**:
    - Process large kv diff (100+ records)
    - Process multiple organizations sequentially
    - Verify transaction doesn't lock database too long
    - Verify mutex doesn't cause deadlocks

14. **Full Workflow: Organization Import to Data Sync**:
    - Set up governance with orgList containing test orgs
    - Run sync-default-organizations-v2 (imports orgs)
    - Set up registry data in datalayer simulator
    - Run sync-registries-v2 (syncs registry data)
    - Verify all data is correctly imported and synced
    - Verify audit trail is complete

15. **V1/V2 Isolation**:
    - Run V1 sync tasks alongside V2 sync tasks
    - Verify V2 sync doesn't affect V1 data
    - Verify V1 sync doesn't affect V2 data
    - Verify both systems can operate independently

**Test Utilities to Create**:

1. **`createMockRootHistory(generations)`**:
   - Creates array of root history entries
   - Each entry has root_hash, timestamp, confirmed flag
   - Supports creating history for multiple generations

2. **`createMockKvDiff(operations)`**:
   - Creates kv diff array with INSERT/DELETE operations
   - Supports all 21 model types
   - Includes comment and author fields
   - Returns hex-encoded keys and values

3. **`setupTestOrganization(orgUid, registryId)`**:
   - Creates test organization in OrganizationsV2
   - Sets up registry_id and initial registry_hash
   - Returns organization record

4. **`setupTestGovernanceData(orgList)`**:
   - Creates governance data with orgList
   - Sets up pickList data
   - Returns governance records

**CRITICAL Requirements**:
- Use simulator mode for datalayer interactions
- Mock datalayer methods to return controlled test data
- Verify all 21 models are tested
- Verify transaction rollback works correctly
- Verify mutex prevents concurrent execution
- Verify V1/V2 isolation is maintained

**Reference**:
- V1 sync-registries tests (if they exist)
- Datalayer simulator utilities in `src/datalayer/simulator.js`
- Test helpers in `tests/v2/utils/v2-test-helpers.js`

**Checkpoint 27.14**: Run comprehensive end-to-end tests

```bash
# Run comprehensive sync-registries-v2 tests
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/sync-registries-v2-comprehensive.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies comprehensive end-to-end tests pass**

**STATUS**: ✅ **COMPLETE** - Comprehensive end-to-end tests created with test utilities and 13 test cases covering model key mapping, transaction management, staging truncation, audit records, edge cases, and V1/V2 isolation.

### 27.15 Update Plan Status

Update plan to mark Phase 27 as complete.

**Checkpoint 27.15**: Verify all Phase 27 work is complete

```bash
# Run full V2 test suite to ensure nothing broke
npm run test:v2

# Should see all tests passing including new sync task tests
```

**STOP HERE - User verifies all V2 tests pass and Phase 27 is complete**

---

## Summary of Phase 27 Implementation

**Background Tasks Created**:
- ✅ `sync-default-organizations-v2.js` - Automatically imports organizations from governance orgList
- ✅ `sync-organization-meta-v2.js` - Automatically syncs organization metadata
- ✅ `sync-registries-v2.js` - Automatically syncs registry data from subscribed organizations (CRITICAL)

**Utilities Created**:
- ✅ `ModelKeysV2` - Maps datalayer keys to V2 models
- ✅ `getV2PrimaryKeyField()` - Gets primary key field name for V2 models
- ✅ V2 mutex utilities for task coordination

**Key Features**:
- Automatic organization discovery from governance
- Automatic registry data synchronization
- Automatic organization metadata updates
- V1/V2 isolation maintained
- Comprehensive error handling and edge case management
- Full test coverage

**Expected Results**:
- V2 automatically discovers and imports organizations from governance
- V2 automatically syncs registry data from subscribed organizations
- V2 database stays up-to-date with network changes
- V2 functions as a complete distributed registry system
- V2 can both publish data (via staging/commit) and receive data (via sync tasks)

---

## Phase 28: Additional V2 Background Tasks

Implement additional V2 background tasks for production operations: mirror checking, organization validation, picklist syncing, and failed org cleanup.

**Phase Overview**: V1 has several additional background tasks that support production operations. V2 needs equivalent tasks to maintain system health and ensure proper datalayer mirroring and organization subscription management.

**STATUS**: ✅ **COMPLETE** - Additional background tasks for production operations implemented.

**Key Requirements**:
- Mirror checking for V2 organizations
- Organization subscription validation
- Picklist syncing (configurable interval)
- Failed org cleanup (configurable interval)

### 28.1 Background Task: Mirror Check V2

Create background task to automatically add mirrors for V2 organization stores.

**File**: `src/tasks/mirror-check-v2.js` (new file)

**Task Implementation**:

1. **Get mirror URL**:
   - Use `getMirrorUrl()` from datalayer utils
   - Skip if not configured

2. **Check for V2 governance**:
   - Query MetaV2 for `governanceBodyId` and `mainGoveranceBodyId`
   - If governance node, add mirrors for governance stores

3. **Get all V2 organizations**:
   - Call `OrganizationsV2.getOrgsMap()`

4. **For each subscribed organization**:
   - Add mirror for `org_uid` store
   - Add mirror for `data_model_version_store_id` store
   - Add mirror for `registry_id` store

**Task Configuration**:
- Frequency: Every 5 minutes (default: 300 seconds)
- Run immediately: true
- Prevent overrun: true
- Task ID: `mirror-check-v2`
- Config check: `AUTO_MIRROR_EXTERNAL_STORES` (default: true)

**CRITICAL Requirements**:
- Use V2 models: `OrganizationsV2`, `MetaV2`
- Use V2 methods: `OrganizationsV2.getOrgsMap()`, `OrganizationsV2.addMirror()`
- Skip simulator mode
- Handle errors gracefully (log but don't throw)

**Reference**: V1 implementation in `src/tasks/mirror-check.js`

**Checkpoint 28.1**: Test mirror-check-v2 task

```bash
# Test that task can be imported and runs without errors
# Test that it adds mirrors for V2 organizations
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/mirror-check-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies mirror-check-v2 task works**

### 28.2 Background Task: Validate Organization Table and Subscriptions V2

Create background task to validate V2 organization subscriptions and reconcile store IDs.

**File**: `src/tasks/validate-organization-table-and-subscriptions-v2.js` (new file)

**Task Implementation**:

1. **Get all V2 organizations**:
   - Query OrganizationsV2 for all organizations

2. **For each organization**:
   - Skip if `org_uid === 'PENDING'`
   - Skip if org is in user-deleted list
   - If `subscribed: true`:
     - Call `OrganizationsV2.reconcileOrganization(organization)`
   - If `subscribed: false`:
     - Call `OrganizationsV2.unsubscribeFromOrganizationStores(organization)`

**Task Configuration**:
- Frequency: Every 15 minutes (default: 900 seconds)
- Run immediately: true
- Prevent overrun: true
- Task ID: `validate-organization-table-v2`

**CRITICAL Requirements**:
- Use V2 models: `OrganizationsV2`, `MetaV2`
- Use V2 methods: `OrganizationsV2.reconcileOrganization()`, `OrganizationsV2.unsubscribeFromOrganizationStores()`
- Use V2 utilities: `MetaV2.getUserDeletedOrgUids()`
- Skip simulator mode
- Handle errors gracefully (log but don't throw)

**Reference**: V1 implementation in `src/tasks/validate-organization-table-and-subscriptions.js`

**Checkpoint 28.2**: Test validate-organization-table-v2 task

```bash
# Test that task can be imported and runs without errors
# Test that it reconciles subscribed organizations
# Test that it unsubscribes unsubscribed organizations
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/validate-organization-table-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies validate-organization-table-v2 task works**

### 28.3 Background Task: Sync Picklists V2

Create background task to periodically refresh V2 picklist values from governance.

**File**: `src/tasks/sync-picklists-v2.js` (new file)

**Task Implementation**:

1. **Call picklist loader**:
   - Call `pullPickListValuesV2()` from `src/utils/v2-data-loaders.js`
   - This refreshes picklist cache from governance

**Task Configuration**:
- Frequency: Configurable via `APP.TASKS.PICKLIST_SYNC_TASK_INTERVAL` (default: 600 seconds / 10 minutes)
- Run immediately: true
- Prevent overrun: true
- Task ID: `sync-picklist-v2`

**CRITICAL Requirements**:
- Use V2 utilities: `pullPickListValuesV2()`
- Use configurable interval: `CONFIG?.TASKS?.PICKLIST_SYNC_TASK_INTERVAL || 600` (10 minutes default)
- Skip simulator mode
- Handle errors gracefully
- Match V1 implementation pattern exactly

**Reference**: V1 implementation in `src/tasks/sync-picklists.js`

**Checkpoint 28.3**: Test sync-picklists-v2 task

```bash
# Test that task can be imported and runs without errors
# Test that it refreshes picklist values
# Test that interval is configurable
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/sync-picklists-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies sync-picklists-v2 task works**

### 28.4 Background Task: Clean Up Failed Org V2

Create background task to clean up PENDING organization records from failed V2 org creation.

**File**: `src/tasks/clean-up-failed-org-v2.js` (new file)

**Task Implementation**:

1. **Delete PENDING org records**:
   - Query OrganizationsV2 for `org_uid = 'PENDING'`
   - Delete any found records

**Task Configuration**:
- Frequency: Configurable via `APP.TASKS.CLEAN_UP_FAILED_ORG_TASK_INTERVAL` (default: 7 days in seconds = 604800)
- Run immediately: true
- Prevent overrun: true
- Task ID: `clean-up-failed-org-v2`

**Note**: V1 has this hardcoded to 7 days with a comment "BAD EXAMPLE. DO NOT DO THIS." V2 will make it configurable as an improvement over V1.

**CRITICAL Requirements**:
- Use V2 models: `OrganizationsV2`
- Use configurable interval: `CONFIG?.TASKS?.CLEAN_UP_FAILED_ORG_TASK_INTERVAL || 604800` (7 days in seconds)
- Skip simulator mode
- Handle errors gracefully
- Convert interval from seconds to days for SimpleIntervalJob (or use seconds if ToadScheduler supports it)

**Reference**: V1 implementation in `src/tasks/clean-up-failed-org.js`

**Checkpoint 28.4**: Test clean-up-failed-org-v2 task

```bash
# Test that task can be imported and runs without errors
# Test that it cleans up PENDING org records
# Test that interval is configurable
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/clean-up-failed-org-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies clean-up-failed-org-v2 task works**

### 28.5 Register Additional V2 Background Tasks

Register additional V2 background tasks in the task scheduler.

**File**: `src/tasks/index.js`

**Changes**:

1. **Import additional V2 tasks**:
   ```javascript
   import mirrorCheckV2 from './mirror-check-v2.js';
   import validateOrganizationTableV2 from './validate-organization-table-and-subscriptions-v2.js';
   import syncPicklistsV2 from './sync-picklists-v2.js';
   import cleanUpFailedOrgV2 from './clean-up-failed-org-v2.js';
   ```

2. **Add to V2 tasks array**:
   ```javascript
   const v2Jobs = [
     syncDefaultOrganizationsV2,
     syncOrganizationMetaV2,
     syncRegistriesV2,
     mirrorCheckV2,
     validateOrganizationTableV2,
     syncPicklistsV2,
     cleanUpFailedOrgV2,
   ];
   ```

**CRITICAL Requirements**:
- Register all implemented V2 tasks
- Optional tasks can be commented out if not implemented
- V2 tasks run alongside V1 tasks

**Checkpoint 28.5**: Verify additional V2 tasks are registered

```bash
# Test that V2 tasks are registered in scheduler
# Test that they start without errors
node -e "import('./src/tasks/index.js').then(m => { m.default.start(); console.log('Tasks started'); setTimeout(() => process.exit(0), 1000); })"
```

**STOP HERE - User verifies additional V2 tasks are registered**

### 28.6 Integration Tests: Additional V2 Background Tasks

Create comprehensive integration tests for additional V2 background tasks.

**Files**:
- `tests/v2/integration/mirror-check-v2.spec.js` (new file)
- `tests/v2/integration/validate-organization-table-v2.spec.js` (new file)
- `tests/v2/integration/sync-picklists-v2.spec.js` (new file, if implemented)
- `tests/v2/integration/clean-up-failed-org-v2.spec.js` (new file, if implemented)

**Test Cases** (for each task):

1. **Basic Functionality**:
   - Task runs without errors
   - Task performs expected operations
   - Task handles errors gracefully

2. **V1/V2 Isolation**:
   - Verify V2 task doesn't affect V1 data
   - Verify V1 task doesn't affect V2 data

3. **Edge Cases**:
   - Test with no organizations
   - Test with missing configuration
   - Test error handling

**Checkpoint 28.6**: Run all additional V2 task tests

```bash
# Run all additional V2 task tests
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/mirror-check-v2.spec.js tests/v2/integration/validate-organization-table-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies all additional V2 task tests pass**

---

## Summary of Phase 28 Implementation

**Background Tasks Created**:
- ✅ `mirror-check-v2.js` - Automatically adds mirrors for V2 organization stores
- ✅ `validate-organization-table-and-subscriptions-v2.js` - Validates and reconciles V2 organization subscriptions
- ✅ `sync-picklists-v2.js` - Periodically refreshes picklist values (configurable interval)
- ✅ `clean-up-failed-org-v2.js` - Cleans up PENDING org records (configurable interval - improvement over V1)

**Key Features**:
- Automatic mirror management for V2 organizations
- Automatic organization subscription validation
- V1/V2 isolation maintained
- Production-ready background task infrastructure

**Expected Results**:
- V2 organizations have mirrors automatically maintained
- V2 organization subscriptions stay validated and reconciled
- V2 system operates reliably in production environment

---

## Phase 29: Websocket Support for V2

Implement websocket support for V2 models to enable real-time change notifications, matching V1's websocket functionality.

**Phase Overview**: V1 has websocket support for real-time change notifications on projects, units, and staging. V2 currently only has websocket support for staging. This phase adds websocket support for ProjectV2 and UnitV2 models.

**STATUS**: ✅ **COMPLETE** - Websocket support for V2 models implemented.

**Key Requirements**:
- Add RxJS Subject to ProjectV2 and UnitV2 models
- Emit change notifications on create/update/delete operations
- Update websocket handler to support V2 subscriptions
- Test websocket functionality

**Note**: Server already has socket.io setup for `/v2/ws` namespace, and StagingV2 already has websocket support implemented.

### 29.1 Add Websocket Support to ProjectV2 Model

Add RxJS Subject and change emission to ProjectV2 model.

**File**: `src/models/v2/project-v2.model.js`

**Changes**:

1. **Add RxJS import**:
   ```javascript
   import * as rxjs from 'rxjs';
   ```

2. **Add changes Subject** (after class declaration):
   ```javascript
   class ProjectV2 extends Model {
     static changes = new rxjs.Subject();
     // ... rest of class
   ```

3. **Override `create()` method**:
   - Emit change notification: `ProjectV2.changes.next(['projects', orgUid])`
   - Extract `org_uid` from values or result
   - Call `super.create()` first, then emit change

4. **Override `destroy()` method**:
   - Emit change notification: `ProjectV2.changes.next(['projects'])`
   - Call `super.destroy()` first, then emit change

5. **Override `upsert()` method** (if not already overridden):
   - Emit change notification: `ProjectV2.changes.next(['projects', orgUid])`
   - Extract `org_uid` from values
   - Call `super.upsert()` first, then emit change

**CRITICAL Requirements**:
- Follow V1 pattern: emit after operation completes
- Extract `org_uid` from values or result (V2 uses snake_case: `org_uid`)
- Emit `['projects', orgUid]` for create/upsert, `['projects']` for destroy
- Ensure changes are emitted even if operation fails (use try/finally if needed)

**Reference**: V1 implementation in `src/models/projects/projects.model.js` lines 44, 125-172

**Checkpoint 29.1**: Test ProjectV2 changes emission

```bash
# Test that ProjectV2.changes Subject exists and emits changes
# Test create, update, destroy operations emit changes
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/websocket-v2.spec.js --reporter spec --exit --timeout 300000 --grep "ProjectV2"
```

**STOP HERE - User verifies ProjectV2 changes emission works**

### 29.2 Add Websocket Support to UnitV2 Model

Add RxJS Subject and change emission to UnitV2 model.

**File**: `src/models/v2/unit-v2.model.js`

**Changes**:

1. **Add RxJS import**:
   ```javascript
   import * as rxjs from 'rxjs';
   ```

2. **Add changes Subject** (after class declaration):
   ```javascript
   class UnitV2 extends Model {
     static changes = new rxjs.Subject();
     // ... rest of class
   ```

3. **Override `create()` method**:
   - Emit change notification: `UnitV2.changes.next(['units', orgUid])`
   - Extract `org_uid` from result (units belong to issuances, which belong to projects)
   - Call `super.create()` first, then emit change

4. **Override `destroy()` method**:
   - Emit change notification: `UnitV2.changes.next(['units'])`
   - Call `super.destroy()` first, then emit change

5. **Override `upsert()` method** (if not already overridden):
   - Emit change notification: `UnitV2.changes.next(['units', orgUid])`
   - Extract `org_uid` from values or result
   - Call `super.upsert()` first, then emit change

**CRITICAL Requirements**:
- Follow V1 pattern: emit after operation completes
- Extract `org_uid` from values or result (V2 uses snake_case: `org_uid`)
- Emit `['units', orgUid]` for create/upsert, `['units']` for destroy
- Note: V1 Unit model emits `['projects', orgUid]` on upsert (this seems like a bug, but we'll match V1 behavior if intentional)

**Reference**: V1 implementation in `src/models/units/units.model.js` lines 26, 70-116

**Checkpoint 29.2**: Test UnitV2 changes emission

```bash
# Test that UnitV2.changes Subject exists and emits changes
# Test create, update, destroy operations emit changes
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/websocket-v2.spec.js --reporter spec --exit --timeout 300000 --grep "UnitV2"
```

**STOP HERE - User verifies UnitV2 changes emission works**

### 29.3 Update Websocket Handler for V2

Update websocket handler to support V2 model subscriptions.

**File**: `src/websocket.js`

**Current State**: Handler already supports both V1 and V2 namespaces (`/v1/ws` and `/v2/ws`), but only subscribes to V1 models.

**Changes**:

1. **Import V2 models**:
   ```javascript
   import { ProjectV2, UnitV2, StagingV2 } from './models/v2/index.js';
   ```

2. **Detect namespace** (socket.nsp.name):
   - Check if socket is connected to `/v2/ws` namespace
   - Use V2 models for V2 namespace, V1 models for V1 namespace

3. **Update subscription logic**:
   - For `/v1/ws`: Use `Project`, `Unit`, `Staging` (existing)
   - For `/v2/ws`: Use `ProjectV2`, `UnitV2`, `StagingV2` (new)

**Implementation Pattern**:
```javascript
const isV2 = socket.nsp.name === '/v2/ws';
const ProjectModel = isV2 ? ProjectV2 : Project;
const UnitModel = isV2 ? UnitV2 : Unit;
const StagingModel = isV2 ? StagingV2 : Staging;

switch (feed) {
  case 'projects':
    if (!socketSubscriptions[socket.id].includes('projects')) {
      ProjectModel.changes.subscribe((data) => {
        socket.emit('change:projects', data);
      });
      socketSubscriptions[socket.id].push('projects');
      callback('success');
    }
    break;
  // ... similar for units and staging
}
```

**CRITICAL Requirements**:
- Maintain backward compatibility with V1 websocket connections
- Use namespace detection to route to correct models
- V1 and V2 websocket connections should work independently
- Same event names (`change:projects`, `change:units`, `change:staging`) for both versions

**Reference**: Current implementation in `src/websocket.js` and V1 models

**Checkpoint 29.3**: Test websocket handler with V2 models

```bash
# Test that websocket handler correctly routes V2 connections to V2 models
# Test that V1 and V2 websocket connections work independently
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/websocket-v2.spec.js --reporter spec --exit --timeout 300000 --grep "websocket|handler"
```

**STOP HERE - User verifies websocket handler works with V2**

### 29.4 Integration Tests: Websocket V2

Create comprehensive integration tests for V2 websocket functionality.

**File**: `tests/v2/integration/websocket-v2.spec.js` (new file)

**Test Cases**:

1. **Model Changes Emission**:
   - Test ProjectV2.changes Subject exists
   - Test ProjectV2.create() emits changes
   - Test ProjectV2.destroy() emits changes
   - Test ProjectV2.upsert() emits changes
   - Test UnitV2.changes Subject exists
   - Test UnitV2.create() emits changes
   - Test UnitV2.destroy() emits changes
   - Test UnitV2.upsert() emits changes

2. **Websocket Connection**:
   - Test connection to `/v2/ws` namespace
   - Test authentication flow
   - Test disconnect handling

3. **Websocket Subscriptions**:
   - Test subscribe to 'projects' feed
   - Test subscribe to 'units' feed
   - Test subscribe to 'staging' feed
   - Test duplicate subscription handling
   - Test multiple clients can subscribe independently

4. **Change Notifications**:
   - Test creating ProjectV2 emits `change:projects` event
   - Test updating ProjectV2 emits `change:projects` event
   - Test deleting ProjectV2 emits `change:projects` event
   - Test creating UnitV2 emits `change:units` event
   - Test updating UnitV2 emits `change:units` event
   - Test deleting UnitV2 emits `change:units` event
   - Test creating StagingV2 emits `change:staging` event

5. **V1/V2 Isolation**:
   - Test V1 websocket connections don't receive V2 changes
   - Test V2 websocket connections don't receive V1 changes
   - Test both V1 and V2 connections can work simultaneously

6. **Edge Cases**:
   - Test orgUid extraction from different value formats
   - Test changes emission with transactions
   - Test error handling during change emission

**CRITICAL Requirements**:
- Use socket.io-client for testing websocket connections
- Test both V1 and V2 namespaces
- Verify change event payloads match expected format
- Ensure V1/V2 isolation is maintained

**Reference**: V1 websocket tests (if they exist) or create from scratch

**Checkpoint 29.4**: Run all websocket V2 tests

```bash
# Run all websocket V2 tests
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/websocket-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies all websocket V2 tests pass**

---

## Summary of Phase 29 Implementation

**Websocket Support Added**:
- ✅ ProjectV2.changes Subject and change emission
- ✅ UnitV2.changes Subject and change emission
- ✅ Websocket handler updated for V2 namespace routing
- ✅ Comprehensive integration tests

**Key Features**:
- Real-time change notifications for V2 projects and units
- V1/V2 websocket isolation maintained
- Backward compatibility with V1 websocket connections
- Same event names and patterns as V1 for consistency

**Expected Results**:
- Clients can connect to `/v2/ws` namespace
- Clients can subscribe to 'projects', 'units', and 'staging' feeds
- Real-time notifications are emitted when V2 projects/units are created/updated/deleted
- V1 and V2 websocket connections work independently without interference

---

## Phase 30: Unified Configuration File Migration

Migrate from separate V1 and V2 configuration files to a unified configuration file structure with APP, V1, and V2 sections.

**STATUS**: 🔄 **PENDING** - Not yet started

**Goals**:
- Create unified config file at `~/.chia/mainnet/cadt/config.yaml` (or `${CHIA_ROOT}/cadt/config.yaml`)
- Structure: APP section (shared config), V1 section (V1-specific), V2 section (V2-specific)
- Implement migration logic to detect and migrate existing config files
- Update all config loading code to use the new unified config structure
- Ensure write permissions are checked before migration
- Prevent creation of config files at old locations

### 30.1 Update defaultConfig.js Structure

Update the default configuration structure to support the new unified format.

**File**: `src/utils/defaultConfig.js`

**Changes**:
1. Restructure `defaultConfig` to have three top-level sections:
   - `APP`: Shared configuration values (CW_PORT, BIND_ADDRESS, DATALAYER_URL, WALLET_URL, USE_SIMULATOR, CHIA_NETWORK, USE_DEVELOPMENT_MODE, DEFAULT_FEE, DEFAULT_COIN_AMOUNT, CERTIFICATE_FOLDER_PATH, DATALAYER_FILE_SERVER_URL, AUTO_SUBSCRIBE_FILESTORE, AUTO_MIRROR_EXTERNAL_STORES, LOG_LEVEL, TASKS, REQUEST_CONTENT_LIMITS)
   - `V1`: V1-specific configuration (ENABLE, READ_ONLY, CADT_API_KEY, IS_GOVERNANCE_BODY, GOVERNANCE, MIRROR_DB)
   - `V2`: V2-specific configuration (ENABLE, READ_ONLY, CADT_API_KEY, IS_GOVERNANCE_BODY, GOVERNANCE, MIRROR_DB)

2. Structure should match the desired output format:
   ```javascript
   export const defaultConfig = {
     APP: {
       CW_PORT: 31310,
       BIND_ADDRESS: 'localhost',
       DATALAYER_URL: 'https://localhost:8562',
       WALLET_URL: 'https://localhost:9257',
       USE_SIMULATOR: false,
       CHIA_NETWORK: 'mainnet',
       USE_DEVELOPMENT_MODE: false,
       DEFAULT_FEE: 3000,
       DEFAULT_COIN_AMOUNT: 300,
       CERTIFICATE_FOLDER_PATH: null,
       DATALAYER_FILE_SERVER_URL: null,
       AUTO_SUBSCRIBE_FILESTORE: false,
       AUTO_MIRROR_EXTERNAL_STORES: true,
       LOG_LEVEL: 'info',
       TASKS: {
         GOVERNANCE_SYNC_TASK_INTERVAL: 86400,
         ORGANIZATION_META_SYNC_TASK_INTERVAL: 300,
         PICKLIST_SYNC_TASK_INTERVAL: 60,
         MIRROR_CHECK_TASK_INTERVAL: 86460,
         VALIDATE_ORGANIZATION_TABLE_TASK_INTERVAL: 1800,
       },
       REQUEST_CONTENT_LIMITS: {
         STAGING: {
           EDIT_DATA_LEN: 200,
         },
         UNITS: {
           INCLUDE_COLUMNS_LEN: 200,
           MARKETPLACE_IDENTIFIERS_LEN: 200,
         },
         PROJECTS: {
           INCLUDE_COLUMNS_LEN: 200,
           PROJECT_IDS_LEN: 200,
         },
       },
     },
     V1: {
       ENABLE: true,
       READ_ONLY: false,
       CADT_API_KEY: null,
       IS_GOVERNANCE_BODY: true,
       GOVERNANCE: {
         GOVERNANCE_BODY_ID: '23f6498e015ebcd7190c97df30c032de8deb5c8934fc1caa928bc310e2b8a57e',
       },
       MIRROR_DB: {
         DB_USERNAME: null,
         DB_PASSWORD: null,
         DB_NAME: null,
         DB_HOST: null,
       },
     },
     V2: {
       ENABLE: true,
       READ_ONLY: false,
       CADT_API_KEY: null,
       IS_GOVERNANCE_BODY: true,
       GOVERNANCE: {
         GOVERNANCE_BODY_ID: '23f6498e015ebcd7190c97df30c032de8deb5c8934fc1caa928bc310e2b8a57e',
       },
       MIRROR_DB: {
         DB_USERNAME: null,
         DB_PASSWORD: null,
         DB_NAME: null,
         DB_HOST: null,
       },
     },
   };
   ```

**Checkpoint 30.1**: Verify defaultConfig structure matches new format

**STOP HERE - User verifies defaultConfig structure is correct**

### 30.2 Create Config Migration Utility

Create a utility function to migrate existing config files to the new unified format.

**File**: `src/utils/config-migration.js` (new file)

**Functionality**:
1. **Detect old config files**:
   - Check for `~/.chia/mainnet/cadt/v1/config.yaml` (or `${CHIA_ROOT}/cadt/v1/config.yaml`)
   - Check for `~/.chia/mainnet/cadt/v2/config.yaml` (or `${CHIA_ROOT}/cadt/v2/config.yaml`)

2. **Check write permissions**:
   - Verify write permissions to `~/.chia/mainnet/cadt/config.yaml` (or `${CHIA_ROOT}/cadt/config.yaml`)
   - If write permissions are not available, exit with error message:
     ```
     Error: Cannot write to unified config file location: ${CHIA_ROOT}/cadt/config.yaml
     Please ensure the directory exists and has write permissions.
     ```
   - Use `fs.accessSync()` or `fs.promises.access()` to check write permissions

3. **Load existing config files**:
   - Load V1 config if it exists
   - Load V2 config if it exists
   - Use `yaml.load()` to parse existing config files

4. **Merge configs into unified format**:
   - Extract APP section from V1 config (if exists) or use defaults
   - Extract V1-specific sections (ENABLE, READ_ONLY, CADT_API_KEY, IS_GOVERNANCE_BODY, GOVERNANCE, MIRROR_DB) from V1 config
   - Extract V2-specific sections (ENABLE, READ_ONLY, CADT_API_KEY, IS_GOVERNANCE_BODY, GOVERNANCE, MIRROR_DB) from V2 config
   - Merge with defaults from `defaultConfig.js`
   - Handle cases where only V1 or only V2 config exists
   - Handle case where neither config exists (use defaults)

5. **Write unified config file**:
   - Write merged config to `~/.chia/mainnet/cadt/config.yaml` (or `${CHIA_ROOT}/cadt/config.yaml`)
   - Use `yaml.dump()` to write YAML format
   - Ensure directory exists (create if needed with `fs.mkdirSync(..., { recursive: true })`)

6. **Rename old config files**:
   - After successful migration, rename V1 config: `config.yaml` → `config.yaml.old`
   - After successful migration, rename V2 config: `config.yaml` → `config.yaml.old`
   - Add header comment to `.old` files:
     ```yaml
     # This config file has been migrated to the unified config location.
     # New config file location: ~/.chia/mainnet/cadt/config.yaml
     # This file is kept for reference and can be safely deleted.
     #
     ```
   - Then append the original content

7. **Error handling**:
   - If migration fails at any step, do not rename old config files
   - Log errors clearly
   - Exit with appropriate error code if critical errors occur

**Checkpoint 30.2**: Verify migration utility can detect, migrate, and rename old config files

**STOP HERE - User verifies migration utility works correctly**

### 30.3 Update config-loader.js to Use Unified Config

Update the config loader to load from the unified config file and extract V1/V2 sections.

**File**: `src/utils/config-loader.js`

**Changes**:
1. **Update config file path**:
   - Change from `${chiaRoot}/cadt/${dataModelVersion}/config.yaml` to `${chiaRoot}/cadt/config.yaml`
   - Use `getChiaRoot()` to get the base path (preserves CHIA_ROOT variable usage)

2. **Remove `ensureVersionDirectoriesExist` function**:
   - This function creates config files in old locations - remove it entirely
   - Do NOT create config files at `${chiaRoot}/cadt/v1/config.yaml` or `${chiaRoot}/cadt/v2/config.yaml`

3. **Update `loadConfigForVersion` function**:
   - Load unified config file from `${chiaRoot}/cadt/config.yaml`
   - Extract the appropriate section based on `dataModelVersion`:
     - For V1: Merge `config.APP` with `config.V1`
     - For V2: Merge `config.APP` with `config.V2`
   - Merge with defaults from `defaultConfig.js`
   - Handle case where unified config doesn't exist (run migration first, then load)

4. **Add migration check**:
   - Before loading config, check if old config files exist
   - If old config files exist, run migration utility
   - Only proceed with loading after migration completes successfully

5. **Update `getConfig` function**:
   - Should still call `loadConfigForVersion('v1')`
   - But now loads from unified config and merges APP + V1 sections

6. **Update `getConfigV2` function**:
   - Should still call `loadConfigForVersion('v2')`
   - But now loads from unified config and merges APP + V2 sections

7. **Update `getActiveConfig` function**:
   - Should check `configV1?.V1?.ENABLE` and `configV2?.V2?.ENABLE` instead of `configV1?.APP?.ENABLE`
   - Or adjust based on merged structure (after merging APP + V1/V2, ENABLE will be at top level)

8. **Ensure directory exists**:
   - Create `${chiaRoot}/cadt/` directory if it doesn't exist (but NOT v1/v2 subdirectories for config)
   - Create unified config file if it doesn't exist (using defaultConfig structure)

**Checkpoint 30.3**: Verify config loader loads from unified config and merges sections correctly

**STOP HERE - User verifies config loading works with unified config**

### 30.4 Update docker-entrypoint.sh for Unified Config

Update Docker entrypoint script to work with unified config file.

**File**: `docker-entrypoint.sh`

**Changes**:
1. **Update config paths**:
   - Change `V1_CONFIG_PATH` from `/root/.chia/mainnet/cadt/v1/config.yaml` to `/root/.chia/mainnet/cadt/config.yaml`
   - Change `V2_CONFIG_PATH` from `/root/.chia/mainnet/cadt/v2/config.yaml` to `/root/.chia/mainnet/cadt/config.yaml`
   - Actually, both should point to the same unified config file

2. **Update `create_config_if_not_exists` function**:
   - Create unified config file at `/root/.chia/mainnet/cadt/config.yaml`
   - Use new defaultConfig structure (with APP/V1/V2 sections)

3. **Update directory creation**:
   - Create `/root/.chia/mainnet/cadt/` directory (but NOT v1/v2 subdirectories for config)
   - V1 and V2 database directories should still be created (`/root/.chia/mainnet/cadt/v1/` and `/root/.chia/mainnet/cadt/v2/` for databases)

4. **Update environment variable handling**:
   - Environment variables that affect APP section should update `APP.*` paths
   - Environment variables that affect V1 should update `V1.*` paths
   - Environment variables that affect V2 should update `V2.*` paths
   - May need to determine which section based on variable name or add new logic

**Checkpoint 30.4**: Verify Docker entrypoint creates unified config file correctly

**STOP HERE - User verifies Docker entrypoint works with unified config**

### 30.5 Update All Config Access Code

Update all code that accesses config values to use the new merged structure.

**Files to update** (search for `getConfig()` and `getConfigV2()` usage):
1. **`src/config/config.js`**: Update to access merged config structure
2. **`src/config/logger.js`**: Update to access merged config structure
3. **`src/server.js`**: Update to access merged config structure
4. **`src/database/index.js`**: Update to access merged config structure
5. **`src/datalayer/wallet.js`**: Update to access merged config structure
6. **All controller files**: Update to access merged config structure
7. **All background task files**: Update to access merged config structure

**Changes**:
- After merging APP + V1/V2 sections, config structure will have values at top level
- Example: `config.APP.CW_PORT` becomes `config.CW_PORT` after merge
- Example: `config.V1.ENABLE` becomes `config.ENABLE` after merge (for V1 config)
- Example: `config.V2.ENABLE` becomes `config.ENABLE` after merge (for V2 config)
- Most code should continue to work if merge puts values at top level
- Verify all config access patterns work correctly

**Checkpoint 30.5**: Verify all config access code works with merged structure

**STOP HERE - User verifies all config access works correctly**

### 30.6 Add Tests for Config Migration

Create tests to verify config migration works correctly.

**File**: `tests/v2/integration/config-migration.spec.js` (new file)

**Test Cases**:
1. **Test migration from V1 config only**:
   - Create V1 config file with custom values
   - Run migration
   - Verify unified config has APP section + V1 section
   - Verify V1 config renamed to `.old`
   - Verify V2 section uses defaults

2. **Test migration from V2 config only**:
   - Create V2 config file with custom values
   - Run migration
   - Verify unified config has APP section + V2 section
   - Verify V2 config renamed to `.old`
   - Verify V1 section uses defaults

3. **Test migration from both V1 and V2 configs**:
   - Create both V1 and V2 config files with custom values
   - Run migration
   - Verify unified config has APP section + V1 section + V2 section
   - Verify both configs renamed to `.old`
   - Verify APP section merged correctly (prefer V1 APP values if both exist)

4. **Test migration with no existing configs**:
   - Ensure no config files exist
   - Run migration
   - Verify unified config created with defaults

5. **Test write permission check**:
   - Simulate no write permissions to unified config location
   - Verify migration fails with appropriate error
   - Verify old config files not renamed

6. **Test config loading after migration**:
   - Run migration
   - Load V1 config via `getConfig()`
   - Load V2 config via `getConfigV2()`
   - Verify merged structure is correct
   - Verify values match expected merged values

**Checkpoint 30.6**: Verify all config migration tests pass

**STOP HERE - User verifies config migration tests pass**

### 30.7 Update Documentation

Update any documentation that references config file locations.

**Files to check**:
- `README.md` (if exists)
- `docs/` directory files
- Any setup/installation documentation

**Changes**:
- Update references from `~/.chia/mainnet/cadt/v1/config.yaml` to `~/.chia/mainnet/cadt/config.yaml`
- Update references from `~/.chia/mainnet/cadt/v2/config.yaml` to `~/.chia/mainnet/cadt/config.yaml`
- Document new config structure (APP/V1/V2 sections)
- Document migration process (automatic on first run)

**Checkpoint 30.7**: Verify documentation updated

**STOP HERE - User verifies documentation is updated**

### 30.8 Run Full Test Suite

Run the complete test suite to ensure config migration doesn't break existing functionality.

**Command**:
```bash
npm run test:v2
npm test  # Run V1 tests too
```

**Important**: After config migration, verify:
- All existing tests still pass
- Config loading works for both V1 and V2
- No breaking changes to existing functionality
- Migration runs automatically on first startup

**Checkpoint 30.8**: Verify full test suite passes

**STOP HERE - User verifies full test suite passes**

---

## Phase 31: Marketplace and Tokenization Features

Add marketplace and tokenization features to V2, enabling carbon credit units to be listed on marketplaces and tokenized on the Chia blockchain.

**STATUS**: ✅ **COMPLETE** - All marketplace and tokenization features implemented, tested, and documented

**Goals**:
- Add marketplace fields to Units table (`marketplace`, `marketplaceLink`, `marketplaceIdentifier`)
- Add query parameters for marketplace filtering (`marketplaceIdentifiers`, `hasMarketplaceIdentifier`, `onlyTokenizedUnits`)
- Add project-level marketplace filtering (`onlyMarketplaceProjects`)
- Add `getTokenizedProjectIds()` method to ProjectV2 model
- Include marketplace fields in FTS5 search
- Update API documentation with marketplace features
- Create comprehensive tests for all marketplace functionality

**Reference**: See `MARKETPLACE_TOKENIZATION_FEATURES.md` for detailed V1 implementation reference

**Important Notes**:
- **Database fields**: Use snake_case (`marketplace`, `marketplace_link`, `marketplace_identifier`)
- **API fields**: Use camelCase (`marketplace`, `marketplaceLink`, `marketplaceIdentifier`)
- **Tokenization logic**: A tokenized unit must have `marketplace='Tokenized on Chia'` AND `marketplaceIdentifier` is not null
- **Validation**: `marketplaceIdentifier` cannot be empty string (must be null or valid identifier)
- **Work iteratively**: Stop at each checkpoint for user validation before proceeding

### 31.1 Update v2-schema.dat with Marketplace Fields

Add marketplace fields to the `unit` table definition in the DBML schema file.

**File**: `v2-schema.dat`

**Changes**:
1. Add three fields to the `unit` table definition:
   ```dbml
   marketplace varchar [note: 'Name of the marketplace where the unit is listed']
   marketplace_link varchar [note: 'URL link to the unit listing on the marketplace']
   marketplace_identifier varchar [note: 'Unique identifier for the unit on the marketplace']
   ```

2. Place these fields after `unit_itmos_reference_id` and before `created_at` to maintain logical grouping

**Checkpoint 31.1**: Verify schema file includes marketplace fields in correct location

**STOP HERE - User verifies schema file updated correctly**

### 31.2 Update Existing Unit Migration with Marketplace Fields

Add marketplace fields to the existing unit table creation migration.

**File**: `src/database/v2/migrations/20250110120012-create-unit-v2.js`

**Changes**:
1. Add three fields to the `unit` table definition in the `up` method, after `unit_itmos_reference_id` and before `cad_trust_issuance_id`:
   ```javascript
   marketplace: {
     type: Sequelize.STRING(255),
     allowNull: true,
     comment: 'Name of the marketplace where the unit is listed'
   },
   marketplace_link: {
     type: Sequelize.STRING(255),
     allowNull: true,
     comment: 'URL link to the unit listing on the marketplace'
   },
   marketplace_identifier: {
     type: Sequelize.STRING(255),
     allowNull: true,
     comment: 'Unique identifier for the unit on the marketplace'
   },
   ```

2. **Note**: Since there are no running instances, we're updating the existing migration directly rather than creating a new one. Any existing V2 databases can be deleted and recreated.

**Checkpoint 31.2**: Verify migration file includes marketplace fields

**STOP HERE - User verifies migration file updated correctly**

### 31.3 Update v2-example.sql with Marketplace Fields

Add marketplace fields to the `unit` table CREATE statement and include example data.

**File**: `v2-example.sql`

**Changes**:
1. Add three columns to the `unit` table CREATE statement:
   ```sql
   `marketplace` varchar(255) DEFAULT NULL,
   `marketplace_link` varchar(255) DEFAULT NULL,
   `marketplace_identifier` varchar(255) DEFAULT NULL,
   ```

2. Place these columns after `unit_itmos_reference_id` and before `created_at` to match schema

3. Add example data showing marketplace usage:
   - At least one unit with regular marketplace listing (e.g., `marketplace='Demo Marketplace'`, `marketplaceIdentifier='AKFEE3'`)
   - At least one unit with tokenization (`marketplace='Tokenized on Chia'`, `marketplaceIdentifier='CHIA-TOKEN-12345'`)
   - At least one unit without marketplace fields (NULL values)

**Checkpoint 31.3**: Verify SQL file includes marketplace columns and example data

**STOP HERE - User verifies SQL file updated correctly**

### 31.4 Update UnitV2 Model with Marketplace Fields

Add marketplace fields to the UnitV2 model definition.

**File**: `src/models/v2/unit-v2.model.js`

**Changes**:
1. Add three fields to model definition:
   ```javascript
   marketplace: {
     type: Sequelize.STRING(255),
     allowNull: true,
     field: 'marketplace',
     comment: 'Name of the marketplace where the unit is listed'
   },
   marketplaceLink: {
     type: Sequelize.STRING(255),
     allowNull: true,
     field: 'marketplace_link',
     comment: 'URL link to the unit listing on the marketplace'
   },
   marketplaceIdentifier: {
     type: Sequelize.STRING(255),
     allowNull: true,
     field: 'marketplace_identifier',
     comment: 'Unique identifier for the unit on the marketplace'
   }
   ```

2. Place these fields after `unitItmosReferenceId` and before `createdAt` to match schema

3. Update mirror model if needed:
   **File**: `src/models/v2/unit-v2.model.mirror.js`
   - Add same three fields with same definitions

**Checkpoint 31.4**: Verify model includes marketplace fields and can create/read units with marketplace data

**STOP HERE - User verifies model updated correctly**

### 31.5 Update UnitV2 Validation Schema

Add marketplace field validation to UnitV2 validator.

**File**: `src/validators/v2/unit-v2.validator.js`

**Changes**:
1. Add marketplace fields to validation schema:
   ```javascript
   marketplace: Joi.string().allow(null).optional(),
   marketplaceLink: Joi.string().allow(null).optional(),
   marketplaceIdentifier: Joi.string().disallow('').allow(null).optional(),
   ```

2. **Rules**:
   - All marketplace fields are optional
   - `marketplaceIdentifier` cannot be empty string (must be null or valid identifier)
   - No length restrictions on marketplace fields

3. Add query parameter validation:
   ```javascript
   marketplaceIdentifiers: Joi.array()
     .items(Joi.string())
     .single()
     .max(200), // Max 200 marketplace identifiers per query
   hasMarketplaceIdentifier: Joi.boolean(),
   onlyTokenizedUnits: Joi.boolean(),
   ```

**Checkpoint 31.5**: Test validation - verify marketplace fields accepted and empty string rejected for `marketplaceIdentifier`

**STOP HERE - User verifies validation works correctly**

### 31.6 Update UnitV2 Controller: Add Marketplace Query Parameters

Add marketplace filtering logic to UnitV2 controller `findAll` method.

**File**: `src/controllers/v2/unit-v2.controller.js`

**Changes**:
1. Extract query parameters in `findAll` method:
   - `marketplaceIdentifiers` (array of strings)
   - `hasMarketplaceIdentifier` (boolean)
   - `onlyTokenizedUnits` (boolean)

2. Add filtering logic for `marketplaceIdentifiers`:
   ```javascript
   if (marketplaceIdentifiers) {
     where.marketplaceIdentifier = {
       [Sequelize.Op.in]: _.flatten([marketplaceIdentifiers]),
     };
   }
   ```

3. Add filtering logic for `hasMarketplaceIdentifier`:
   ```javascript
   if (hasMarketplaceIdentifier === true) {
     where.marketplaceIdentifier = {
       [Sequelize.Op.not]: null,
     };
   } else if (hasMarketplaceIdentifier === false) {
     where.marketplaceIdentifier = {
       [Sequelize.Op.eq]: null,
     };
   }
   ```

4. Add filtering logic for `onlyTokenizedUnits`:
   ```javascript
   if (onlyTokenizedUnits === true) {
     where.marketplaceIdentifier = {
       [Sequelize.Op.not]: null, // Must have marketplace identifier
     };
     where.marketplace = {
       [Sequelize.Op.eq]: 'Tokenized on Chia', // Must be tokenized on Chia
     };
   } else if (onlyTokenizedUnits === false) {
     where.marketplace = {
       [Sequelize.Op.or]: [
         { [Sequelize.Op.is]: null },
         { [Sequelize.Op.not]: 'Tokenized on Chia' },
       ],
     };
   }
   ```

5. Ensure marketplace fields are included in response serialization (should be automatic via model)

**Checkpoint 31.6**: Test query parameters - verify filtering works for all three parameters

```bash
# Test marketplaceIdentifiers filter
curl "http://localhost:31310/v2/units?marketplaceIdentifiers=AKFEE3,XYZ123"

# Test hasMarketplaceIdentifier filter
curl "http://localhost:31310/v2/units?hasMarketplaceIdentifier=true"

# Test onlyTokenizedUnits filter
curl "http://localhost:31310/v2/units?onlyTokenizedUnits=true"
```

**STOP HERE - User verifies query parameters work correctly**

### 31.7 Update ProjectV2 Model: Add getTokenizedProjectIds Method

Add method to ProjectV2 model to identify projects that have tokenized units.

**File**: `src/models/v2/project-v2.model.js`

**Changes**:
1. Add static method `getTokenizedProjectIds()`:
   ```javascript
   static async getTokenizedProjectIds() {
     const sqlQuery = `
       SELECT DISTINCT project.cad_trust_project_id
       FROM project
       INNER JOIN validation ON project.cad_trust_project_id = validation.cad_trust_project_id
       INNER JOIN verification ON validation.cad_trust_validation_id = verification.cad_trust_validation_id
       INNER JOIN issuance ON verification.cad_trust_verification_id = issuance.cad_trust_verification_id
       INNER JOIN unit ON issuance.cad_trust_issuance_id = unit.cad_trust_issuance_id
       WHERE unit.marketplace_identifier IS NOT NULL
         AND unit.marketplace_identifier != '';
     `;
     const results = await this.sequelize.query(sqlQuery, {
       type: Sequelize.QueryTypes.SELECT,
     });
     return results.map(row => row.cad_trust_project_id);
   }
   ```

2. **Key Logic**:
   - Returns project IDs that have at least one unit with `marketplaceIdentifier` set (not null and not empty)
   - Uses DISTINCT to avoid duplicate project IDs
   - Follows V2 relationship chain: project → validation → verification → issuance → unit

**Checkpoint 31.7**: Test method - verify it returns correct project IDs for projects with marketplace units

**STOP HERE - User verifies method works correctly**

### 31.8 Update ProjectV2 Controller: Add onlyMarketplaceProjects Filter

Add `onlyMarketplaceProjects` query parameter to ProjectV2 controller.

**File**: `src/controllers/v2/project-v2.controller.js`

**Changes**:
1. Extract `onlyMarketplaceProjects` query parameter in `findAll` method

2. Add filtering logic:
   ```javascript
   if (onlyMarketplaceProjects) {
     const marketplaceProjectIds = await ProjectV2.getTokenizedProjectIds();
     if (!where) {
       where = {};
     }
     where.cadTrustProjectId = {
       [Sequelize.Op.in]: marketplaceProjectIds,
     };
   }
   ```

3. **Key Logic**:
   - Uses `ProjectV2.getTokenizedProjectIds()` to find all projects with marketplace units
   - Filters projects to only include those with marketplace units
   - Returns empty array if no projects have marketplace units

**Checkpoint 31.8**: Test query parameter - verify filtering works for `onlyMarketplaceProjects`

```bash
# Test onlyMarketplaceProjects filter
curl "http://localhost:31310/v2/projects?onlyMarketplaceProjects=true"
```

**STOP HERE - User verifies query parameter works correctly**

### 31.9 Update Existing FTS5 Migration: Include Marketplace Fields in Unit Search

Add marketplace fields to the existing FTS5 virtual table migration and triggers for units.

**Files**:
- `src/database/v2/migrations/20250110120031-create-fts5-tables-v2.js` (FTS5 table creation)
- `src/database/v2/migrations/20250110120032-create-fts5-triggers-v2.js` (FTS5 triggers)
- `src/models/v2/unit-v2.model.js` (rebuildFtsTable method)

**Changes**:

1. **Update FTS5 table creation** (`20250110120031-create-fts5-tables-v2.js`):
   - Update the `units_v2_fts` virtual table creation to include marketplace fields (add after `unit_itmos_reference_id`):
     ```sql
     CREATE VIRTUAL TABLE units_v2_fts USING fts5(
       cad_trust_unit_id,
       org_uid,
       unit_serial_id,
       unit_start_block,
       unit_end_block,
       unit_count,
       unit_type,
       unit_vintage_year,
       unit_status,
       unit_status_reason,
       unit_status_date,
       unit_retirement_detail,
       unit_retirement_beneficiary,
       unit_retirement_beneficiary_id,
       unit_link,
       unit_metric,
       unit_current_owner,
       unit_itmos_reference_id,
       marketplace,
       marketplace_link,
       marketplace_identifier,
       cad_trust_issuance_id
     );
     ```

   - Update the initial data population INSERT statement to include marketplace fields:
     ```sql
     INSERT INTO units_v2_fts SELECT
       cad_trust_unit_id,
       org_uid,
       unit_serial_id,
       unit_start_block,
       unit_end_block,
       unit_count,
       unit_type,
       unit_vintage_year,
       unit_status,
       unit_status_reason,
       unit_status_date,
       unit_retirement_detail,
       unit_retirement_beneficiary,
       unit_retirement_beneficiary_id,
       unit_link,
       unit_metric,
       unit_current_owner,
       unit_itmos_reference_id,
       marketplace,
       marketplace_link,
       marketplace_identifier,
       cad_trust_issuance_id
     FROM unit;
     ```

2. **Update FTS5 triggers** (`20250110120032-create-fts5-triggers-v2.js`):
   - Update `unit_v2_insert_fts` trigger to include marketplace fields in INSERT statement
   - Update `unit_v2_update_fts` trigger to include marketplace fields in INSERT OR REPLACE statement
   - Add marketplace fields after `unit_itmos_reference_id` in both triggers:
     ```sql
     marketplace,
     marketplace_link,
     marketplace_identifier,
     ```
   - Add corresponding VALUES in both triggers:
     ```sql
     new.marketplace,
     new.marketplace_link,
     new.marketplace_identifier,
     ```

3. **Update rebuildFtsTable method** (`src/models/v2/unit-v2.model.js`):
   - Update the `rebuildFtsTable()` method's INSERT statement to include marketplace fields
   - Add marketplace fields after `unit_itmos_reference_id` in the SELECT and INSERT statements

4. **Note**: Since there are no running instances, we're updating the existing migrations directly. Any existing V2 databases can be deleted and recreated.

**Checkpoint 31.9**: Verify FTS5 migrations and rebuild method include marketplace fields

**STOP HERE - User verifies FTS5 migrations and rebuild method updated correctly**

### 31.10 Create Unit Marketplace Tests

Create comprehensive tests for marketplace functionality in UnitV2.

**File**: `tests/v2/integration/unit-v2-marketplace.spec.js` (new file)

**Test Cases**:
1. **Basic Marketplace Fields**:
   - Create unit with marketplace fields
   - Update unit to add marketplace fields
   - Update unit to remove marketplace fields
   - Verify marketplace fields returned in responses

2. **marketplaceIdentifiers Query Parameter**:
   - Filter units by single marketplace identifier
   - Filter units by multiple marketplace identifiers
   - Verify empty result for non-existent identifier
   - Verify case sensitivity

3. **hasMarketplaceIdentifier Query Parameter**:
   - Filter units WITH marketplace identifier (`hasMarketplaceIdentifier=true`)
   - Filter units WITHOUT marketplace identifier (`hasMarketplaceIdentifier=false`)
   - Verify correct units returned

4. **onlyTokenizedUnits Query Parameter**:
   - Filter tokenized units (`onlyTokenizedUnits=true`) - must have `marketplace='Tokenized on Chia'` AND `marketplaceIdentifier`
   - Filter non-tokenized units (`onlyTokenizedUnits=false`)
   - Verify regular marketplace listings are NOT included in tokenized results
   - Verify units with `marketplaceIdentifier` but wrong `marketplace` are NOT included

5. **Validation Tests**:
   - Reject empty string for `marketplaceIdentifier` (must be null or valid)
   - Accept null values for all marketplace fields
   - Accept valid marketplace data

6. **FTS Integration**:
   - Search units by marketplace name
   - Search units by marketplace identifier
   - Verify marketplace fields included in FTS search

7. **Edge Cases**:
   - Unit with `marketplace` but no `marketplaceIdentifier`
   - Unit with `marketplaceIdentifier` but no `marketplace`
   - Unit with `marketplace='Tokenized on Chia'` but no `marketplaceIdentifier`
   - Multiple units with same marketplace identifier

**Checkpoint 31.10**: Run Unit marketplace tests

```bash
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/unit-v2-marketplace.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies all Unit marketplace tests pass**

### 31.11 Create Project Marketplace Tests

Create comprehensive tests for marketplace functionality in ProjectV2.

**File**: `tests/v2/integration/project-v2-marketplace.spec.js` (new file)

**Test Cases**:
1. **onlyMarketplaceProjects Query Parameter**:
   - Filter projects with marketplace units (`onlyMarketplaceProjects=true`)
   - Verify projects without marketplace units are excluded
   - Verify projects with tokenized units are included
   - Verify projects with regular marketplace units are included
   - Verify empty result when no projects have marketplace units

2. **getTokenizedProjectIds Method**:
   - Test method returns correct project IDs
   - Test method returns empty array when no projects have marketplace units
   - Test method handles projects with multiple marketplace units (no duplicates)
   - Test method handles projects with tokenized units

3. **Integration with Units**:
   - Create project with units that have marketplace fields
   - Verify project appears in `onlyMarketplaceProjects` results
   - Update unit to add marketplace fields
   - Verify project appears in results after update
   - Update unit to remove marketplace fields
   - Verify project disappears from results if no units have marketplace fields

**Checkpoint 31.11**: Run Project marketplace tests

```bash
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/project-v2-marketplace.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies all Project marketplace tests pass**

### 31.12 Update Existing Unit Tests

Update existing UnitV2 tests to account for marketplace fields.

**File**: `tests/v2/integration/unit-v2.spec.js`

**Changes**:
1. Update test fixtures to optionally include marketplace fields
2. Verify marketplace fields are preserved in update operations
3. Ensure marketplace fields don't break existing functionality
4. Add marketplace fields to test data where appropriate

**Checkpoint 31.12**: Run existing Unit tests to ensure no regressions

```bash
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/unit-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies existing Unit tests still pass**

### 31.13 Update Existing Project Tests

Update existing ProjectV2 tests to account for marketplace functionality.

**File**: `tests/v2/integration/project-v2.spec.js`

**Changes**:
1. Add test cases for `onlyMarketplaceProjects` query parameter
2. Verify `getTokenizedProjectIds()` method integration
3. Ensure marketplace functionality doesn't break existing features

**Checkpoint 31.13**: Run existing Project tests to ensure no regressions

```bash
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/project-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies existing Project tests still pass**

### 31.14 Update API Documentation

Update V2 API documentation to include marketplace and tokenization features.

**File**: `docs/cadt_rpc_api_v2.md`

**Changes**:
1. **Units Section**:
   - Add `marketplace`, `marketplaceLink`, `marketplaceIdentifier` to field descriptions
   - Add these fields to request/response examples
   - Document `marketplaceIdentifiers` query parameter:
     - Description: Filter units by specific marketplace identifiers
     - Usage: `GET /v2/units?marketplaceIdentifiers=AKFEE3,XYZ123`
     - Example response
   - Document `hasMarketplaceIdentifier` query parameter:
     - Description: Filter units based on whether they have a marketplace identifier
     - Usage: `GET /v2/units?hasMarketplaceIdentifier=true` or `?hasMarketplaceIdentifier=false`
     - Example response
   - Document `onlyTokenizedUnits` query parameter:
     - Description: Filter units that have been tokenized on Chia blockchain
     - Usage: `GET /v2/units?onlyTokenizedUnits=true` or `?onlyTokenizedUnits=false`
     - Key Logic: Tokenized units must have `marketplace='Tokenized on Chia'` AND `marketplaceIdentifier` set
     - Example response
   - Add example workflows:
     - Listing a unit on a marketplace
     - Tokenizing a unit on Chia
     - Querying marketplace units

2. **Projects Section**:
   - Document `onlyMarketplaceProjects` query parameter:
     - Description: Filter projects that have at least one unit listed on a marketplace
     - Usage: `GET /v2/projects?onlyMarketplaceProjects=true`
     - Key Logic: Uses `getTokenizedProjectIds()` to find projects with marketplace units
     - Example response
   - Add example workflow:
     - Finding projects with tokenized units

3. **Validation Rules**:
   - Document marketplace field validation rules:
     - All marketplace fields are optional
     - `marketplaceIdentifier` cannot be empty string (must be null or valid identifier)
     - No length restrictions

4. **Use Cases Section** (if exists):
   - Add marketplace integration use case
   - Add tokenization use case
   - Add marketplace tracking use case

5. **Follow V1 Documentation Style**:
   - Match formatting and structure of existing V1 documentation
   - Include clear examples and explanations
   - Document all query parameters with usage examples

**Checkpoint 31.14**: Review documentation to ensure marketplace features are properly documented

**STOP HERE - User verifies documentation is complete and accurate**

### 31.15 Run Full Test Suite

Run the complete V2 test suite to ensure all changes work correctly together and no regressions introduced.

**Command**:
```bash
npm run test:v2
```

**Important**: After adding marketplace fields, verify:
- All existing tests still pass
- New marketplace tests pass
- FTS tests still work with marketplace fields
- No breaking changes to existing functionality

**Checkpoint 31.15**: Verify all V2 tests pass (including new marketplace tests)

**STOP HERE - User verifies full test suite passes**

---

## Summary of Phase 31 Implementation

**Marketplace Features Added**:
- ✅ Three marketplace fields added to Units table (`marketplace`, `marketplaceLink`, `marketplaceIdentifier`)
- ✅ Query parameters for marketplace filtering (`marketplaceIdentifiers`, `hasMarketplaceIdentifier`, `onlyTokenizedUnits`)
- ✅ Project-level marketplace filtering (`onlyMarketplaceProjects`)
- ✅ `getTokenizedProjectIds()` method in ProjectV2 model
- ✅ Marketplace fields included in FTS5 search
- ✅ Comprehensive validation rules
- ✅ Comprehensive test coverage
- ✅ Complete API documentation

**Key Features**:
- Units can be listed on external carbon credit marketplaces
- Units can be tokenized on Chia blockchain (`marketplace='Tokenized on Chia'`)
- Filter units by marketplace identifiers
- Filter units by tokenization status
- Filter projects that have marketplace units
- Full-text search includes marketplace fields

**Expected Results**:
- Users can create/update units with marketplace information
- Users can query units by marketplace status and identifiers
- Users can identify tokenized units (`marketplace='Tokenized on Chia'`)
- Users can find projects with marketplace units
- FTS search includes marketplace fields
- All V2 tests pass with marketplace features integrated
