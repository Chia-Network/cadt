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

**CURRENT STATUS:** ✅ ALL API ENDPOINTS COMPLETED - V2 API is fully implemented with 21 endpoints

**COMPLETED ENDPOINTS (21 total):**
- Core: Methodology, Program, Project, Validation, Verification, Issuance, Unit, Location (8 endpoints)
- Tier 1: Estimation, Rating, Co-Benefit (3 endpoints)
- Tier 4: Project-Methodology, Stakeholder, Stakeholder-Projects, Label, Unit-Label (5 endpoints)
- Tier 5: AEF-T1-Submission, AEF-T5-Authorized-Entities, AEF-T2-Authorizations, AEF-T3-Actions, AEF-T4-Holdings (5 endpoints)

**KEY ACHIEVEMENTS:**
- ✅ V2-only smoke test created and passing (14/14 tests)
- ✅ All system models implemented and working (21 data models)
- ✅ All 21 API endpoints fully implemented with CRUD operations
- ✅ V1/V2 isolation maintained
- ✅ Snake_case database naming convention enforced
- ✅ Real picklist values integrated from governance CSV data
- ✅ Comprehensive test utilities for picklist validation
- ✅ UUID deprecation warnings fixed for V2
- ✅ Foreign key validation working (checks both main table and staging)
- ✅ All infrastructure verified and working

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

## Notes

- **V1 is frozen** - bugfixes only, no feature development
- Each checkpoint requires user verification before continuing
- Stop immediately if tests fail - don't accumulate issues
- Update plan as we discover better approaches

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
