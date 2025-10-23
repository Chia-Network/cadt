# V2 API Iterative Development Plan

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

## Reference Documents

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

- [ ] Verify/create V2 database directory structure (`~/.chia/mainnet/cadt/v2/`)
- [ ] Create database configuration for V2 (separate from V1)
- [ ] Set up migration runner for V2

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

- [ ] Create `src/models/v2/` directory
- [ ] Create `src/validations/v2/` directory
- [ ] Create `src/controllers/v2/` directory
- [ ] Create `src/routes/v2/` directory
- [ ] Create `tests/v2/` directory structure

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

- [ ] Set up V2 test configuration (mimic V1)
- [ ] Create test utilities and helpers
- [ ] Create test fixtures for system tables
- [ ] Create a minimal smoke test

**Checkpoint 1.4**: Run smoke test

```bash
# Start server
npm start
# Run the smoke test (should pass even if empty)
npm test -- tests/v2/smoke.spec.js
# Should see: "V2 Infrastructure - smoke test passes"
# Kill server
```

**STOP HERE - User verifies smoke test passes**

## Phase 2: Core System Models

Build models for system tables (needed by all endpoints):

### 2.1 System Table Models

- [ ] `staging-v2.modeltypes.cjs` + `staging-v2.model.js`
- [ ] `organizations-v2.modeltypes.cjs` + `organizations-v2.model.js`
- [ ] `meta-v2.modeltypes.cjs` + `meta-v2.model.js`
- [ ] `governance-v2.modeltypes.cjs` + `governance-v2.model.js`
- [ ] `audit-v2.modeltypes.cjs` + `audit-v2.model.js` + mirror
- [ ] `simulator-v2.modeltypes.cjs` + `simulator-v2.model.js`
- [ ] Export all from `src/models/v2/index.js`

**Checkpoint 2.1**: Verify models load

```bash
# Start server - should load without errors
npm start
# Check server logs for model initialization
# Kill server
```

**STOP HERE - User verifies models initialize without errors**

### 2.2 Utility Functions

- [ ] Create `src/utils/v2-data-assertions.js`
- [ ] Implement `assertRecordExistanceOrStaged()` for FK validation
- [ ] Test utility functions

**Checkpoint 2.2**: Test utility functions

```bash
# Run utility tests
npm test -- tests/v2/utils/v2-data-assertions.spec.js
```

**STOP HERE - User verifies utility tests pass**

## Phase 3: First Endpoint - Methodology (Simplest, No Dependencies)

Methodology has no foreign key dependencies and simple structure - ideal first endpoint.

### 3.1 Methodology Schema & Migration

- [ ] Review methodology fields in `v2-schema.dat`
- [ ] Create methodology migration
- [ ] Run migration, verify table created

**Checkpoint 3.1**: Verify methodology table

```bash
# Start server to run migration
npm start
sqlite3 ~/.chia/mainnet/cadt/v2/data.sqlite3 ".schema methodology"
# Kill server
```

**STOP HERE - User verifies methodology table created correctly**

### 3.2 Methodology Model

- [ ] Create `methodology-v2.modeltypes.cjs`
- [ ] Create `methodology-v2.model.js`
- [ ] Create `methodology-v2.model.mirror.js`
- [ ] Update model index exports

**Checkpoint 3.2**: Verify model loads

```bash
npm start
# Check logs for methodology model initialization
# Kill server
```

**STOP HERE - User verifies model loads without errors**

### 3.3 Minimal Methodology Endpoint (No Validations)

- [ ] Create basic validation schema (all fields optional)
- [ ] Create methodology controller (or use generic factory)
- [ ] Create methodology routes
- [ ] Mount routes in V2 router

**Checkpoint 3.3**: Test endpoint exists

```bash
npm start
curl http://localhost:31310/v2/methodology
# Should return empty array or error (not 404)
# Kill server
```

**STOP HERE - User verifies endpoint responds**

### 3.4 Basic Methodology Tests

- [ ] Test POST /v2/methodology (create)
- [ ] Test GET /v2/methodology (list)
- [ ] Test GET /v2/methodology/:id (get one)
- [ ] Test PUT /v2/methodology/:id (update)
- [ ] Test DELETE /v2/methodology/:id (delete)

**Checkpoint 3.4**: Run CRUD tests

```bash
# Run ONLY V2 methodology tests (not all V1 tests)
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/methodology-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies all basic CRUD tests pass**

### 3.5 Add Methodology Validations

- [ ] Add required field validations
- [ ] Add picklist validation for `methodology_type`
- [ ] Add field type validations
- [ ] Test validation errors

**Checkpoint 3.5**: Run validation tests

```bash
# Run ONLY V2 methodology tests (not all V1 tests)
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/methodology-v2.spec.js --reporter spec --exit --timeout 300000
```

**STOP HERE - User verifies all validation tests pass**

## Phase 4: Second Endpoint - Program (Simple, Independent)

Program table is independent (no FK dependencies from other data tables).

### 4.1 Program Schema & Migration

- [ ] Review program fields in `v2-schema.dat`
- [ ] Create program migration
- [ ] Run migration

**STOP - User verifies program table created**

### 4.2 Program Model

- [ ] Create model types
- [ ] Create model and mirror
- [ ] Update exports

**STOP - User verifies model loads**

### 4.3 Program Endpoint + Tests

- [ ] Create minimal validation
- [ ] Create controller/routes
- [ ] Write basic CRUD tests
- [ ] Verify tests pass

**STOP - User verifies CRUD tests pass**

### 4.4 Program Validations + Tests

- [ ] Add required fields
- [ ] Add validation tests
- [ ] Verify all tests pass

**STOP - User verifies validation tests pass**

## Phase 5: Third Endpoint - Project (Core Entity)

Project is central to the schema. Build it before dependent tables.

### 5.1 Project Schema & Migration

- [ ] Review project fields in `v2-schema.dat`
- [ ] Note FK to program table
- [ ] Create project migration
- [ ] Run migration

**STOP - User verifies project table created**

### 5.2 Project Model

- [ ] Create model types
- [ ] Create model and mirror
- [ ] Set up associations (belongsTo Program)
- [ ] Update exports

**STOP - User verifies model loads with associations**

### 5.3 Project Endpoint + Tests

- [ ] Create minimal validation
- [ ] Create controller/routes
- [ ] Write basic CRUD tests (with valid program FK)
- [ ] Test FK validation (invalid program should fail)
- [ ] Verify tests pass

**STOP - User verifies CRUD and FK tests pass**

### 5.4 Project Validations + Tests

- [ ] Add required fields validation
- [ ] Add picklist validations (sector, type, status, unit_metric)
- [ ] Add validation tests
- [ ] Verify all tests pass

**STOP - User verifies validation tests pass**

## Remaining Endpoints (Phases 6-25)

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
- Reference `v2-plan.md` for detailed specifications

## Testing Commands

**IMPORTANT**: Always run V2 tests individually to avoid V1 test interference:

```bash
# Run specific V2 test file
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/methodology-v2.spec.js --reporter spec --exit --timeout 300000

# Run specific test by name
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/integration/methodology-v2.spec.js --reporter spec --exit --timeout 300000 --grep "test name"

# Run all V2 tests
npx cross-env NODE_ENV=test USE_SIMULATOR=true mocha --loader node_modules/extensionless/src/register.js tests/v2/ --reporter spec --exit --timeout 300000
```

**DO NOT USE**: `npm test` without specifying V2 test files, as this runs all V1 tests and causes migration conflicts.
