/**
 * Test data generators for V1 endpoints
 * Generates test data for projects and units with minimal, typical, and maximal variations
 */

// Counter to ensure uniqueness even when multiple records are created in the same millisecond
let uniqueCounter = 0;

/**
 * Generate a unique identifier combining timestamp with a counter and random component
 * @returns {string} - Unique identifier string
 */
export const getUniqueId = () => {
  uniqueCounter++;
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `${timestamp}-${uniqueCounter}-${random}`;
};

/**
 * Helper function to generate long strings for testing
 * @param {number} length - Desired string length
 * @returns {string}
 */
export const getLongString = (length = 1000) => {
  return 'A'.repeat(length);
};

/**
 * Helper function to generate invalid picklist values
 * @param {string} fieldName - Name of the picklist field
 * @returns {string}
 */
export const getInvalidPicklistValue = (fieldName) => {
  return `INVALID_PICKLIST_VALUE_${fieldName}_${getUniqueId()}`;
};

// ============================================================================
// PROJECT GENERATORS
// ============================================================================

/**
 * Generate typical project test data with all required fields + some optional
 * Uses TEST- prefix to identify test records for cleanup
 */
export const generateProject = (overrides = {}) => {
  const uniqueId = getUniqueId();
  return {
    projectId: `TEST-PROJ-${uniqueId}`,
    originProjectId: `ORIG-${uniqueId}`,
    registryOfOrigin: 'Verra',
    projectName: `Test Project ${uniqueId}`,
    projectLink: 'http://testurl.com',
    projectDeveloper: 'Test Developer',
    sector: 'Agriculture; forestry and fishing', // Valid picklist value
    projectType: 'Afforestation',
    coveredByNDC: 'Inside NDC',
    projectStatus: 'Registered',
    projectStatusDate: new Date().toISOString().split('T')[0],
    unitMetric: 'tCO2e',
    methodology: 'ACR - Truck Stop Electrification',
    // Optional fields
    program: 'Test Program',
    ndcInformation: 'NDC info',
    ...overrides,
  };
};

/**
 * Generate minimal project test data with only required fields
 * Uses TEST- prefix to identify test records for cleanup
 */
export const generateProjectMinimal = (overrides = {}) => {
  const uniqueId = getUniqueId();
  return {
    projectId: `TEST-MIN-PROJ-${uniqueId}`,
    originProjectId: `MIN-ORIG-${uniqueId}`,
    registryOfOrigin: 'Verra',
    projectName: `Minimal Project ${uniqueId}`,
    projectLink: 'http://testurl.com',
    projectDeveloper: 'Test Developer',
    sector: 'Agriculture; forestry and fishing', // Valid picklist value
    projectType: 'Afforestation',
    coveredByNDC: 'Inside NDC',
    projectStatus: 'Registered',
    projectStatusDate: new Date().toISOString().split('T')[0],
    unitMetric: 'tCO2e',
    methodology: 'ACR - Truck Stop Electrification',
    ...overrides,
  };
};

/**
 * Generate maximal project test data with all fields including nested child records
 */
export const generateProjectMaximal = (overrides = {}) => {
  const uniqueId = getUniqueId();
  const baseDate = new Date();
  const pastDate = new Date(baseDate.getTime() - 365 * 24 * 60 * 60 * 1000);
  const futureDate = new Date(baseDate.getTime() + 365 * 24 * 60 * 60 * 1000);

  return {
    ...generateProject(),
    program: 'Test Program',
    projectTags: 'tag1, tag2',
    ndcInformation: 'NDC info',
    validationBody: 'Test Validation Body',
    validationDate: pastDate.toISOString().split('T')[0],
    // Nested child records (V1 feature - these are separate tables in V2)
    labels: [
      {
        label: `Sample Label ${uniqueId}`,
        labelType: 'Certification',
        creditingPeriodStartDate: pastDate.toISOString().split('T')[0],
        creditingPeriodEndDate: futureDate.toISOString().split('T')[0],
        validityPeriodStartDate: pastDate.toISOString().split('T')[0],
        validityPeriodEndDate: futureDate.toISOString().split('T')[0],
        unitQuantity: 40,
        labelLink: 'http://samplelabel.net',
      },
    ],
    issuances: [
      {
        startDate: pastDate.toISOString().split('T')[0],
        endDate: pastDate.toISOString().split('T')[0],
        verificationApproach: 'Sample Approach',
        verificationReportDate: pastDate.toISOString().split('T')[0],
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
        geographicIdentifier: `Sample Identifier ${uniqueId}`,
      },
    ],
    projectRatings: [
      {
        ratingType: 'CCQI',
        ratingRangeHighest: '100',
        ratingRangeLowest: '0',
        rating: '97',
        ratingLink: 'http://testlink.com',
      },
    ],
    estimations: [
      {
        creditingPeriodStart: pastDate.toISOString().split('T')[0],
        creditingPeriodEnd: futureDate.toISOString().split('T')[0],
        unitCount: 100,
      },
    ],
    relatedProjects: [
      {
        relatedProjectId: `REL-${uniqueId}`,
        relationshipType: 'Sample',
        registry: 'Verra',
      },
    ],
    ...overrides,
  };
};

/**
 * Generate project test data with very long string values
 */
export const generateProjectLongStrings = (overrides = {}) => {
  return {
    ...generateProject(),
    projectName: getLongString(10000),
    ...overrides,
  };
};

/**
 * Generate project test data that includes forbidden fields
 */
export const generateProjectForbiddenFields = (overrides = {}) => {
  return {
    ...generateProject(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    warehouseProjectId: 'should-not-be-set',
    ...overrides,
  };
};

// ============================================================================
// UNIT GENERATORS
// ============================================================================

/**
 * Generate typical unit test data with all required fields + some optional
 * Uses TEST- prefix to identify test records for cleanup
 */
export const generateUnit = (overrides = {}) => {
  const uniqueId = getUniqueId();
  return {
    projectLocationId: `TEST-LOC-${uniqueId}`,
    unitOwner: `TEST-OWNER-${uniqueId}`,
    countryJurisdictionOfOwner: 'United States of America',
    vintageYear: 2020,
    unitType: 'Removal - technical',
    unitStatus: 'Held',
    unitBlockStart: `START-${uniqueId}`,
    unitBlockEnd: `END-${uniqueId}`,
    unitCount: 100,
    unitRegistryLink: 'http://climateWarehouse.com/myRegistry',
    correspondingAdjustmentDeclaration: 'Unknown',
    correspondingAdjustmentStatus: 'Not Started',
      // Optional fields
      inCountryJurisdictionOfOwner: 'California',
      // Note: serialNumberBlock is auto-generated from unitBlockStart and unitBlockEnd
      // serialNumberPattern is not allowed in POST requests
      ...overrides,
  };
};

/**
 * Generate minimal unit test data with only required fields
 * Uses TEST- prefix to identify test records for cleanup
 */
export const generateUnitMinimal = (overrides = {}) => {
  const uniqueId = getUniqueId();
  return {
    projectLocationId: `TEST-MIN-LOC-${uniqueId}`,
    unitOwner: `TEST-MIN-OWNER-${uniqueId}`,
    countryJurisdictionOfOwner: 'United States of America',
    vintageYear: 2020,
    unitType: 'Removal - technical',
    unitStatus: 'Held',
    unitBlockStart: `MIN-START-${uniqueId}`,
    unitBlockEnd: `MIN-END-${uniqueId}`,
    unitCount: 50,
    unitRegistryLink: 'http://climateWarehouse.com/myRegistry',
    correspondingAdjustmentDeclaration: 'Unknown',
    correspondingAdjustmentStatus: 'Not Started',
    ...overrides,
  };
};

/**
 * Generate maximal unit test data with all fields
 */
export const generateUnitMaximal = (overrides = {}) => {
  const uniqueId = getUniqueId();
  return {
    ...generateUnit(),
    inCountryJurisdictionOfOwner: 'California',
    // Note: serialNumberBlock is auto-generated, not included in POST
    marketplace: 'Test Marketplace',
    marketplaceLink: 'http://marketplace.com',
    marketplaceIdentifier: `MP-${uniqueId}`,
    unitTags: 'tag1, tag2',
    unitStatusReason: 'Test reason',
    // Nested labels (V1 feature)
    labels: [
      {
        label: `Unit Label ${uniqueId}`,
        labelType: 'Certification',
        creditingPeriodStartDate: new Date().toISOString().split('T')[0],
        creditingPeriodEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        validityPeriodStartDate: new Date().toISOString().split('T')[0],
        validityPeriodEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        unitQuantity: 40,
        labelLink: 'http://samplelabel.net',
      },
    ],
    ...overrides,
  };
};

/**
 * Generate unit test data with very long string values
 */
export const generateUnitLongStrings = (overrides = {}) => {
  return {
    ...generateUnit(),
    unitOwner: getLongString(10000),
    ...overrides,
  };
};

/**
 * Generate unit test data that includes forbidden fields
 */
export const generateUnitForbiddenFields = (overrides = {}) => {
  return {
    ...generateUnit(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    warehouseUnitId: 'should-not-be-set',
    ...overrides,
  };
};
