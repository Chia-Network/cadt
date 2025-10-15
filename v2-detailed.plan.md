<!-- ed91fde1-60ba-4a45-af99-4406671c3d30 9813206f-52c8-4446-bd47-380c54566de0 -->
<!-- ed91fde1-60ba-4a45-af99-4406671c3d30 2ce4cf72-250d-4d0c-adc3-497d11e480b6 -->

# V2 API Implementation Plan

## Overview

Implement complete REST API endpoints for V2 database tables following V1 patterns and coding conventions. All V2 tables will be in the v2 database (completely separate from v1), but will share similar controller logic where functionality is identical.

## Phase 1: Add System Tables to V2 Database

### Create V2 System Table Migrations

Create migrations for 6 required system tables in `src/database/v2/migrations/`:

1. **staging** (`20250110120000-create-staging-v2.js`)

- Fields: id, uuid, table, action, data, commited, failedCommit, isTransfer, createdAt, updatedAt

2. **audit** (`20250110120001-create-audit-v2.js`)

- Fields: id, orgUid, registryId, rootHash, type, change, table, onchainConfirmationTimeStamp, author, comment, generation, createdAt, updatedAt

3. **organizations** (`20250110120002-create-organizations-v2.js`)

- Fields: orgUid (PK), name, icon, registryId, registryHash, subscribed, synced, fileStoreSubscribed, sync_remaining, balance, pendingBalance, isHome, createdAt, updatedAt

4. **meta** (`20250110120003-create-meta-v2.js`)

- Fields: metaKey (PK), metaValue, createdAt, updatedAt

5. **governance** (`20250110120004-create-governance-v2.js`)

- Fields: metaKey (PK), metaValue, createdAt, updatedAt

6. **simulator** (`20250110120005-create-simulator-v2.js`)

- Fields: id (PK), key, value, createdAt, updatedAt

Update `src/database/v2/migrations/index.js` to include these new migrations.

## Phase 2: Create V2 Models

### Create Model Types (*.modeltypes.cjs)

Create in `src/models/v2/`:

- `staging-v2.modeltypes.cjs`
- `audit-v2.modeltypes.cjs`
- `organizations-v2.modeltypes.cjs`
- `meta-v2.modeltypes.cjs`
- `governance-v2.modeltypes.cjs`
- `simulator-v2.modeltypes.cjs`
- All 21 data table model types (project, validation, verification, issuance, unit, methodology, project-methodology, location, stakeholder, stakeholder-projects, label, unit-label, co-benefit, estimation, rating, activity, aef-t1-submission, aef-t2-authorizations, aef-t3-actions, aef-t4-holdings, aef-t5-authorized-entities)

### Create Sequelize Models

Create regular models (*.model.js) for ALL tables and mirror models (*.model.mirror.js) ONLY for data tables.

**Data Tables - Create BOTH .model.js AND .model.mirror.js (22 tables):**

1. project (already created)
2. validation (already created)
3. verification
4. issuance (already created)
5. unit (already created)
6. methodology
7. project-methodology
8. location
9. stakeholder
10. stakeholder-projects
11. label
12. unit-label
13. co-benefit
14. estimation
15. rating
16. activity
17. aef-t1-submission
18. aef-t2-authorizations
19. aef-t3-actions
20. aef-t4-holdings
21. aef-t5-authorized-entities
22. audit (system table but IS mirrored like v1)

**System Tables - Create ONLY .model.js, NO mirror models (5 tables):**

1. staging (no mirror)
2. organizations (no mirror)
3. meta (no mirror)
4. governance (no mirror)
5. simulator (no mirror)

Update `src/models/v2/index.js` to export all models.

## Phase 3: Create V2 Validations

Create validation schemas in `src/validations/v2/`:

- Map v2 database field names (snake_case) to API field names (camelCase)
- Example: `cad_trust_project_id` → `cadTrustProjectId`, `project_registry_name` → `projectRegistryName`
- **CRITICAL: Any field marked as NOT NULL in database MUST be `.required()` in Joi validation**
- Fields with `allowNull: false` or `required: true` in migrations → `.required()` in Joi
- Optional fields (nullable in database) → `.optional()` in Joi

**Example validation mapping:**

```javascript
// Database migration:
projectRegistryName: {
  type: Sequelize.STRING,
  allowNull: false,  // NOT NULL
}

// Joi validation:
projectRegistryName: Joi.string().required(),  // REQUIRED

// Database migration:
projectDescription: {
  type: Sequelize.TEXT,
  allowNull: true,  // NULLABLE
}

// Joi validation:
projectDescription: Joi.string().optional(),  // OPTIONAL
```

**Picklist Validation (CRITICAL):**

All fields marked as `picklist` in v2-sql.dat MUST use `.custom(pickListValidation())`:

```javascript
// v2-sql.dat: project_sector picklist [note: 'picklist from sector type']
projectSector: Joi.string()
  .custom(pickListValidation('projectSector'))
  .optional(),  // or .required() based on NOT NULL

// v2-sql.dat: unit_type picklist [note: 'picklist from unit type']
unitType: Joi.string()
  .custom(pickListValidation('unitType'))
  .required(),

// v2-sql.dat: location_country picklist [note: 'picklist from country']
locationCountry: Joi.string()
  .custom(pickListValidation('countries', 'locationCountry'))
  .optional(),
```

**V2 Fields Requiring Picklist Validation (from v2-sql.dat):**

1. **project table:**
   - `project_sector` → `pickListValidation('projectSector')`
   - `project_type` → `pickListValidation('projectType')`
   - `project_status` → `pickListValidation('projectStatusValues', 'projectStatus')`
   - `project_unit_metric` → `pickListValidation('unitMetric')`

2. **validation table:**
   - `validation_type` → `pickListValidation('validationType')`
   - `validation_body` → `pickListValidation('validationBody')`

3. **verification table:**
   - `verification_body` → `pickListValidation('verificationBody')`

4. **unit table:**
   - `unit_type` → `pickListValidation('unitType')`
   - `unit_status` → `pickListValidation('unitStatus')`
   - `unit_metric` → `pickListValidation('unitMetric')`

5. **methodology table:**
   - `methodology_type` → `pickListValidation('methodologyType')`

6. **location table:**
   - `location_country` → `pickListValidation('countries', 'locationCountry')`

7. **stakeholder table:**
   - `stakeholder_type` → `pickListValidation('stakeholderType')`

8. **label table:**
   - `label_type` → `pickListValidation('labelType')`

9. **co_benefit table:**
   - `co_benefit_id` → `pickListValidation('coBenefits', 'coBenefitId')`

10. **rating table:**
    - `rating_type` → `pickListValidation('ratingType')`

11. **aef_t2_authorizations table:**
    - `aef_t2_authorizations_metric` → `pickListValidation('unitMetric')`
    - `aef_t2_authorizations_sector` → `pickListValidation('projectSector')`
    - `aef_t2_authorizations_activity_type` → `pickListValidation('activityType')`
    - `aef_t2_authorizations_purposes_for_authorization` → `pickListValidation('authorizationPurpose')`

12. **aef_t3_actions table:**
    - `aef_t3_actions_type` → `pickListValidation('actionType')`
    - `aef_t3_actions_metric` → `pickListValidation('unitMetric')`
    - `aef_t3_actions_mitigation_type` → `pickListValidation('mitigationType')`

13. **aef_t4_holdings table:**
    - `aef_t4_holdings_metric` → `pickListValidation('unitMetric')`
    - `aef_t4_holdings_mitigation_type` → `pickListValidation('mitigationType')`

14. **aef_t5_authorized_entities table:**
    - `aef_t5_authorized_entities_incorporation_country` → `pickListValidation('countries')`

**Picklist values are sourced from:**

- V1 governance table (same picklists as V1)
- Loaded via `getPicklistValues()` from `src/utils/data-loaders.js`
- In dev/simulator mode: uses stub data from `src/models/governance/governance.stub.js`

**Error message when validation fails:**

```json
{
  "message": "Error creating new project",
  "error": "projectSector does not include a valid option Agriculture; forestry and fishing, Mining and quarrying, ... instead got 'Invalid Sector'",
  "success": false
}
```

Validation files needed:

- `project-v2.validations.js`
- `validation-v2.validations.js`
- `verification-v2.validations.js`
- `issuance-v2.validations.js`
- `unit-v2.validations.js`
- `methodology-v2.validations.js`
- `project-methodology-v2.validations.js`
- `location-v2.validations.js`
- `stakeholder-v2.validations.js`
- `stakeholder-projects-v2.validations.js`
- `label-v2.validations.js`
- `unit-label-v2.validations.js`
- `co-benefit-v2.validations.js`
- `estimation-v2.validations.js`
- `rating-v2.validations.js`
- `activity-v2.validations.js`
- `aef-t1-submission-v2.validations.js`
- `aef-t2-authorizations-v2.validations.js`
- `aef-t3-actions-v2.validations.js`
- `aef-t4-holdings-v2.validations.js`
- `aef-t5-authorized-entities-v2.validations.js`
- `staging-v2.validations.js`
- `audit-v2.validations.js`

Update `src/validations/v2/index.js` to export all schemas.

## Phase 4: Create V2 Utilities

Create `src/utils/v2-data-assertions.js` with enhanced foreign key validation that checks both main table and staging.

## Phase 5: Create Shared Controller Architecture (MAJOR SIMPLIFICATION)

### Overview: 80% Code Reuse Strategy

Instead of creating 25 separate V2 controllers, we'll create **shared generic controllers** that work for both V1 and V2 by accepting model and validation schema parameters.

### Architecture Benefits

✅ **Single source of truth** - Fix bugs once, applies to both versions
✅ **80% code reuse** - Shared business logic, separate configs
✅ **Maintainability** - Easier to maintain one codebase
✅ **Consistency** - Same behavior across versions
✅ **Flexibility** - Can override specific methods when versions differ

### Directory Structure

```
src/
├── controllers/
│   ├── generic/
│   │   ├── resource.controller.js       ← SHARED CRUD controller factory
│   │   ├── staging.controller.js        ← SHARED staging logic (parameterized)
│   │   ├── audit.controller.js          ← SHARED audit logic (parameterized)
│   │   └── index.js
│   ├── v1/
│   │   └── index.js                     ← V1 controller instances (thin wrappers)
│   └── v2/
│       └── index.js                     ← V2 controller instances (thin wrappers)
├── services/
│   ├── resource.service.js              ← SHARED business logic
│   ├── staging.service.js               ← SHARED staging service
│   └── datalayer.service.js             ← SHARED datalayer operations
└── models/
    ├── v1/ (existing)
    └── v2/ (new - MUST be separate)
```

### Phase 5.1: Create Generic Resource Controller Factory

Create `src/controllers/generic/resource.controller.js`:

```javascript
import { uuid as uuidv4 } from 'uuidv4';
import { assertIfReadOnlyMode, assertHomeOrgExists, assertNoPendingCommits } from '../../utils/data-assertions';
import { optionallyPaginatedResponse, paginationParams } from '../../utils/helpers';

/**
 * Creates a generic CRUD controller for any resource
 * @param {Object} config - Configuration object
 * @param {Model} config.Model - Sequelize model
 * @param {Model} config.StagingModel - Staging model
 * @param {Object} config.validationSchema - Joi validation schema
 * @param {string} config.primaryKey - Primary key field name
 * @param {string} config.tableName - Table name for staging
 * @param {Function} config.assertRecordExistance - FK validation function
 * @returns {Object} Controller with CRUD methods
 */
export const createResourceController = ({
  Model,
  StagingModel,
  validationSchema,
  primaryKey,
  tableName,
  assertRecordExistance,
}) => {
  return {
    async create(req, res) {
      try {
        await assertIfReadOnlyMode();
        await assertHomeOrgExists();

        const newRecord = req.body;

        // Generate UUID for primary key
        const uuid = uuidv4();
        newRecord[primaryKey] = uuid;

        // Validate foreign keys
        // (Specific FK validation logic per model - can be passed as config)

        // Stage the record
        await StagingModel.create({
          uuid,
          table: tableName,
          action: 'INSERT',
          data: JSON.stringify([newRecord]),
        });

        res.json({
          message: `${tableName} staged successfully`,
          uuid,
        });
      } catch (error) {
        res.status(400).json({
          message: `Error creating new ${tableName}`,
          error: error.message,
          success: false,
        });
      }
    },

    async findAll(req, res) {
      try {
        const { page, limit, orgUid, search } = req.query;
        const pagination = paginationParams(page, limit);

        const where = {};
        if (orgUid) where.orgUid = orgUid;
        // Add search logic if needed

        const records = await Model.findAndCountAll({
          where,
          ...pagination,
        });

        res.json(optionallyPaginatedResponse(records, page, limit));
      } catch (error) {
        res.status(400).json({
          message: `Error retrieving ${tableName}`,
          error: error.message,
          success: false,
        });
      }
    },

    async findOne(req, res) {
      try {
        const { id } = req.params;
        const record = await Model.findByPk(id);

        if (!record) {
          return res.status(404).json({
            message: `${tableName} not found`,
            success: false,
          });
        }

        res.json(record);
      } catch (error) {
        res.status(400).json({
          message: `Error retrieving ${tableName}`,
          error: error.message,
          success: false,
        });
      }
    },

    async update(req, res) {
      try {
        await assertIfReadOnlyMode();
        await assertHomeOrgExists();
        await assertNoPendingCommits();

        const { id } = req.params;
        const updateData = req.body;

        // Verify record exists
        await assertRecordExistance(Model, id);

        // Stage the update
        await StagingModel.create({
          uuid: uuidv4(),
          table: tableName,
          action: 'UPDATE',
          data: JSON.stringify([{ [primaryKey]: id, ...updateData }]),
        });

        res.json({
          message: `${tableName} update staged successfully`,
        });
      } catch (error) {
        res.status(400).json({
          message: `Error updating ${tableName}`,
          error: error.message,
          success: false,
        });
      }
    },

    async destroy(req, res) {
      try {
        await assertIfReadOnlyMode();
        await assertHomeOrgExists();
        await assertNoPendingCommits();

        const { id } = req.params;

        // Verify record exists
        await assertRecordExistance(Model, id);

        // Stage the delete
        await StagingModel.create({
          uuid: uuidv4(),
          table: tableName,
          action: 'DELETE',
          data: JSON.stringify([{ [primaryKey]: id }]),
        });

        res.json({
          message: `${tableName} delete staged successfully`,
        });
      } catch (error) {
        res.status(400).json({
          message: `Error deleting ${tableName}`,
          error: error.message,
          success: false,
        });
      }
    },
  };
};
```

### Phase 5.2: Create V2 Controller Instances

Create `src/controllers/v2/index.js` with thin wrappers:

```javascript
import { createResourceController } from '../generic/resource.controller.js';
import * as V2Models from '../../models/v2/index.js';
import * as V2Validations from '../../validations/v2/index.js';
import { assertRecordExistance } from '../../utils/data-assertions.js';
import { assertRecordExistanceOrStaged } from '../../utils/v2-data-assertions.js';

// Project Controller
export const ProjectV2Controller = createResourceController({
  Model: V2Models.ProjectV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.projectV2Schema,
  primaryKey: 'cadTrustProjectId',
  tableName: 'project',
  assertRecordExistance: assertRecordExistanceOrStaged,
});

// Validation Controller
export const ValidationV2Controller = createResourceController({
  Model: V2Models.ValidationV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.validationV2Schema,
  primaryKey: 'cadTrustValidationId',
  tableName: 'validation',
  assertRecordExistance: assertRecordExistanceOrStaged,
});

// ... repeat for all 21 data tables

// Methodology Controller
export const MethodologyV2Controller = createResourceController({
  Model: V2Models.MethodologyV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.methodologyV2Schema,
  primaryKey: 'cadTrustMethodologyId',
  tableName: 'methodology',
  assertRecordExistance: assertRecordExistanceOrStaged,
});

// Unit Controller
export const UnitV2Controller = createResourceController({
  Model: V2Models.UnitV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.unitV2Schema,
  primaryKey: 'cadTrustUnitId',
  tableName: 'unit',
  assertRecordExistance: assertRecordExistanceOrStaged,
});

// Continue for all 21 data tables...
```

### What's Shared vs Separate

**✅ SHARED (Same Code):**

- Generic resource controller factory
- Staging commit/retry/clean logic
- Datalayer write service (`writeService.js`)
- Datalayer read utilities (`encodeHex`, `decodeHex`)
- Validation utilities (`pickListValidation`)
- Data assertions (`assertIfReadOnlyMode`, etc.)
- XLS/CSV transformation (`transformFullXslsToChangeList`)
- Background task scheduling framework

**❌ SEPARATE (Different Files):**

- Models (different schemas, tables, databases)
- Migrations (different schemas)
- Validation schemas (different field names)
- Controller instances (different model bindings)
- Routes (different mount points: `/v1` vs `/v2`)

### Controllers Needed (Thin Wrappers Only)

Create **one file** `src/controllers/v2/index.js` with 25 controller instances:

1-21. All data table controllers (using `createResourceController`)
22. Staging controller (using `createStagingController` with StagingV2)
23. Audit controller (using `createAuditController` with AuditV2)
24. Organizations controller (extend existing with v2 support)
25. Governance controller (already version-aware, minimal changes)

**Total code:** ~200 lines vs ~5000 lines if fully duplicated!

## Phase 12: V2 Offer/Transfer System

The offer system enables transferring carbon credits between organizations via datalayer offers. V2 will implement full offer functionality following the V1 pattern.

### Overview

Offers allow two organizations to atomically exchange climate data via datalayer's offer mechanism:
- **Maker** (creating offer) - Specifies what they want to give
- **Taker** (accepting offer) - Reviews and accepts the offer
- Datalayer ensures atomic swap (both changes happen or neither does)

### Offer Workflow

1. **Generate Offer** (Maker) - Create transfer, stage it, generate offer file
2. **Export Offer** (Maker) - Download offer file to share with taker
3. **Import Offer** (Taker) - Upload offer file, stage changes
4. **Review Offer** (Taker) - Inspect what will be transferred
5. **Accept Offer** (Taker) - Commit offer to datalayer
6. **Complete** (Both) - Datalayer executes atomic swap

### Phase 12.1: Adapt Staging Model for V2 Offers

Extend `StagingV2` model with offer generation method in `src/models/v2/staging-v2.model.js`:

```javascript
static async generateOfferFile() {
  // Find transfer staging record
  const stagingRecord = await StagingV2.findOne({
    where: { isTransfer: true },
    raw: true,
  });

  if (!stagingRecord) {
    throw new Error('No transfer record found in v2 staging');
  }

  // Parse staged project data
  const makerProjectRecord = _.head(JSON.parse(stagingRecord.data));

  // Get home organization
  const myOrganization = await Organization.findOne({
    where: { isHome: true },
    raw: true,
  });

  // Get taker organization
  const takerOrganization = await Organization.findOne({
    where: { orgUid: makerProjectRecord.orgUid },
    raw: true,
  });

  // Use V2 registry stores (NOT v1)
  const maker = {
    storeId: myOrganization.v2RegistryId,  // V2 registry
    inclusions: []
  };

  const taker = {
    storeId: takerOrganization.v2RegistryId,  // V2 registry
    inclusions: []
  };

  // Find project with all associations in V2 database
  const takerProjectRecord = await ProjectV2.findOne({
    where: { cadTrustProjectId: makerProjectRecord.cadTrustProjectId },
    include: ProjectV2.getAssociatedModels(),
  });

  // Update taker's project status
  takerProjectRecord.projectStatus = 'Transitioned';

  // Generate new IDs for maker
  const newMakerProjectId = uuidv4();
  makerProjectRecord.cadTrustProjectId = newMakerProjectId;
  makerProjectRecord.orgUid = myOrganization.orgUid;

  // Handle child records (validations, verifications, locations, etc.)
  // Generate new UUIDs and reassign to maker's org

  // Handle units - change status to 'Exported'
  const issuanceIds = takerProjectRecord.issuances.map(iss => iss.cadTrustIssuanceId);
  let unitTakerRecords = await UnitV2.findAll({
    where: {
      cadTrustIssuanceId: { [Op.in]: issuanceIds },
      orgUid: takerProjectRecord.orgUid,
    },
    raw: true,
  });

  unitTakerRecords = unitTakerRecords.map((record) => {
    record.unitStatus = 'Exported';
    return record;
  });

  const unitMakerRecords = unitTakerRecords.map((record) => {
    return { ...record, orgUid: myOrganization.orgUid, cadTrustUnitId: uuidv4() };
  });

  // Create XLS sheets for transformation
  const takerProjectXslsSheets = createXlsFromSequelizeResults({
    rows: [takerProjectRecord],
    model: ProjectV2,
    toStructuredCsv: true,
  });

  const makerProjectXslsSheets = createXlsFromSequelizeResults({
    rows: [makerProjectRecord],
    model: ProjectV2,
    toStructuredCsv: true,
  });

  // Transform to change lists using V2 primary key map
  const V2_PRIMARY_KEY_MAP = {
    project: 'cadTrustProjectId',
    validation: 'cadTrustValidationId',
    verification: 'cadTrustVerificationId',
    issuance: 'cadTrustIssuanceId',
    unit: 'cadTrustUnitId',
    methodology: 'cadTrustMethodologyId',
    project_methodology: 'id',
    location: 'cadTrustLocationId',
    stakeholder: 'cadTrustStakeholderId',
    stakeholder_projects: 'cadTrustStakeholderProjectId',
    label: 'cadTrustLabelId',
    unit_label: 'id',
    co_benefit: 'cadTrustCoBenefitId',
    estimation: 'cadTrustEstimationId',
    rating: 'cadTrustRatingId',
    activity: 'cadTrustActivityId',
    aef_t1_submission: 'cadTrustAefT1SubmissionId',
    aef_t2_authorizations: 'cadTrustAefT2AuthorizationsId',
    aef_t3_actions: 'cadTrustAefT3ActionsId',
    aef_t4_holdings: 'cadTrustAefT4HoldingsId',
    aef_t5_authorized_entities: 'cadTrustAefT5AuthorizedEntitiesId',
  };

  const makerInclusions = await transformFullXslsToChangeList(
    makerProjectXslsSheets,
    'insert',
    V2_PRIMARY_KEY_MAP
  );

  const takerInclusions = await transformFullXslsToChangeList(
    takerProjectXslsSheets,
    'insert',
    V2_PRIMARY_KEY_MAP
  );

  // Format and add to maker/taker
  maker.inclusions.push(...formatForOfferTransfer(makerInclusions));
  taker.inclusions.push(...formatForOfferTransfer(takerInclusions));

  // Generate and make offer
  const offerInfo = generateOffer(maker, taker);
  const offerResponse = await makeOffer(offerInfo);

  if (!offerResponse.success) {
    throw new Error(offerResponse.error);
  }

  // Save active offer trade ID to V2 meta table
  await MetaV2.upsert({
    metaKey: 'activeOfferTradeId',
    metaValue: offerResponse.offer.trade_id,
  });

  return _.omit(offerResponse, ['success']);
}
```

### Phase 12.2: Create V2 Offer Controller

Create `src/controllers/v2/offer-v2.controller.js`:

```javascript
export const generateOfferFile = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertStagingTableNotEmpty(StagingV2);
    await assertHomeOrgExists();
    await assertWalletIsSynced();
    await assertNoPendingCommitsExcludingTransfers(StagingV2);

    const offerFile = await StagingV2.generateOfferFile();
    res.json(offerFile);
  } catch (error) {
    res.status(400).json({
      message: 'Error generating V2 offer file',
      error: error.message,
      success: false,
    });
  }
};

export const cancelActiveOffer = async (req, res) => {
  try {
    await assertIfReadOnlyMode();

    const activeOffer = await MetaV2.findOne({
      where: { metaKey: 'activeOfferTradeId' },
    });

    if (activeOffer) {
      await datalayer.cancelOffer(activeOffer.metaValue);
    }

    await Promise.all([
      MetaV2.destroy({ where: { metaKey: 'activeOfferTradeId' } }),
      StagingV2.destroy({ where: { isTransfer: true } }),
    ]);

    res.json({ message: 'V2 offer canceled successfully' });
  } catch (error) {
    res.status(400).json({
      message: 'Cannot cancel V2 offer',
      error: error.message,
      success: false,
    });
  }
};

export const importOfferFile = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertStagingTableIsEmpty(StagingV2);
    await assertHomeOrgExists();
    await assertNoActiveOfferFile(MetaV2);

    const offer = req.file.buffer.toString();
    const offerData = JSON.parse(offer);

    // Parse and validate offer using V2 schema
    const maker = deserializeMaker(offerData);
    const taker = deserializeTaker(offerData);

    // Import into V2 staging table
    // ... (similar to V1 but uses V2 models)

    res.json({
      message: 'V2 offer imported successfully',
      success: true,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Error importing V2 offer',
      error: error.message,
      success: false,
    });
  }
};

export const commitImportedOfferFile = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertHomeOrgExists();
    await assertWalletIsSynced();
    await assertActiveOfferFile(MetaV2);

    const activeOffer = await MetaV2.findOne({
      where: { metaKey: 'activeOfferTradeId' },
    });

    await datalayer.takeOffer(activeOffer.metaValue);

    res.json({
      message: 'V2 offer committed successfully',
      success: true,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Error committing V2 offer',
      error: error.message,
      success: false,
    });
  }
};

export const getCurrentOfferInfo = async (req, res) => {
  try {
    const activeOffer = await MetaV2.findOne({
      where: { metaKey: 'activeOfferTradeId' },
    });

    if (!activeOffer) {
      return res.json({ message: 'No active V2 offer' });
    }

    res.json({ tradeId: activeOffer.metaValue, success: true });
  } catch (error) {
    res.status(400).json({
      message: 'Error getting V2 offer info',
      error: error.message,
      success: false,
    });
  }
};
```

### Phase 12.3: Create V2 Offer Routes

Create `src/routes/v2/resources/offer-v2.js`:

```javascript
import express from 'express';
import multer from 'multer';
import { OfferV2Controller } from '../../../controllers/v2';

const OfferV2Router = express.Router();
const upload = multer();

// Generate offer (maker)
OfferV2Router.get('/', (req, res) => {
  return OfferV2Controller.generateOfferFile(req, res);
});

// Cancel active offer (maker)
OfferV2Router.delete('/', (req, res) => {
  return OfferV2Controller.cancelActiveOffer(req, res);
});

// Import offer (taker)
OfferV2Router.post('/accept/import', upload.single('file'), (req, res) => {
  return OfferV2Controller.importOfferFile(req, res);
});

// Commit offer (taker)
OfferV2Router.post('/accept/commit', (req, res) => {
  return OfferV2Controller.commitImportedOfferFile(req, res);
});

// Cancel imported offer (taker)
OfferV2Router.delete('/accept/cancel', (req, res) => {
  return OfferV2Controller.cancelImportedOfferFile(req, res);
});

// Get offer info
OfferV2Router.get('/accept', (req, res) => {
  return OfferV2Controller.getCurrentOfferInfo(req, res);
});

export { OfferV2Router };
```

Mount in `src/routes/v2/index.js`:

```javascript
import { OfferV2Router } from './resources/offer-v2.js';
V2Router.use('/offer', OfferV2Router);
```

### Phase 12.4: Key V2 Differences from V1

**What stays the same:**
- Overall offer flow (generate → import → accept/cancel)
- Atomic swap mechanism via datalayer
- Maker/taker roles

**What changes for V2:**
- Uses `v2RegistryId` instead of `registryId`
- Uses V2 models (ProjectV2, UnitV2, ValidationV2, etc.)
- Uses V2 primary key map with v2 field names
- Uses V2 staging and meta tables (StagingV2, MetaV2)
- Handles V2-specific child tables (validation, verification, methodology, etc.)

### Phase 12.5: Testing

Test scenarios for V2 offers:

1. **Generate offer** - Stage project transfer, generate offer file
2. **Cancel offer (maker)** - Generate then cancel before taker accepts
3. **Import offer** - Taker imports offer file, reviews changes
4. **Commit offer** - Taker accepts, datalayer executes swap
5. **Cancel offer (taker)** - Taker imports then cancels before committing
6. **V1/V2 isolation** - V1 offers don't affect V2 data and vice versa

## Key Implementation Notes

### Primary Key ID Generation (UUID v4, NOT Auto-Increment)

**CRITICAL: V2 uses UUIDs like V1, NOT auto-increment integers**

All primary key IDs marked as "generated" in v2-sql.dat or containing "id" in the name MUST use UUID v4.

**When IDs are generated:**

1. **API POST** - Generate UUID immediately in controller, before staging
2. **Staging Commit** - Use existing UUID from staged record
3. **Datalayer Sync** - Use UUID from remote organization's record

### Foreign Key Handling

**Application-Level Validation (No Database Constraints) - Check Main Table AND Staging**

Create new utility `src/utils/v2-data-assertions.js` with `assertRecordExistanceOrStaged()` that checks:

1. Main table for committed records
2. Staging table for uncommitted records
3. Throws error if not found in either location

**User workflow enabled:**

1. User stages methodology → Success (ID generated, in staging)
2. User stages project-methodology referencing that methodology → Success (finds ID in staging)
3. User commits staging → Both records committed to main tables

**Benefits:**

- Users can stage multiple related records in one session
- Validates that reference exists somewhere (committed or staged)
- More flexible workflow than v1
- Supports batch operations and complex data entry

### V2 Primary Key Map

**Complete mapping for all 21 V2 tables:**

```javascript
const V2_PRIMARY_KEY_MAP = {
  project: 'cadTrustProjectId',
  validation: 'cadTrustValidationId',
  verification: 'cadTrustVerificationId',
  issuance: 'cadTrustIssuanceId',
  unit: 'cadTrustUnitId',
  methodology: 'cadTrustMethodologyId',
  project_methodology: 'id',  // Composite key table uses UUID
  location: 'cadTrustLocationId',
  stakeholder: 'cadTrustStakeholderId',
  stakeholder_projects: 'cadTrustStakeholderProjectId',
  label: 'cadTrustLabelId',
  unit_label: 'id',  // Composite key table uses UUID
  co_benefit: 'cadTrustCoBenefitId',
  estimation: 'cadTrustEstimationId',
  rating: 'cadTrustRatingId',
  activity: 'cadTrustActivityId',
  aef_t1_submission: 'cadTrustAefT1SubmissionId',
  aef_t2_authorizations: 'cadTrustAefT2AuthorizationsId',
  aef_t3_actions: 'cadTrustAefT3ActionsId',
  aef_t4_holdings: 'cadTrustAefT4HoldingsId',
  aef_t5_authorized_entities: 'cadTrustAefT5AuthorizedEntitiesId',
};
```

### V2 Database Architecture

**V2 Database Structure:**
- **Separate SQLite database** - `v2.sqlite3` (completely isolated from v1)
- **Separate MySQL mirror** - `v2Mirror` configuration (if mirroring enabled)
- **V2-specific staging table** - `StagingV2` for v2 operations
- **V2-specific meta table** - `MetaV2` for v2 configuration
- **V2-specific audit table** - `AuditV2` for v2 audit trails

**V2 Datalayer Architecture:**
- **V2 Registry Stores** - Each organization has separate v2 registry store
- **V2 Governance Stores** - Governance body maintains separate v2 governance data
- **V2 Sync Service** - Dedicated sync service for v2 registry data
- **V2 Offer System** - Complete offer/transfer functionality for v2

### Testing Requirements

**Test Coverage for V2:**
- All 21 data table CRUD operations
- Staging workflow (stage → commit → retry)
- Foreign key validation (main table + staging)
- Picklist validation for all picklist fields
- Offer/transfer system end-to-end
- V1/V2 isolation verification
- Batch upload functionality
- Export functionality

**Test Files Needed:**
- `tests/v2/integration/` - 21 data table test files + system table tests
- `tests/v2/test-fixtures/` - Sample data and validation payloads
- `tests/v2/utils/` - Helper functions and cleanup utilities

## To-dos

- [ ] Create 6 system table migrations (staging, audit, organizations, meta, governance, simulator) in src/database/v2/migrations/
- [ ] Create all v2 model types and Sequelize models (27 tables total: 21 data + 6 system)
- [ ] Create validation schemas for all v2 endpoints with snake_case to camelCase mapping
- [ ] Create shared generic controller architecture for 80% code reuse
- [ ] Create V2 controller instances using generic controller factory
- [ ] Create Express routes for all v2 endpoints matching table names
- [ ] Update v2 database index to initialize models and run migrations
- [ ] Implement V2 offer/transfer system with complete workflow
- [ ] Create V2 datalayer sync service for registry data
- [ ] Update background tasks for V2 support
- [ ] Create comprehensive API documentation (cadt_rpc_api_v2.md) with examples
- [ ] Create comprehensive test suite for all V2 endpoints
- [ ] Test and validate all endpoints, staging workflow, and v1/v2 isolation
