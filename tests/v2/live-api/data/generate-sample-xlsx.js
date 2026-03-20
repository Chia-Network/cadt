#!/usr/bin/env node

/**
 * Generates sample XLSX files for CADT v2 import testing and as repository examples.
 *
 * Produces:
 *   - sample-projects-import.xlsx  (projects + all HasMany child sheets)
 *   - sample-units-import.xlsx     (units + unitLabels child sheet)
 *
 * The data uses valid picklist values from the governance stub and realistic
 * field values so the files work for both live-API tests and as user-facing
 * examples checked into the repo.
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
const PLACEHOLDER_VERIFICATION_ID = '{{VERIFICATION_ID}}';
const PLACEHOLDER_PROJECT_METHODOLOGY_ID = '{{PROJECT_METHODOLOGY_ID}}';
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
      'VCS',
      'VCS-2024-001',
      'Verified Carbon Standard',
      'Mekong Delta Mangrove Restoration',
      'https://registry.verra.org/app/projectDetail/VCS/2024001',
      'Large-scale mangrove restoration project across 5,000 hectares in the Mekong Delta region of Vietnam, combining reforestation with community-based sustainable aquaculture. The project protects biodiversity corridors and strengthens coastal resilience against typhoons and sea-level rise.',
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
      'Gold Standard',
      'GS-10542',
      null,
      'Gujarat Solar Cookstove Distribution',
      'https://registry.goldstandard.org/projects/details/10542',
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
      'CAR',
      'CAR-2025-078',
      'Climate Action Reserve',
      'Pacific Northwest Improved Forest Management',
      'https://www.climateactionreserve.org/how/protocols/forest/2025-078',
      'Improved forest management across 12,000 acres of mixed-conifer forest in Oregon. The project transitions from conventional harvest rotations to extended rotations and selective thinning, increasing above-ground carbon stocks by 35% over the crediting period.',
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
      'Mekong Delta',
      '{"type":"Point","coordinates":[105.7,9.8]}',
      'GeoJSON',
      'https://example.com/maps/mekong-delta-mangrove.geojson',
      PROJECT_1,
    ],
    [
      'Viet Nam',
      'Ca Mau Province',
      '{"type":"Point","coordinates":[104.98,8.98]}',
      'GeoJSON',
      null,
      PROJECT_1,
    ],
    // Project 2
    [
      'India',
      'Gujarat',
      'POINT(72.57 23.03)',
      'GeoJSON',
      'https://example.com/maps/gujarat-solar.geojson',
      PROJECT_2,
    ],
    // Project 3
    [
      'United States of America',
      'Oregon',
      '{"type":"Polygon","coordinates":[[[-122.5,44.0],[-121.5,44.0],[-121.5,45.0],[-122.5,45.0],[-122.5,44.0]]]}',
      'GeoJSON',
      'https://example.com/maps/pacific-nw-forest.geojson',
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
    ['2024-01-01', '2024-12-31', 45000, 'EST-VCS-2024-001-Y1', PROJECT_1],
    ['2025-01-01', '2025-12-31', 52000, 'EST-VCS-2024-001-Y2', PROJECT_1],
    ['2026-01-01', '2026-12-31', 58000.5, 'EST-VCS-2024-001-Y3', PROJECT_1],
    // Project 2
    ['2024-06-01', '2025-05-31', 12500, 'EST-GS-10542-Y1', PROJECT_2],
    // Project 3
    ['2025-01-01', '2025-12-31', 95000.25, 'EST-CAR-2025-078-Y1', PROJECT_3],
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
      'CDP Climate Score 2024',
      'A-',
      'https://www.cdp.net/scores/2024/vcs-2024-001',
      PROJECT_1,
    ],
    [
      'CCQI',
      'CCQI Quality Rating',
      '4.2',
      'https://carboncreditquality.org/ratings/vcs-2024-001',
      PROJECT_1,
    ],
    [
      'CDP',
      'CDP Climate Score 2024',
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
      'VAL-VCS-2024-001',
      'Validation of Project Design Document',
      'SCS Global Services',
      '2023-11-15',
      '2024-01-01',
      '2033-12-31',
      PROJECT_1,
    ],
    [
      'VAL-GS-10542',
      'Validation of Project Design Document',
      'AENOR International S.A.U.',
      '2024-06-01',
      '2024-06-01',
      '2031-05-31',
      PROJECT_2,
    ],
    [
      'VAL-CAR-2025-078',
      'Validation of Renewal of Credit Period',
      'ERM Certification and Verification Services Limited',
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
      'VER-VCS-2024-001-01',
      '2024-01-01',
      '2024-12-31',
      'SCS Global Services',
      PROJECT_1,
      PLACEHOLDER_VALIDATION_ID,
    ],
    [
      'VER-GS-10542-01',
      '2024-06-01',
      '2025-05-31',
      'AENOR International S.A.U.',
      PROJECT_2,
      null,
    ],
    [
      'VER-CAR-2025-078-01',
      '2025-01-01',
      '2025-12-31',
      'ERM Certification and Verification Services Limited',
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
      'AR-ACM0003: Afforestation and reforestation of degraded mangrove habitats — applied to coastal zones with verified baseline deforestation rates.',
    ],
    [
      PROJECT_3,
      PLACEHOLDER_METHODOLOGY_ID,
      '2025-01-10',
      'VM0012: Improved Forest Management in Temperate and Boreal Forests — extended rotation and selective harvest approach.',
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
      'VCS-2024-001-BLK-1000-5000',
      '1000',
      '5000',
      4000,
      'Removal - nature',
      2024,
      'Issued',
      'Initial issuance from first verification period',
      '2024-06-15',
      null,
      null,
      null,
      'https://registry.verra.org/app/units/VCS/2024001/1000-5000',
      'tCO2e',
      'Mekong Delta Conservation Trust',
      null,
      'Climate Impact Exchange',
      'https://climateimpact.exchange/units/vcs-2024-001-1',
      'CIX-VCS-2024-001-BLK1',
      PLACEHOLDER_ISSUANCE_ID,
    ],
    // Unit 2 — retired unit with beneficiary details
    [
      'VCS-2024-001-BLK-5001-7000',
      '5001',
      '7000',
      2000,
      'Removal - nature',
      2024,
      'Retired',
      'Voluntary retirement for corporate carbon neutrality pledge',
      '2025-01-20',
      'Retired on behalf of Acme Corp 2024 sustainability commitment. Credits permanently removed from circulation.',
      'Acme Corporation',
      'ACME-2024-CN-001',
      'https://registry.verra.org/app/units/VCS/2024001/5001-7000',
      'tCO2e',
      'Acme Corporation',
      null,
      null,
      null,
      null,
      PLACEHOLDER_ISSUANCE_ID,
    ],
    // Unit 3 — different type, held in buffer
    [
      'GS-10542-BLK-1-2500',
      '1',
      '2500',
      2500,
      'Avoidance - technical',
      2024,
      'Buffer',
      'Allocated to permanence buffer pool per Gold Standard requirements',
      '2024-09-01',
      null,
      null,
      null,
      null,
      'tCO2e',
      'Gold Standard Foundation Buffer Account',
      null,
      null,
      null,
      null,
      PLACEHOLDER_ISSUANCE_ID,
    ],
    // Unit 4 — marketplace-listed unit with ITMOS reference
    [
      'CAR-2025-078-BLK-1-10000',
      '1',
      '10000',
      10000,
      'Removal - nature',
      2025,
      'Held',
      'Held pending verification of second monitoring period',
      '2025-03-01',
      null,
      null,
      null,
      'https://www.climateactionreserve.org/units/2025-078/1-10000',
      'tCO2e',
      'Pacific Northwest Forest Holdings LLC',
      'ITMOS-US-2025-078-001',
      'Xpansiv CBL',
      'https://xpansiv.com/cbl/listings/car-2025-078',
      'CBL-CAR-2025-078-001',
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
      UNIT_1,
      '2024-06-15',
      'Gold Standard Certified — meets all GS4GG requirements for community benefit and environmental integrity',
    ],
    [
      PLACEHOLDER_LABEL_ID,
      UNIT_4,
      '2025-03-01',
      'Article 6.4 authorized credit — eligible for corresponding adjustment under Paris Agreement framework',
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
