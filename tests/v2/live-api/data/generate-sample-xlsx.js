#!/usr/bin/env node

/**
 * Generates sample XLSX files for CADT v2 import testing and as repository examples.
 *
 * Produces:
 *   - sample-projects-import.xlsx  (projects + all HasMany child sheets)
 *   - sample-units-import.xlsx     (units + unitLabels child sheet)
 *
 * All data is clearly fictional / sample data and should not be mistaken for
 * real registry entries. Picklist values use valid governance stub entries.
 *
 * Usage:
 *   node tests/v2/live-api/data/generate-sample-xlsx.js
 */

import xlsx from 'node-xlsx';
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Placeholder IDs — NEW-<digit> triggers transformMetaUid to assign real UUIDs
// at import time, so the file stays reusable across multiple imports.
// ---------------------------------------------------------------------------
const PROJECT_1 = 'NEW-1';
const PROJECT_2 = 'NEW-2';
const PROJECT_3 = 'NEW-3';

const UNIT_1 = 'NEW-1';
const UNIT_2 = 'NEW-2';
const UNIT_3 = 'NEW-3';
const UNIT_4 = 'NEW-4';

// These reference entities that must already exist in the target CADT instance.
// Live-API tests will replace them with real IDs before importing.
// For the repo example these serve as documentation of the expected format.
const PLACEHOLDER_PROGRAM_ID = '{{PROGRAM_ID}}';
const PLACEHOLDER_METHODOLOGY_ID = '{{METHODOLOGY_ID}}';
const PLACEHOLDER_STAKEHOLDER_ID = '{{STAKEHOLDER_ID}}';
const PLACEHOLDER_VALIDATION_ID = '{{VALIDATION_ID}}';
const PLACEHOLDER_ISSUANCE_ID = '{{ISSUANCE_ID}}';
const PLACEHOLDER_LABEL_ID = '{{LABEL_ID}}';

// ============================================================================
// PROJECT XLSX — main sheet + 8 child sheets
// ============================================================================

const projectsSheet = {
  name: 'projects',
  data: [
    // Header row — camelCase column names matching the Sequelize model
    [
      'projectRegistryName',
      'projectId',
      'projectCreditingProgram',
      'projectName',
      'projectLink',
      'projectDescription',
      'projectSector',
      'projectType',
      'projectSubtype',
      'projectStatus',
      'projectStatusDate',
      'projectUnitMetric',
      'cadTrustProgramId',
    ],
    // Row 1 — full project with all optional fields
    [
      'Sample Global Registry',
      'SAMPLE-PRJ-2024-001',
      'Example Crediting Program A',
      'Example Mangrove Restoration Project',
      'https://example.com/registry/projects/sample-prj-2024-001',
      'Sample large-scale mangrove restoration project for testing purposes. This fictional project demonstrates a reforestation scenario with community-based sustainable aquaculture across an example coastal region.',
      '["Afforestation and reforestation"]',
      '["Afforestation","Reforestation"]',
      'Mangrove Restoration',
      'Registered',
      '2024-03-15',
      'tCO2e',
      null,
    ],
    // Row 2 — minimal required fields, different registry
    [
      'Example Standards Body',
      'SAMPLE-PRJ-2024-002',
      null,
      'Sample Solar Cookstove Distribution',
      'https://example.com/registry/projects/sample-prj-2024-002',
      null,
      '["Energy demand"]',
      '["Solar"]',
      null,
      'Validated',
      '2024-08-01',
      'tCO2e',
      null,
    ],
    // Row 3 — multi-sector / multi-type project with program reference
    [
      'Example Forestry Registry',
      'SAMPLE-PRJ-2025-003',
      'Example Crediting Program B',
      'Example Improved Forest Management',
      'https://example.com/registry/projects/sample-prj-2025-003',
      'Sample improved forest management project for testing. This fictional project demonstrates extended rotations and selective thinning in a mixed-conifer forest scenario for CADT import/export testing.',
      '["Afforestation and reforestation","Agriculture"]',
      '["Agriculture, forestry and other land use (AFOLU)"]',
      'Improved Forest Management',
      'Listed',
      '2025-01-10',
      'tCO2e',
      PLACEHOLDER_PROGRAM_ID,
    ],
  ],
};

const locationsSheet = {
  name: 'locations',
  data: [
    [
      'locationCountry',
      'locationRegion',
      'locationGis',
      'locationMapType',
      'locationMapFileLink',
      'cadTrustProjectId',
    ],
    // Project 1 — two locations
    [
      'Viet Nam',
      'Example Delta Region',
      '{"type":"Point","coordinates":[105.7,9.8]}',
      'GeoJSON',
      'https://example.com/maps/sample-mangrove.geojson',
      PROJECT_1,
    ],
    [
      'Viet Nam',
      'Example Province',
      '{"type":"Point","coordinates":[104.98,8.98]}',
      'GeoJSON',
      null,
      PROJECT_1,
    ],
    // Project 2
    [
      'India',
      'Example State',
      'POINT(72.57 23.03)',
      'GeoJSON',
      'https://example.com/maps/sample-solar.geojson',
      PROJECT_2,
    ],
    // Project 3
    [
      'United States of America',
      'Example State',
      '{"type":"Polygon","coordinates":[[[-122.5,44.0],[-121.5,44.0],[-121.5,45.0],[-122.5,45.0],[-122.5,44.0]]]}',
      'GeoJSON',
      'https://example.com/maps/sample-forest.geojson',
      PROJECT_3,
    ],
  ],
};

const estimationsSheet = {
  name: 'estimations',
  data: [
    [
      'estimationStartDate',
      'estimationEndDate',
      'estimationUnitCount',
      'estimationReferenceNo',
      'cadTrustProjectId',
    ],
    // Project 1 — multi-year estimations
    ['2024-01-01', '2024-12-31', 45000, 'SAMPLE-EST-PRJ1-Y1', PROJECT_1],
    ['2025-01-01', '2025-12-31', 52000, 'SAMPLE-EST-PRJ1-Y2', PROJECT_1],
    ['2026-01-01', '2026-12-31', 58000.5, 'SAMPLE-EST-PRJ1-Y3', PROJECT_1],
    // Project 2
    ['2024-06-01', '2025-05-31', 12500, 'SAMPLE-EST-PRJ2-Y1', PROJECT_2],
    // Project 3
    ['2025-01-01', '2025-12-31', 95000.25, 'SAMPLE-EST-PRJ3-Y1', PROJECT_3],
  ],
};

const ratingsSheet = {
  name: 'ratings',
  data: [
    [
      'ratingType',
      'ratingName',
      'ratingValue',
      'ratingLink',
      'cadTrustProjectId',
    ],
    [
      'CDP',
      'Sample Climate Score 2024',
      'A-',
      'https://example.com/ratings/sample-prj-2024-001',
      PROJECT_1,
    ],
    [
      'CCQI',
      'Sample Quality Rating',
      '4.2',
      'https://example.com/ratings/sample-prj-2024-001-ccqi',
      PROJECT_1,
    ],
    [
      'CDP',
      'Sample Climate Score 2024',
      'B',
      null,
      PROJECT_3,
    ],
  ],
};

const coBenefitsSheet = {
  name: 'coBenefits',
  data: [
    ['coBenefitId', 'cadTrustProjectId'],
    ['SDG 13 - Climate action', PROJECT_1],
    ['SDG 14 - Life below water', PROJECT_1],
    ['SDG 15 - Life on land', PROJECT_1],
    ['SDG 1 - No poverty', PROJECT_1],
    ['SDG 7 - Affordable and clean energy', PROJECT_2],
    ['SDG 5 - Gender equality', PROJECT_2],
    ['SDG 13 - Climate action', PROJECT_3],
    ['SDG 15 - Life on land', PROJECT_3],
    ['SDG 8 - Decent work and economic growth', PROJECT_3],
  ],
};

const validationsSheet = {
  name: 'validations',
  data: [
    [
      'validationId',
      'validationType',
      'validationBody',
      'validationDate',
      'validationCreditPeriodStartDate',
      'validationCreditPeriodEndDate',
      'cadTrustProjectId',
    ],
    [
      'SAMPLE-VAL-001',
      'Validation of Project Design Document',
      'Example Validation Services A',
      '2023-11-15',
      '2024-01-01',
      '2033-12-31',
      PROJECT_1,
    ],
    [
      'SAMPLE-VAL-002',
      'Validation of Project Design Document',
      'Example Validation Services B',
      '2024-06-01',
      '2024-06-01',
      '2031-05-31',
      PROJECT_2,
    ],
    [
      'SAMPLE-VAL-003',
      'Validation of Renewal of Credit Period',
      'Example Validation Services C',
      '2024-12-01',
      '2025-01-01',
      '2034-12-31',
      PROJECT_3,
    ],
  ],
};

const verificationsSheet = {
  name: 'verifications',
  data: [
    [
      'verificationId',
      'verificationStartDate',
      'verificationEndDate',
      'verificationBody',
      'cadTrustProjectId',
      'cadTrustValidationId',
    ],
    [
      'SAMPLE-VER-001',
      '2024-01-01',
      '2024-12-31',
      'Example Validation Services A',
      PROJECT_1,
      PLACEHOLDER_VALIDATION_ID,
    ],
    [
      'SAMPLE-VER-002',
      '2024-06-01',
      '2025-05-31',
      'Example Validation Services B',
      PROJECT_2,
      null,
    ],
    [
      'SAMPLE-VER-003',
      '2025-01-01',
      '2025-12-31',
      'Example Validation Services C',
      PROJECT_3,
      null,
    ],
  ],
};

const projectMethodologiesSheet = {
  name: 'projectMethodologies',
  data: [
    [
      'cadTrustProjectId',
      'cadTrustMethodologyId',
      'projectMethodologyDate',
      'projectMethodologyDescription',
    ],
    [
      PROJECT_1,
      PLACEHOLDER_METHODOLOGY_ID,
      '2024-01-15',
      'Example methodology: Afforestation and reforestation of degraded mangrove habitats — sample description for CADT import testing.',
    ],
    [
      PROJECT_3,
      PLACEHOLDER_METHODOLOGY_ID,
      '2025-01-10',
      'Example methodology: Improved Forest Management in Temperate and Boreal Forests — sample description for CADT import testing.',
    ],
  ],
};

const stakeholderProjectsSheet = {
  name: 'stakeholderProjects',
  data: [
    ['cadTrustStakeholderId', 'cadTrustProjectId'],
    [PLACEHOLDER_STAKEHOLDER_ID, PROJECT_1],
    [PLACEHOLDER_STAKEHOLDER_ID, PROJECT_3],
  ],
};

// ============================================================================
// UNIT XLSX — main sheet + unitLabels child sheet
// ============================================================================

const unitsSheet = {
  name: 'units',
  data: [
    [
      'unitSerialId',
      'unitStartBlock',
      'unitEndBlock',
      'unitCount',
      'unitType',
      'unitVintageYear',
      'unitStatus',
      'unitStatusReason',
      'unitStatusDate',
      'unitRetirementDetail',
      'unitRetirementBeneficiary',
      'unitRetirementBeneficiaryId',
      'unitLink',
      'unitMetric',
      'unitCurrentOwner',
      'unitItmosReferenceId',
      'marketplace',
      'marketplaceLink',
      'marketplaceIdentifier',
      'cadTrustIssuanceId',
    ],
    // Unit 1 — fully populated, "Issued" status
    [
      'SAMPLE-UNIT1-BLK-1000-5000',
      '1000',
      '5000',
      4001,
      'Removal - nature',
      2024,
      'Issued',
      'Sample initial issuance from first verification period',
      '2024-06-15',
      null,
      null,
      null,
      'https://example.com/registry/units/sample-unit1-1000-5000',
      'tCO2e',
      'Example Conservation Trust',
      null,
      'Example Carbon Exchange',
      'https://example.com/exchange/units/sample-unit1-blk1',
      'SAMPLE-EXC-UNIT1-BLK1',
      PLACEHOLDER_ISSUANCE_ID,
    ],
    // Unit 2 — retired unit with beneficiary details
    [
      'SAMPLE-UNIT2-BLK-5001-7000',
      '5001',
      '7000',
      2000,
      'Removal - nature',
      2024,
      'Retired',
      'Sample voluntary retirement for corporate sustainability pledge',
      '2025-01-20',
      'Sample retirement on behalf of Example Corporation for testing. Credits permanently removed from circulation.',
      'Example Corporation',
      'SAMPLE-CORP-2024-001',
      'https://example.com/registry/units/sample-unit2-5001-7000',
      'tCO2e',
      'Example Corporation',
      null,
      null,
      null,
      null,
      PLACEHOLDER_ISSUANCE_ID,
    ],
    // Unit 3 — different type, held in buffer
    [
      'SAMPLE-UNIT3-BLK-1-2500',
      '1',
      '2500',
      2500,
      'Avoidance - technical',
      2024,
      'Buffer',
      'Sample allocation to permanence buffer pool',
      '2024-09-01',
      null,
      null,
      null,
      null,
      'tCO2e',
      'Example Buffer Account',
      null,
      null,
      null,
      null,
      PLACEHOLDER_ISSUANCE_ID,
    ],
    // Unit 4 — marketplace-listed unit with ITMOS reference
    [
      'SAMPLE-UNIT4-BLK-1-10000',
      '1',
      '10000',
      10000,
      'Removal - nature',
      2025,
      'Held',
      'Sample hold pending verification of second monitoring period',
      '2025-03-01',
      null,
      null,
      null,
      'https://example.com/registry/units/sample-unit4-1-10000',
      'tCO2e',
      'Example Forestry Management Inc',
      'SAMPLE-ITMOS-2025-001',
      'Example Marketplace',
      'https://example.com/marketplace/listings/sample-unit4-2025',
      'SAMPLE-MKT-UNIT4-001',
      PLACEHOLDER_ISSUANCE_ID,
    ],
  ],
};

const unitLabelsSheet = {
  name: 'unitLabels',
  data: [
    ['cadTrustLabelId', 'cadTrustUnitId', 'labelUnitDate', 'labelUnitDescription'],
    [
      PLACEHOLDER_LABEL_ID,
      UNIT_3,
      '2024-06-15',
      'Sample certification label — example description for unit testing',
    ],
    [
      PLACEHOLDER_LABEL_ID,
      UNIT_4,
      '2025-03-01',
      'Sample authorized credit label — example description for unit testing',
    ],
  ],
};

// ============================================================================
// Build and write XLSX files
// ============================================================================

const projectXlsx = xlsx.build([
  projectsSheet,
  locationsSheet,
  estimationsSheet,
  ratingsSheet,
  coBenefitsSheet,
  validationsSheet,
  verificationsSheet,
  projectMethodologiesSheet,
  stakeholderProjectsSheet,
]);

const unitXlsx = xlsx.build([
  unitsSheet,
  unitLabelsSheet,
]);

const projectOutPath = join(__dirname, 'sample-projects-import.xlsx');
const unitOutPath = join(__dirname, 'sample-units-import.xlsx');

writeFileSync(projectOutPath, projectXlsx);
writeFileSync(unitOutPath, unitXlsx);

console.log(`Created: ${projectOutPath}`);
console.log(`Created: ${unitOutPath}`);
