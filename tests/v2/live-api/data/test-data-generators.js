import { v4 as uuidv4 } from 'uuid';

// Counter to ensure uniqueness even when multiple records are created in the same millisecond
let uniqueCounter = 0;

/**
 * Generate a unique identifier combining timestamp with a counter and random component
 * This ensures uniqueness even when multiple records are created in rapid succession
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
  // Return a value that definitely won't be in any picklist
  return `INVALID_PICKLIST_VALUE_${fieldName}_${getUniqueId()}`;
};

/**
 * Helper function to generate non-existent UUIDs for foreign key error testing
 * @returns {string}
 */
export const getNonExistentId = () => {
  return uuidv4();
};

/**
 * Generate standard methodology test data with all fields populated
 */
export const generateMethodology = () => {
  return {
    methodologyCode: `TEST-METHOD-${getUniqueId()}`,
    methodologyName: 'Test Methodology Standard',
    methodologyVersion: '1.0',
    methodologyDate: '2024-01-15',
    methodologyLink: 'https://example.com/methodology/test',
    methodologyType: 'Avoidance - nature',
  };
};

/**
 * Generate minimal methodology test data with only required fields
 */
export const generateMethodologyMinimal = () => {
  return {
    methodologyCode: `MIN-METHOD-${getUniqueId()}`,
    methodologyName: 'Minimal Methodology',
  };
};

/**
 * Generate maximal methodology test data with all fields including optional ones
 */
export const generateMethodologyMaximal = () => {
  return {
    methodologyCode: `MAX-METHOD-${getUniqueId()}`,
    methodologyName: 'Maximal Methodology with All Fields',
    methodologyVersion: '2.5.3-beta',
    methodologyDate: '2024-12-31',
    methodologyLink: 'https://example.com/methodology/maximal?param=value&other=test',
    methodologyType: 'Removal - technical',
  };
};

/**
 * Generate methodology test data with very long string values (1000+ characters)
 */
export const generateMethodologyLongStrings = () => {
  return {
    methodologyCode: getLongString(500), // Long code
    methodologyName: getLongString(1000), // Long name
    methodologyVersion: getLongString(200), // Long version
    methodologyDate: '2024-01-15',
    methodologyLink: `https://example.com/methodology/${getLongString(500)}`, // Very long URL
    methodologyType: 'Reduction - nature',
  };
};

/**
 * Generate methodology test data with invalid picklist values
 */
export const generateMethodologyInvalidPicklist = () => {
  return {
    methodologyCode: `INVALID-PICKLIST-${getUniqueId()}`,
    methodologyName: 'Invalid Picklist Methodology',
    methodologyType: getInvalidPicklistValue('methodologyType'), // Invalid picklist value
  };
};

/**
 * Generate methodology test data with non-existent foreign key IDs
 * Note: Methodology doesn't have foreign keys, but this is a template for other resources
 */
export const generateMethodologyInvalidForeignKey = () => {
  // Methodology doesn't have foreign keys, so this returns standard data
  // This is here for consistency with other resource generators
  return generateMethodology();
};

/**
 * Generate methodology test data that includes forbidden fields
 */
export const generateMethodologyForbiddenFields = () => {
  return {
    methodologyCode: `FORBIDDEN-${getUniqueId()}`,
    methodologyName: 'Forbidden Fields Methodology',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    cadTrustMethodologyId: uuidv4(), // Forbidden ID field
  };
};

// ============================================================================
// PROGRAM GENERATORS
// ============================================================================

export const generateProgram = (cadTrustProgramId = null) => {
  const uniqueId = getUniqueId();
  const data = {
    programName: `Test Program ${uniqueId}`,
    programRegistry: 'VCS',
    programRegistryActivityId: `ACT-${uniqueId}`,
    programRegistryProgramId: `PROG-${uniqueId}`,
    programDescription: 'Test program description',
  };
  if (cadTrustProgramId) data.cadTrustProgramId = cadTrustProgramId;
  return data;
};

export const generateProgramMinimal = () => {
  const uniqueId = getUniqueId();
  return {
    programName: `Min Program ${uniqueId}`,
    programRegistry: 'CAR',
    programRegistryActivityId: `MIN-ACT-${uniqueId}`,
  };
};

export const generateProgramMaximal = () => {
  const uniqueId = getUniqueId();
  return {
    programName: `Max Program ${uniqueId}`,
    programRegistry: 'Gold Standard',
    programRegistryActivityId: `MAX-ACT-${uniqueId}`,
    programRegistryProgramId: `MAX-PROG-${uniqueId}`,
    programDescription: getLongString(500),
  };
};

export const generateProgramLongStrings = () => ({
  programName: getLongString(500),
  programRegistry: 'VCS',
  programRegistryActivityId: getLongString(200),
  programRegistryProgramId: getLongString(200),
  programDescription: getLongString(2000),
});

export const generateProgramForbiddenFields = () => {
  const uniqueId = getUniqueId();
  return {
    programName: `FORBIDDEN-${uniqueId}`,
    programRegistry: 'VCS',
    programRegistryActivityId: `ACT-${uniqueId}`,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    cadTrustProgramId: uuidv4(),
  };
};

// ============================================================================
// LOCATION GENERATORS
// ============================================================================

export const generateLocation = (cadTrustProjectId) => ({
  locationCountry: 'United States of America',
  locationRegion: 'California',
  locationGis: 'POINT(-122.4194 37.7749)',
  locationMapType: 'GeoJSON',
  locationMapFileLink: 'https://example.com/map/location',
  cadTrustProjectId,
});

export const generateLocationMinimal = (cadTrustProjectId) => ({
  cadTrustProjectId,
});

export const generateLocationMaximal = (cadTrustProjectId) => ({
  locationCountry: 'Canada',
  locationRegion: getLongString(255),
  locationGis: getLongString(10000),
  locationMapType: 'GeoJSON',
  locationMapFileLink: `https://example.com/map/${getLongString(400)}`,
  cadTrustProjectId,
});

export const generateLocationLongStrings = (cadTrustProjectId) => ({
  locationCountry: 'United States of America',
  locationRegion: getLongString(300), // Exceeds max of 255
  locationGis: getLongString(15000), // Exceeds max of 10000
  locationMapType: 'GeoJSON',
  locationMapFileLink: `https://example.com/${getLongString(600)}`, // Exceeds max of 500
  cadTrustProjectId,
});

export const generateLocationInvalidForeignKey = () => ({
  locationCountry: 'United States of America',
  cadTrustProjectId: getNonExistentId(),
});

export const generateLocationForbiddenFields = (cadTrustProjectId) => ({
  locationCountry: 'United States of America',
  cadTrustProjectId,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  cadTrustLocationId: uuidv4(),
});

// ============================================================================
// PROJECT GENERATORS
// ============================================================================

export const generateProject = (cadTrustProgramId = null) => {
  const uniqueId = getUniqueId();
  const data = {
    projectRegistryName: 'VCS',
    projectId: `TEST-PROJ-${uniqueId}`,
    projectName: `Test Project ${uniqueId}`,
    projectLink: 'https://example.com/project',
    projectDescription: 'Test project description',
    projectSector: ['Energy demand'],
    projectType: ['Solar'],
    projectSubtype: 'Solar',
    projectStatus: ['Registered'],
    projectStatusDate: '2024-01-15',
    projectUnitMetric: 'tCO2e',
  };
  if (cadTrustProgramId) data.cadTrustProgramId = cadTrustProgramId;
  return data;
};

export const generateProjectMinimal = () => {
  const uniqueId = getUniqueId();
  return {
    projectRegistryName: 'CAR',
    projectId: `TEST-MIN-PROJ-${uniqueId}`,
    projectName: `Min Project ${uniqueId}`,
  };
};

export const generateProjectMaximal = (cadTrustProgramId = null) => {
  const uniqueId = getUniqueId();
  const data = {
    projectRegistryName: 'Gold Standard',
    projectId: `TEST-MAX-PROJ-${uniqueId}`,
    projectCreditingProgram: 'Test Crediting Program',
    projectName: `Max Project ${uniqueId}`,
    projectLink: `https://example.com/project/${getLongString(200)}`,
    projectDescription: getLongString(1000),
    projectSector: ['Afforestation and reforestation'],
    projectType: ['Afforestation', 'Reforestation'],
    projectSubtype: 'Native Species',
    projectStatus: ['Validated'],
    projectStatusDate: '2024-12-31',
    projectUnitMetric: 'tCO2e',
  };
  if (cadTrustProgramId) data.cadTrustProgramId = cadTrustProgramId;
  return data;
};

export const generateProjectLongStrings = () => ({
  projectRegistryName: getLongString(300), // Exceeds max of 255
  projectId: getLongString(300), // Exceeds max of 255
  projectName: getLongString(600), // Exceeds max of 500
  projectLink: `https://example.com/${getLongString(600)}`, // Exceeds max of 500
  projectDescription: getLongString(3000), // Exceeds max of 2000
});

export const generateProjectInvalidForeignKey = () => ({
  projectRegistryName: 'VCS',
  projectId: `TEST-PROJ-${getUniqueId()}`,
  projectName: 'Invalid FK Project',
  cadTrustProgramId: getNonExistentId(),
});

export const generateProjectForbiddenFields = () => ({
  projectRegistryName: 'VCS',
  projectId: `FORBIDDEN-${getUniqueId()}`,
  projectName: 'Forbidden Fields Project',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  cadTrustProjectId: uuidv4(),
});

// ============================================================================
// ESTIMATION GENERATORS
// ============================================================================

export const generateEstimation = (cadTrustProjectId) => ({
  estimationStartDate: '2024-01-01',
  estimationEndDate: '2024-12-31',
  estimationUnitCount: 1000.5,
  estimationReferenceNo: `EST-REF-${getUniqueId()}`,
  cadTrustProjectId,
});

export const generateEstimationMinimal = (cadTrustProjectId) => ({
  estimationStartDate: '2024-01-01',
  estimationEndDate: '2024-12-31',
  cadTrustProjectId,
});

export const generateEstimationMaximal = (cadTrustProjectId) => ({
  estimationStartDate: '2024-01-01',
  estimationEndDate: '2024-12-31',
  estimationUnitCount: 999999.123456,
  estimationReferenceNo: getLongString(255),
  cadTrustProjectId,
});

export const generateEstimationLongStrings = (cadTrustProjectId) => ({
  estimationStartDate: '2024-01-01',
  estimationEndDate: '2024-12-31',
  estimationReferenceNo: getLongString(300), // Exceeds max of 255
  cadTrustProjectId,
});

export const generateEstimationInvalidForeignKey = () => ({
  estimationStartDate: '2024-01-01',
  estimationEndDate: '2024-12-31',
  cadTrustProjectId: getNonExistentId(),
});

export const generateEstimationInvalidDateRange = (cadTrustProjectId) => ({
  estimationStartDate: '2024-12-31',
  estimationEndDate: '2024-01-01', // End before start
  cadTrustProjectId,
});

export const generateEstimationForbiddenFields = (cadTrustProjectId) => ({
  estimationStartDate: '2024-01-01',
  estimationEndDate: '2024-12-31',
  cadTrustProjectId,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  cadTrustEstimationId: uuidv4(),
});

// ============================================================================
// RATING GENERATORS
// ============================================================================

export const generateRating = (cadTrustProjectId) => ({
  ratingType: 'CDP',
  ratingName: `Test Rating ${getUniqueId()}`,
  ratingValue: 'A',
  ratingLink: 'https://example.com/rating',
  cadTrustProjectId,
});

export const generateRatingMinimal = (cadTrustProjectId) => ({
  ratingName: `Min Rating ${getUniqueId()}`,
  ratingValue: 'B',
  cadTrustProjectId,
});

export const generateRatingMaximal = (cadTrustProjectId) => ({
  ratingType: 'CCQI',
  ratingName: `Max Rating ${getUniqueId()}`,
  ratingValue: getLongString(255),
  ratingLink: `https://example.com/rating/${getLongString(200)}`,
  cadTrustProjectId,
});

export const generateRatingLongStrings = (cadTrustProjectId) => ({
  ratingName: getLongString(300), // Exceeds max of 255
  ratingValue: getLongString(300), // Exceeds max of 255
  ratingLink: `https://example.com/${getLongString(600)}`, // Exceeds max of 500
  cadTrustProjectId,
});

export const generateRatingInvalidPicklist = (cadTrustProjectId) => ({
  ratingType: getInvalidPicklistValue('ratingType'),
  ratingName: 'Invalid Rating',
  ratingValue: 'A',
  cadTrustProjectId,
});

export const generateRatingInvalidForeignKey = () => ({
  ratingName: 'Invalid FK Rating',
  ratingValue: 'A',
  cadTrustProjectId: getNonExistentId(),
});

export const generateRatingForbiddenFields = (cadTrustProjectId) => ({
  ratingName: 'Forbidden Rating',
  ratingValue: 'A',
  cadTrustProjectId,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  cadTrustRatingId: uuidv4(),
});

// ============================================================================
// CO-BENEFIT GENERATORS
// ============================================================================

export const generateCoBenefit = (cadTrustProjectId) => ({
  coBenefitId: 'SDG 13 - Climate action',
  cadTrustProjectId,
});

export const generateCoBenefitMinimal = (cadTrustProjectId) => ({
  coBenefitId: 'SDG 1 - No poverty',
  cadTrustProjectId,
});

export const generateCoBenefitMaximal = (cadTrustProjectId) => ({
  coBenefitId: 'SDG 17 - Partnerships for the goals',
  cadTrustProjectId,
});

export const generateCoBenefitInvalidPicklist = (cadTrustProjectId) => ({
  coBenefitId: getInvalidPicklistValue('coBenefitId'),
  cadTrustProjectId,
});

export const generateCoBenefitInvalidForeignKey = () => ({
  coBenefitId: 'SDG 13 - Climate action',
  cadTrustProjectId: getNonExistentId(),
});

export const generateCoBenefitForbiddenFields = (cadTrustProjectId) => ({
  coBenefitId: 'SDG 13 - Climate action',
  cadTrustProjectId,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  cadTrustCoBenefitId: uuidv4(),
});

// ============================================================================
// STAKEHOLDER GENERATORS
// ============================================================================

export const generateStakeholder = () => ({
  stakeholderName: `Test Stakeholder ${getUniqueId()}`,
  stakeholderType: 'Owner',
  stakeholderLink: 'https://example.com/stakeholder',
});

export const generateStakeholderMinimal = () => ({
  stakeholderName: `Min Stakeholder ${getUniqueId()}`,
});

export const generateStakeholderMaximal = () => ({
  stakeholderName: `Max Stakeholder ${getUniqueId()}`,
  stakeholderType: 'Consultant',
  stakeholderLink: `https://example.com/stakeholder/${getLongString(200)}`,
});

export const generateStakeholderLongStrings = () => ({
  stakeholderName: getLongString(500), // Exceeds max of 255
  stakeholderLink: `https://example.com/${getLongString(600)}`, // Exceeds max of 500
});

export const generateStakeholderInvalidPicklist = () => ({
  stakeholderName: 'Invalid Stakeholder',
  stakeholderType: getInvalidPicklistValue('stakeholderType'),
});

export const generateStakeholderForbiddenFields = () => ({
  stakeholderName: 'Forbidden Stakeholder',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  cadTrustStakeholderId: uuidv4(),
});

// ============================================================================
// LABEL GENERATORS
// ============================================================================

export const generateLabel = () => ({
  labelName: `Test Label ${getUniqueId()}`,
  labelType: 'Certification',
  labelLink: 'https://example.com/label',
  labelDate: '2024-01-15',
});

export const generateLabelMinimal = () => ({
  labelName: `Min Label ${getUniqueId()}`,
});

export const generateLabelMaximal = () => ({
  labelName: `Max Label ${getUniqueId()}`,
  labelType: 'Article 6 - Authorisation',
  labelLink: `https://example.com/label/${getLongString(200)}`,
  labelDate: '2024-12-31',
});

export const generateLabelLongStrings = () => ({
  labelName: getLongString(500), // Exceeds max of 255
  labelLink: `https://example.com/${getLongString(600)}`, // Exceeds max of 500
});

export const generateLabelInvalidPicklist = () => ({
  labelName: 'Invalid Label',
  labelType: getInvalidPicklistValue('labelType'),
});

export const generateLabelForbiddenFields = () => ({
  labelName: 'Forbidden Label',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  cadTrustLabelId: uuidv4(),
});

// ============================================================================
// PROJECT-METHODOLOGY GENERATORS
// ============================================================================

export const generateProjectMethodology = (cadTrustProjectId, cadTrustMethodologyId) => ({
  cadTrustProjectId,
  cadTrustMethodologyId,
  projectMethodologyDate: '2024-01-15',
  projectMethodologyDescription: 'Test project methodology description',
});

export const generateProjectMethodologyMinimal = (cadTrustProjectId, cadTrustMethodologyId) => ({
  cadTrustProjectId,
  cadTrustMethodologyId,
});

export const generateProjectMethodologyMaximal = (cadTrustProjectId, cadTrustMethodologyId) => ({
  cadTrustProjectId,
  cadTrustMethodologyId,
  projectMethodologyDate: '2024-12-31',
  projectMethodologyDescription: getLongString(10000),
});

export const generateProjectMethodologyInvalidForeignKey = () => ({
  cadTrustProjectId: getNonExistentId(),
  cadTrustMethodologyId: getNonExistentId(),
});

export const generateProjectMethodologyForbiddenFields = (cadTrustProjectId, cadTrustMethodologyId) => ({
  cadTrustProjectId,
  cadTrustMethodologyId,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
});

// ============================================================================
// STAKEHOLDER-PROJECTS GENERATORS
// ============================================================================

export const generateStakeholderProjects = (cadTrustStakeholderId, cadTrustProjectId) => ({
  cadTrustStakeholderId,
  cadTrustProjectId,
});

// Minimal: same as typical (only required fields)
export const generateStakeholderProjectsMinimal = (cadTrustStakeholderId, cadTrustProjectId) => ({
  cadTrustStakeholderId,
  cadTrustProjectId,
});

// Maximal: same as typical (only required fields)
export const generateStakeholderProjectsMaximal = (cadTrustStakeholderId, cadTrustProjectId) => ({
  cadTrustStakeholderId,
  cadTrustProjectId,
});

export const generateStakeholderProjectsInvalidForeignKey = () => ({
  cadTrustStakeholderId: getNonExistentId(),
  cadTrustProjectId: getNonExistentId(),
});

export const generateStakeholderProjectsForbiddenFields = (cadTrustStakeholderId, cadTrustProjectId) => ({
  cadTrustStakeholderId,
  cadTrustProjectId,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  cadTrustStakeholderProjectId: uuidv4(),
});

// ============================================================================
// UNIT-LABEL GENERATORS
// ============================================================================

export const generateUnitLabel = (cadTrustLabelId, cadTrustUnitId) => ({
  cadTrustLabelId,
  cadTrustUnitId,
  labelUnitDate: '2024-01-15',
  labelUnitDescription: 'Test unit label description',
});

export const generateUnitLabelMinimal = (cadTrustLabelId, cadTrustUnitId) => ({
  cadTrustLabelId,
  cadTrustUnitId,
});

export const generateUnitLabelMaximal = (cadTrustLabelId, cadTrustUnitId) => ({
  cadTrustLabelId,
  cadTrustUnitId,
  labelUnitDate: '2024-12-31',
  labelUnitDescription: getLongString(2000),
});

export const generateUnitLabelInvalidForeignKey = () => ({
  cadTrustLabelId: getNonExistentId(),
  cadTrustUnitId: getNonExistentId(),
});

export const generateUnitLabelForbiddenFields = (cadTrustLabelId, cadTrustUnitId) => ({
  cadTrustLabelId,
  cadTrustUnitId,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
});

// ============================================================================
// ISSUANCE GENERATORS
// ============================================================================

export const generateIssuance = (cadTrustVerificationId, cadTrustProjectMethodologyId, cadTrustLocationId = null) => {
  const data = {
    issuanceId: `ISS-${getUniqueId()}`,
    issuanceDate: '2024-01-15',
    cadTrustVerificationId,
    cadTrustProjectMethodologyId,
  };
  if (cadTrustLocationId) data.cadTrustLocationId = cadTrustLocationId;
  return data;
};

export const generateIssuanceMinimal = (cadTrustVerificationId, cadTrustProjectMethodologyId) => ({
  issuanceId: `MIN-ISS-${getUniqueId()}`,
  cadTrustVerificationId,
  cadTrustProjectMethodologyId,
});

export const generateIssuanceMaximal = (cadTrustVerificationId, cadTrustProjectMethodologyId, cadTrustLocationId) => ({
  issuanceId: `MAX-ISS-${getUniqueId()}`,
  issuanceDate: '2024-12-31',
  cadTrustVerificationId,
  cadTrustProjectMethodologyId,
  cadTrustLocationId,
});

export const generateIssuanceInvalidForeignKey = () => ({
  issuanceId: 'INVALID-ISS',
  cadTrustVerificationId: getNonExistentId(),
  cadTrustProjectMethodologyId: getNonExistentId(),
});

export const generateIssuanceForbiddenFields = (cadTrustVerificationId, cadTrustProjectMethodologyId) => ({
  issuanceId: 'FORBIDDEN-ISS',
  cadTrustVerificationId,
  cadTrustProjectMethodologyId,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  cadTrustIssuanceId: uuidv4(),
});

// ============================================================================
// VERIFICATION GENERATORS
// ============================================================================

export const generateVerification = (cadTrustProjectId, cadTrustValidationId = null) => {
  const data = {
    verificationId: `VER-${getUniqueId()}`,
    verificationStartDate: '2024-01-01',
    verificationEndDate: '2024-12-31',
    verificationBody: 'AENOR International S.A.U.',
    cadTrustProjectId,
  };
  if (cadTrustValidationId) data.cadTrustValidationId = cadTrustValidationId;
  return data;
};

export const generateVerificationMinimal = (cadTrustProjectId) => ({
  verificationId: `MIN-VER-${getUniqueId()}`,
  cadTrustProjectId,
});

export const generateVerificationMaximal = (cadTrustProjectId, cadTrustValidationId) => ({
  verificationId: `MAX-VER-${getUniqueId()}`,
  verificationStartDate: '2024-01-01',
  verificationEndDate: '2024-12-31',
  verificationBody: 'SCS Global Services',
  cadTrustProjectId,
  cadTrustValidationId,
});

export const generateVerificationInvalidForeignKey = () => ({
  verificationId: 'INVALID-VER',
  cadTrustProjectId: getNonExistentId(),
});

export const generateVerificationForbiddenFields = (cadTrustProjectId) => ({
  verificationId: 'FORBIDDEN-VER',
  cadTrustProjectId,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  cadTrustVerificationId: uuidv4(),
});

// ============================================================================
// VALIDATION GENERATORS
// ============================================================================

export const generateValidation = (cadTrustProjectId) => ({
  validationId: `VAL-${getUniqueId()}`,
  validationType: 'Validation of Project Design Document',
  validationBody: 'SCS Global Services',
  validationDate: '2024-01-15',
  validationCreditPeriodStartDate: '2024-01-01',
  validationCreditPeriodEndDate: '2024-12-31',
  cadTrustProjectId,
});

export const generateValidationMinimal = (cadTrustProjectId) => ({
  validationId: `MIN-VAL-${getUniqueId()}`,
  cadTrustProjectId,
});

export const generateValidationMaximal = (cadTrustProjectId) => ({
  validationId: `MAX-VAL-${getUniqueId()}`,
  validationType: 'Validation of Renewal of Credit Period',
  validationBody: 'AENOR International S.A.U.',
  validationDate: '2024-12-31',
  validationCreditPeriodStartDate: '2024-01-01',
  validationCreditPeriodEndDate: '2024-12-31',
  cadTrustProjectId,
});

export const generateValidationInvalidForeignKey = () => ({
  validationId: 'INVALID-VAL',
  cadTrustProjectId: getNonExistentId(),
});

export const generateValidationForbiddenFields = (cadTrustProjectId) => ({
  validationId: 'FORBIDDEN-VAL',
  cadTrustProjectId,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  cadTrustValidationId: uuidv4(),
});

// ============================================================================
// UNIT GENERATORS (Complex - depends on Issuance)
// ============================================================================

export const generateUnit = (cadTrustIssuanceId) => ({
  unitSerialId: `TEST-UNIT-${getUniqueId()}`,
  unitStartBlock: '1000',
  unitEndBlock: '2000',
  unitCount: 1000,
  unitType: 'Removal - technical',
  unitVintageYear: 2024,
  unitStatus: 'Issued',
  unitStatusReason: 'Test reason',
  unitStatusDate: '2024-01-15',
  unitRetirementDetail: 'Test retirement',
  unitRetirementBeneficiary: 'Test beneficiary',
  unitRetirementBeneficiaryId: 'BEN-123',
  unitLink: 'https://example.com/unit',
  unitMetric: 'tCO2e',
  unitCurrentOwner: `TEST-OWNER-${getUniqueId()}`,
  unitItmosReferenceId: 'ITMOS-123',
  marketplace: 'Test Marketplace',
  marketplaceLink: 'https://example.com/marketplace',
  marketplaceIdentifier: 'MP-123',
  cadTrustIssuanceId,
});

export const generateUnitMinimal = (cadTrustIssuanceId) => ({
  unitSerialId: `TEST-MIN-UNIT-${getUniqueId()}`,
  unitStartBlock: '1000',
  unitEndBlock: '2000',
  unitVintageYear: 2024,
  cadTrustIssuanceId,
});

export const generateUnitMaximal = (cadTrustIssuanceId) => ({
  unitSerialId: `TEST-MAX-UNIT-${getUniqueId()}`,
  unitStartBlock: '1000',
  unitEndBlock: '2000',
  unitCount: 999999.99,
  unitType: 'Avoidance - technical',
  unitVintageYear: 2024,
  unitStatus: 'Retired',
  unitStatusReason: getLongString(500),
  unitStatusDate: '2024-12-31',
  unitRetirementDetail: getLongString(500),
  unitRetirementBeneficiary: getLongString(255),
  unitRetirementBeneficiaryId: getLongString(255),
  unitLink: `https://example.com/unit/${getLongString(200)}`,
  unitMetric: 'tCO2e',
  unitCurrentOwner: getLongString(255),
  unitItmosReferenceId: getLongString(255),
  marketplace: 'Test Marketplace',
  marketplaceLink: `https://example.com/marketplace/${getLongString(200)}`,
  marketplaceIdentifier: getLongString(255),
  cadTrustIssuanceId,
});

export const generateUnitInvalidForeignKey = () => ({
  unitSerialId: 'INVALID-UNIT',
  unitStartBlock: '1000',
  unitEndBlock: '2000',
  unitVintageYear: 2024,
  cadTrustIssuanceId: getNonExistentId(),
});

export const generateUnitForbiddenFields = (cadTrustIssuanceId) => ({
  unitSerialId: 'FORBIDDEN-UNIT',
  unitStartBlock: '1000',
  unitEndBlock: '2000',
  unitVintageYear: 2024,
  cadTrustIssuanceId,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  cadTrustUnitId: uuidv4(),
});

// ============================================================================
// LARGE DATASET GENERATOR
// ============================================================================

/**
 * Generate large dataset of any resource type
 * @param {string} resourceType - Resource type (e.g., 'methodology', 'program', etc.)
 * @param {number} count - Number of records to generate
 * @param {string} variant - Variant to use: 'standard', 'minimal', 'maximal', 'longStrings'
 * @param {Object} context - Context object with IDs needed for resources with foreign keys
 * @returns {Array}
 */
export const generateLargeDataset = (resourceType, count, variant = 'standard', context = {}) => {
  const generators = {
    methodology: {
      standard: generateMethodology,
      minimal: generateMethodologyMinimal,
      maximal: generateMethodologyMaximal,
      longStrings: generateMethodologyLongStrings,
    },
    program: {
      standard: generateProgram,
      minimal: generateProgramMinimal,
      maximal: generateProgramMaximal,
      longStrings: generateProgramLongStrings,
    },
    location: {
      standard: () => generateLocation(context.cadTrustProjectId),
      minimal: () => generateLocationMinimal(context.cadTrustProjectId),
      maximal: () => generateLocationMaximal(context.cadTrustProjectId),
      longStrings: () => generateLocationLongStrings(context.cadTrustProjectId),
    },
    project: {
      standard: () => generateProject(context.cadTrustProgramId),
      minimal: generateProjectMinimal,
      maximal: () => generateProjectMaximal(context.cadTrustProgramId),
      longStrings: generateProjectLongStrings,
    },
    estimation: {
      standard: () => generateEstimation(context.cadTrustProjectId),
      minimal: () => generateEstimationMinimal(context.cadTrustProjectId),
      maximal: () => generateEstimationMaximal(context.cadTrustProjectId),
      longStrings: () => generateEstimationLongStrings(context.cadTrustProjectId),
    },
    rating: {
      standard: () => generateRating(context.cadTrustProjectId),
      minimal: () => generateRatingMinimal(context.cadTrustProjectId),
      maximal: () => generateRatingMaximal(context.cadTrustProjectId),
      longStrings: () => generateRatingLongStrings(context.cadTrustProjectId),
    },
    coBenefit: {
      standard: () => generateCoBenefit(context.cadTrustProjectId),
      minimal: () => generateCoBenefitMinimal(context.cadTrustProjectId),
      maximal: () => generateCoBenefitMaximal(context.cadTrustProjectId),
    },
    stakeholder: {
      standard: generateStakeholder,
      minimal: generateStakeholderMinimal,
      maximal: generateStakeholderMaximal,
      longStrings: generateStakeholderLongStrings,
    },
    label: {
      standard: generateLabel,
      minimal: generateLabelMinimal,
      maximal: generateLabelMaximal,
      longStrings: generateLabelLongStrings,
    },
    // Add more as needed...
  };

  const generator = generators[resourceType]?.[variant] || generators[resourceType]?.standard;

  if (!generator) {
    throw new Error(`No generator found for resource type: ${resourceType} with variant: ${variant}`);
  }

  const dataset = [];
  for (let i = 0; i < count; i++) {
    const data = generator();
    // Make unique fields unique by appending index
    if (data.methodologyCode) data.methodologyCode = `${data.methodologyCode}-${i}`;
    if (data.programName) data.programName = `${data.programName}-${i}`;
    if (data.projectId) data.projectId = `${data.projectId}-${i}`;
    if (data.stakeholderName) data.stakeholderName = `${data.stakeholderName}-${i}`;
    if (data.labelName) data.labelName = `${data.labelName}-${i}`;
    if (data.issuanceId) data.issuanceId = `${data.issuanceId}-${i}`;
    if (data.verificationId) data.verificationId = `${data.verificationId}-${i}`;
    if (data.validationId) data.validationId = `${data.validationId}-${i}`;
    if (data.unitSerialId) data.unitSerialId = `${data.unitSerialId}-${i}`;
    dataset.push(data);
  }

  return dataset;
};

// ============================================================================
// AEF T1 SUBMISSION GENERATORS
// ============================================================================

export const generateAefT1Submission = () => ({
  aefT1SubmissionParty: `Test Party ${getUniqueId()}`,
  aefT1SubmissionVersion: '1.0',
  aefT1SubmissionReportYear: 2022,
  aefT1SubmissionSubmissionDate: '2022-01-15',
  aefT1SubmissionReviewStatus: 'Under Review',
  aefT1SubmissionResultCheck: 'Passed',
  aefT1SubmissionNdcFirstYear: 2020,
  aefT1SubmissionNdcLastYear: 2030,
  aefT1SubmissionReferenceReviewReport: 'https://example.com/review-report',
});

export const generateAefT1SubmissionMinimal = () => ({
  aefT1SubmissionParty: `Min Party ${getUniqueId()}`,
  aefT1SubmissionVersion: '1.0',
  aefT1SubmissionReportYear: 2022,
  aefT1SubmissionSubmissionDate: '2022-01-15',
});

export const generateAefT1SubmissionMaximal = () => ({
  aefT1SubmissionParty: getLongString(255),
  aefT1SubmissionVersion: getLongString(255),
  aefT1SubmissionReportYear: 2099,
  aefT1SubmissionSubmissionDate: '2099-12-31',
  aefT1SubmissionReviewStatus: getLongString(255),
  aefT1SubmissionResultCheck: getLongString(255),
  aefT1SubmissionNdcFirstYear: 2099,
  aefT1SubmissionNdcLastYear: 2099,
  aefT1SubmissionReferenceReviewReport: `https://example.com/${getLongString(400)}`,
});

export const generateAefT1SubmissionForbiddenFields = () => ({
  aefT1SubmissionParty: 'Forbidden Party',
  aefT1SubmissionVersion: '1.0',
  aefT1SubmissionReportYear: 2022,
  aefT1SubmissionSubmissionDate: '2022-01-15',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  cadTrustAefT1SubmissionId: uuidv4(),
});

// ============================================================================
// AEF T2 AUTHORIZATIONS GENERATORS
// ============================================================================

export const generateAefT2Authorizations = (cadTrustAefT1SubmissionId = null, cadTrustUnitId = null, cadTrustProjectId = null, cadTrustAefT5AuthorizedEntitiesId = null) => {
  const uniqueId = getUniqueId();
  const data = {
    aefT2AuthorizationsId: `TEST-AUTH-${uniqueId}`,
    aefT2AuthorizationsDate: '2022-02-01',
    aefT2AuthorizationsCooperativeApproachId: `TEST-CA-${uniqueId}`,
    aefT2AuthorizationsAuthorizedPartyId: `TEST-PARTY-${uniqueId}`,
    aefT2AuthorizationsVersion: '1.0',
    aefT2AuthorizationsQuantity: 1000.5,
    aefT2AuthorizationsMetric: 'GHC',
    aefT2AuthorizationsGwpValue: '1.0',
    aefT2AuthorizationsApplicableNonGhgMetric: 'Test metric',
    aefT2AuthorizationsSector: 'Energy industries (renewable-/ non renewable sources)',
    aefT2AuthorizationsActivityType: 'Wind',
    aefT2AuthorizationsPurposesForAuthorization: 'IMP',
    aefT2AuthorizationsAuthoziedEntityId: `TEST-ENTITY-${uniqueId}`,
    aefT2AuthorizationsOimpAuthorizedParty: 'Test OIMP Party',
    aefT2AuthorizationsAuthorizedTimeframe: '2024-2025',
    aefT2AuthorizationsAuthorizationTerms: 'Test terms',
    aefT2AuthorizationsAuthorizationDocumentation: '<p>Test documentation</p>',
    aefT2AuthorizationsFirstTransferDefinitionOimp: 'Test transfer definition',
    aefT2AuthorizationsAdditionalInformation: 'Test additional information',
  };
  if (cadTrustAefT1SubmissionId) data.cadTrustAefT1SubmissionId = cadTrustAefT1SubmissionId;
  if (cadTrustUnitId) data.cadTrustUnitId = cadTrustUnitId;
  if (cadTrustProjectId) data.cadTrustProjectId = cadTrustProjectId;
  if (cadTrustAefT5AuthorizedEntitiesId) data.cadTrustAefT5AuthorizedEntitiesId = cadTrustAefT5AuthorizedEntitiesId;
  return data;
};

export const generateAefT2AuthorizationsMinimal = () => {
  const uniqueId = getUniqueId();
  return {
    aefT2AuthorizationsId: `MIN-AUTH-${uniqueId}`,
    aefT2AuthorizationsDate: '2022-02-01',
    aefT2AuthorizationsCooperativeApproachId: `MIN-CA-${uniqueId}`,
    aefT2AuthorizationsAuthorizedPartyId: `MIN-PARTY-${uniqueId}`,
  };
};

export const generateAefT2AuthorizationsMaximal = (cadTrustAefT1SubmissionId = null, cadTrustUnitId = null, cadTrustProjectId = null, cadTrustAefT5AuthorizedEntitiesId = null) => {
  const data = {
    aefT2AuthorizationsId: getLongString(255),
    aefT2AuthorizationsDate: '2099-12-31',
    aefT2AuthorizationsCooperativeApproachId: getLongString(255),
    aefT2AuthorizationsAuthorizedPartyId: getLongString(255),
    aefT2AuthorizationsVersion: getLongString(255),
    aefT2AuthorizationsQuantity: 999999.99,
    aefT2AuthorizationsMetric: 'GHC',
    aefT2AuthorizationsGwpValue: getLongString(255),
    aefT2AuthorizationsApplicableNonGhgMetric: getLongString(255),
    aefT2AuthorizationsSector: 'Energy industries (renewable-/ non renewable sources)',
    aefT2AuthorizationsActivityType: 'Wind',
    aefT2AuthorizationsPurposesForAuthorization: 'IMP',
    aefT2AuthorizationsAuthoziedEntityId: getLongString(255),
    aefT2AuthorizationsOimpAuthorizedParty: getLongString(255),
    aefT2AuthorizationsAuthorizedTimeframe: getLongString(255),
    aefT2AuthorizationsAuthorizationTerms: getLongString(255),
    aefT2AuthorizationsAuthorizationDocumentation: `<p>${getLongString(10000)}</p>`,
    aefT2AuthorizationsFirstTransferDefinitionOimp: getLongString(10000),
    aefT2AuthorizationsAdditionalInformation: getLongString(10000),
  };
  if (cadTrustAefT1SubmissionId) data.cadTrustAefT1SubmissionId = cadTrustAefT1SubmissionId;
  if (cadTrustUnitId) data.cadTrustUnitId = cadTrustUnitId;
  if (cadTrustProjectId) data.cadTrustProjectId = cadTrustProjectId;
  if (cadTrustAefT5AuthorizedEntitiesId) data.cadTrustAefT5AuthorizedEntitiesId = cadTrustAefT5AuthorizedEntitiesId;
  return data;
};

export const generateAefT2AuthorizationsInvalidPicklist = () => {
  const uniqueId = getUniqueId();
  return {
    aefT2AuthorizationsId: `INVALID-${uniqueId}`,
    aefT2AuthorizationsDate: '2022-02-01',
    aefT2AuthorizationsCooperativeApproachId: `CA-${uniqueId}`,
    aefT2AuthorizationsAuthorizedPartyId: `PARTY-${uniqueId}`,
    aefT2AuthorizationsMetric: getInvalidPicklistValue('aefT2AuthorizationsMetric'),
    aefT2AuthorizationsSector: getInvalidPicklistValue('aefT2AuthorizationsSector'),
  };
};

export const generateAefT2AuthorizationsInvalidForeignKey = () => {
  const uniqueId = getUniqueId();
  return {
    aefT2AuthorizationsId: `INVALID-FK-${uniqueId}`,
    aefT2AuthorizationsDate: '2022-02-01',
    aefT2AuthorizationsCooperativeApproachId: `CA-${uniqueId}`,
    aefT2AuthorizationsAuthorizedPartyId: `PARTY-${uniqueId}`,
    cadTrustAefT1SubmissionId: getNonExistentId(),
    cadTrustUnitId: getNonExistentId(),
    cadTrustProjectId: getNonExistentId(),
    cadTrustAefT5AuthorizedEntitiesId: getNonExistentId(),
  };
};

export const generateAefT2AuthorizationsForbiddenFields = () => {
  const uniqueId = getUniqueId();
  return {
    aefT2AuthorizationsId: `FORBIDDEN-${uniqueId}`,
    aefT2AuthorizationsDate: '2022-02-01',
    aefT2AuthorizationsCooperativeApproachId: `CA-${uniqueId}`,
    aefT2AuthorizationsAuthorizedPartyId: `PARTY-${uniqueId}`,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    cadTrustAefT2AuthorizationId: uuidv4(),
  };
};

// ============================================================================
// AEF T3 ACTIONS GENERATORS
// ============================================================================

export const generateAefT3Actions = (cadTrustAefT2AuthorizationsId = null, cadTrustUnitId = null) => {
  const uniqueId = getUniqueId();
  const data = {
    aefT3ActionsDate: '2022-03-01',
    aefT3ActionsCoopoerativeApproachId: `TEST-CA-${uniqueId}`,
    aefT3ActionsAuthorizationId: `TEST-AUTH-${uniqueId}`,
    aefT3ActionsFirstTransferringPartyId: `TEST-FIRST-${uniqueId}`,
    aefT3ActionsPartyItmoRegistryId: `TEST-ITMO-REG-${uniqueId}`,
    aefT3ActionsItmoFirstId: `TEST-ITMO-FIRST-${uniqueId}`,
    aefT3ActionsItmoLastId: `TEST-ITMO-LAST-${uniqueId}`,
    aefT3ActionsUnitRegistryId: `TEST-UNIT-REG-${uniqueId}`,
    aefT3ActionsUnitFirstId: `TEST-UNIT-FIRST-${uniqueId}`,
    aefT3ActionsUnitLastId: `TEST-UNIT-LAST-${uniqueId}`,
    aefT3ActionsQuantityTCo2: 500.25,
    aefT3ActionsVintageYear: 2022,
    aefT3ActionsTransferringPartyId: `TEST-TRANSFER-${uniqueId}`,
    aefT3ActionsAcquiringPartyId: `TEST-ACQUIRE-${uniqueId}`,
    // Optional fields
    aefT3ActionsType: 'Energy efficiency',
    aefT3ActionsSubtype: 'Test subtype',
    aefT3ActionsMetric: 'tCO2e',
    aefT3ActionsGwpValue: '1.0',
    aefT3ActionsApplicableNonGhgMetric: 'Test metric',
    aefT3ActionsQuantityNonGhg: '100',
    aefT3ActionsMitigationType: 'Energy efficiency',
    aefT3ActionsPurposeOfUseOimp: 'Test purpose',
    aefT3ActionsUsingParticipatingPartyId: `TEST-USE-PARTY-${uniqueId}`,
    aefT3ActionsUsingAuthorizedEntityId: `TEST-USE-ENTITY-${uniqueId}`,
    aefT3ActionsItmoUsedYear: 2022,
    aefT3ActionsConsistencyCheckResult: 'Passed',
    aefT3ActionsAdditionalInformation: 'Test additional information',
  };
  if (cadTrustAefT2AuthorizationsId) data.cadTrustAefT2AuthorizationsId = cadTrustAefT2AuthorizationsId;
  if (cadTrustUnitId) data.cadTrustUnitId = cadTrustUnitId;
  return data;
};

export const generateAefT3ActionsMinimal = () => {
  const uniqueId = getUniqueId();
  return {
    aefT3ActionsDate: '2022-03-01',
    aefT3ActionsCoopoerativeApproachId: `MIN-CA-${uniqueId}`,
    aefT3ActionsAuthorizationId: `MIN-AUTH-${uniqueId}`,
    aefT3ActionsFirstTransferringPartyId: `MIN-FIRST-${uniqueId}`,
    aefT3ActionsPartyItmoRegistryId: `MIN-ITMO-REG-${uniqueId}`,
    aefT3ActionsItmoFirstId: `MIN-ITMO-FIRST-${uniqueId}`,
    aefT3ActionsItmoLastId: `MIN-ITMO-LAST-${uniqueId}`,
    aefT3ActionsUnitRegistryId: `MIN-UNIT-REG-${uniqueId}`,
    aefT3ActionsUnitFirstId: `MIN-UNIT-FIRST-${uniqueId}`,
    aefT3ActionsUnitLastId: `MIN-UNIT-LAST-${uniqueId}`,
    aefT3ActionsQuantityTCo2: 100.0,
    aefT3ActionsVintageYear: 2022,
    aefT3ActionsTransferringPartyId: `MIN-TRANSFER-${uniqueId}`,
    aefT3ActionsAcquiringPartyId: `MIN-ACQUIRE-${uniqueId}`,
  };
};

export const generateAefT3ActionsMaximal = (cadTrustAefT2AuthorizationsId = null, cadTrustUnitId = null) => {
  const uniqueId = getUniqueId();
  const data = {
    aefT3ActionsDate: '2099-12-31',
    aefT3ActionsCoopoerativeApproachId: getLongString(255),
    aefT3ActionsAuthorizationId: getLongString(255),
    aefT3ActionsFirstTransferringPartyId: getLongString(255),
    aefT3ActionsPartyItmoRegistryId: getLongString(255),
    aefT3ActionsItmoFirstId: getLongString(255),
    aefT3ActionsItmoLastId: getLongString(255),
    aefT3ActionsUnitRegistryId: getLongString(255),
    aefT3ActionsUnitFirstId: getLongString(255),
    aefT3ActionsUnitLastId: getLongString(255),
    aefT3ActionsQuantityTCo2: 999999.99,
    aefT3ActionsVintageYear: 2099,
    aefT3ActionsTransferringPartyId: getLongString(255),
    aefT3ActionsAcquiringPartyId: getLongString(255),
    // Optional fields
    aefT3ActionsType: 'Energy efficiency',
    aefT3ActionsSubtype: getLongString(255),
    aefT3ActionsMetric: 'tCO2e',
    aefT3ActionsGwpValue: getLongString(255),
    aefT3ActionsApplicableNonGhgMetric: getLongString(255),
    aefT3ActionsQuantityNonGhg: getLongString(255),
    aefT3ActionsMitigationType: 'Energy efficiency',
    aefT3ActionsPurposeOfUseOimp: getLongString(255),
    aefT3ActionsUsingParticipatingPartyId: getLongString(255),
    aefT3ActionsUsingAuthorizedEntityId: getLongString(255),
    aefT3ActionsItmoUsedYear: 2099,
    aefT3ActionsConsistencyCheckResult: getLongString(255),
    aefT3ActionsAdditionalInformation: getLongString(255),
  };
  if (cadTrustAefT2AuthorizationsId) data.cadTrustAefT2AuthorizationsId = cadTrustAefT2AuthorizationsId;
  if (cadTrustUnitId) data.cadTrustUnitId = cadTrustUnitId;
  return data;
};

export const generateAefT3ActionsInvalidForeignKey = () => ({
  aefT3ActionsId: `INVALID-FK-${getUniqueId()}`,
  aefT3ActionsDate: '2022-03-01',
  cadTrustAefT2AuthorizationsId: getNonExistentId(),
  cadTrustUnitId: getNonExistentId(),
});

export const generateAefT3ActionsForbiddenFields = () => ({
  aefT3ActionsId: `FORBIDDEN-${getUniqueId()}`,
  aefT3ActionsDate: '2022-03-01',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  cadTrustAefT3ActionId: uuidv4(),
});

// ============================================================================
// AEF T4 HOLDINGS GENERATORS
// ============================================================================

export const generateAefT4Holdings = (cadTrustAefT2AuthorizationsId = null, cadTrustUnitId = null) => {
  const uniqueId = getUniqueId();
  const data = {
    aefT4HoldingsCoopoerativeApproachId: `TEST-CA-${uniqueId}`,
    aefT4HoldingsAuthorizationId: `TEST-AUTH-${uniqueId}`,
    aefT4HoldingsFirstTransferringPartyId: `TEST-FIRST-${uniqueId}`,
    aefT4HoldingsPartyItmoRegistryId: `TEST-ITMO-REG-${uniqueId}`,
    aefT4HoldingsItmoFirstId: `TEST-ITMO-FIRST-${uniqueId}`,
    aefT4HoldingsItmoLastId: `TEST-ITMO-LAST-${uniqueId}`,
    aefT4HoldingsUnitRegistryId: `TEST-UNIT-REG-${uniqueId}`,
    aefT4HoldingsUnitFirstId: `TEST-UNIT-FIRST-${uniqueId}`,
    aefT4HoldingsUnitLastId: `TEST-UNIT-LAST-${uniqueId}`,
    aefT4HoldingsQuantityTCo2: 750.5,
    aefT4HoldingsVintageYear: 2022,
    // Optional fields
    aefT4HoldingsMetric: 'tCO2e',
    aefT4HoldingsGwpValue: '1.0',
    aefT4HoldingsApplicableNonGhgMetric: 'Test metric',
    aefT4HoldingsQuantityNonGhg: '100',
    aefT4HoldingsMitigationType: 'Energy efficiency',
  };
  if (cadTrustAefT2AuthorizationsId) data.cadTrustAefT2AuthorizationsId = cadTrustAefT2AuthorizationsId;
  if (cadTrustUnitId) data.cadTrustUnitId = cadTrustUnitId;
  return data;
};

export const generateAefT4HoldingsMinimal = () => {
  const uniqueId = getUniqueId();
  return {
    aefT4HoldingsCoopoerativeApproachId: `MIN-CA-${uniqueId}`,
    aefT4HoldingsAuthorizationId: `MIN-AUTH-${uniqueId}`,
    aefT4HoldingsFirstTransferringPartyId: `MIN-FIRST-${uniqueId}`,
    aefT4HoldingsPartyItmoRegistryId: `MIN-ITMO-REG-${uniqueId}`,
    aefT4HoldingsItmoFirstId: `MIN-ITMO-FIRST-${uniqueId}`,
    aefT4HoldingsItmoLastId: `MIN-ITMO-LAST-${uniqueId}`,
    aefT4HoldingsUnitRegistryId: `MIN-UNIT-REG-${uniqueId}`,
    aefT4HoldingsUnitFirstId: `MIN-UNIT-FIRST-${uniqueId}`,
    aefT4HoldingsUnitLastId: `MIN-UNIT-LAST-${uniqueId}`,
    aefT4HoldingsQuantityTCo2: 100.0,
    aefT4HoldingsVintageYear: 2022,
  };
};

export const generateAefT4HoldingsMaximal = (cadTrustAefT2AuthorizationsId = null, cadTrustUnitId = null) => {
  const uniqueId = getUniqueId();
  const data = {
    aefT4HoldingsCoopoerativeApproachId: getLongString(255),
    aefT4HoldingsAuthorizationId: getLongString(255),
    aefT4HoldingsFirstTransferringPartyId: getLongString(255),
    aefT4HoldingsPartyItmoRegistryId: getLongString(255),
    aefT4HoldingsItmoFirstId: getLongString(255),
    aefT4HoldingsItmoLastId: getLongString(255),
    aefT4HoldingsUnitRegistryId: getLongString(255),
    aefT4HoldingsUnitFirstId: getLongString(255),
    aefT4HoldingsUnitLastId: getLongString(255),
    aefT4HoldingsQuantityTCo2: 999999.99,
    aefT4HoldingsVintageYear: 2099,
    // Optional fields
    aefT4HoldingsMetric: 'tCO2e',
    aefT4HoldingsGwpValue: getLongString(255),
    aefT4HoldingsApplicableNonGhgMetric: getLongString(255),
    aefT4HoldingsQuantityNonGhg: getLongString(255),
    aefT4HoldingsMitigationType: 'Energy efficiency',
  };
  if (cadTrustAefT2AuthorizationsId) data.cadTrustAefT2AuthorizationsId = cadTrustAefT2AuthorizationsId;
  if (cadTrustUnitId) data.cadTrustUnitId = cadTrustUnitId;
  return data;
};

export const generateAefT4HoldingsInvalidForeignKey = () => ({
  aefT4HoldingsId: `INVALID-FK-${getUniqueId()}`,
  aefT4HoldingsDate: '2022-04-01',
  cadTrustAefT2AuthorizationsId: getNonExistentId(),
  cadTrustUnitId: getNonExistentId(),
});

export const generateAefT4HoldingsForbiddenFields = () => ({
  aefT4HoldingsId: `FORBIDDEN-${getUniqueId()}`,
  aefT4HoldingsDate: '2022-04-01',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  cadTrustAefT4HoldingId: uuidv4(),
});

// ============================================================================
// AEF T5 AUTHORIZED ENTITIES GENERATORS
// ============================================================================

export const generateAefT5AuthorizedEntities = () => {
  const uniqueId = getUniqueId();
  return {
    aefT5AuthorizedEntitiesId: `TEST-ENTITY-${uniqueId}`,
    aefT5AuthorizedEntitiesName: `Test Entity ${uniqueId}`,
    aefT5AuthorizedEntitiesAuthorizationDate: '2022-01-15',
    aefT5AuthorizedEntitiesCooperativeApproachId: `TEST-CA-${uniqueId}`,
    aefT5AuthorizedEntitiesIncorporationCountry: 'United States of America',
    aefT5AuthorizedEntitiesConditions: 'Test conditions',
    aefT5AuthorizedEntitiesChangeConditions: 'Test change conditions',
    aefT5AuthorizedEntitiesAdditionalInformation: 'Test additional information',
  };
};

export const generateAefT5AuthorizedEntitiesMinimal = () => {
  const uniqueId = getUniqueId();
  return {
    aefT5AuthorizedEntitiesId: `MIN-ENTITY-${uniqueId}`,
    aefT5AuthorizedEntitiesName: `Min Entity ${uniqueId}`,
    aefT5AuthorizedEntitiesAuthorizationDate: '2022-01-15',
    aefT5AuthorizedEntitiesCooperativeApproachId: `MIN-CA-${uniqueId}`,
  };
};

export const generateAefT5AuthorizedEntitiesMaximal = () => ({
  aefT5AuthorizedEntitiesId: getLongString(255),
  aefT5AuthorizedEntitiesName: getLongString(255),
  aefT5AuthorizedEntitiesAuthorizationDate: '2099-12-31',
  aefT5AuthorizedEntitiesCooperativeApproachId: getLongString(255),
  aefT5AuthorizedEntitiesIncorporationCountry: 'United States of America',
  aefT5AuthorizedEntitiesConditions: getLongString(10000),
  aefT5AuthorizedEntitiesChangeConditions: getLongString(10000),
  aefT5AuthorizedEntitiesAdditionalInformation: getLongString(10000),
});

export const generateAefT5AuthorizedEntitiesForbiddenFields = () => ({
  aefT5AuthorizedEntitiesId: `FORBIDDEN-${getUniqueId()}`,
  aefT5AuthorizedEntitiesName: 'Forbidden Entity',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  cadTrustAefT5AuthorizedEntityId: uuidv4(),
});
