import { v4 as uuidv4 } from 'uuid';

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
  return `INVALID_PICKLIST_VALUE_${fieldName}_${Date.now()}`;
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
    methodologyCode: `TEST-METHOD-${Date.now()}`,
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
    methodologyCode: `MIN-METHOD-${Date.now()}`,
    methodologyName: 'Minimal Methodology',
  };
};

/**
 * Generate maximal methodology test data with all fields including optional ones
 */
export const generateMethodologyMaximal = () => {
  return {
    methodologyCode: `MAX-METHOD-${Date.now()}`,
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
    methodologyCode: `INVALID-PICKLIST-${Date.now()}`,
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
    methodologyCode: `FORBIDDEN-${Date.now()}`,
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
  const data = {
    programName: `Test Program ${Date.now()}`,
    programRegistry: 'VCS',
    programRegistryActivityId: `ACT-${Date.now()}`,
    programRegistryProgramId: `PROG-${Date.now()}`,
    programDescription: 'Test program description',
  };
  if (cadTrustProgramId) data.cadTrustProgramId = cadTrustProgramId;
  return data;
};

export const generateProgramMinimal = () => ({
  programName: `Min Program ${Date.now()}`,
  programRegistry: 'CAR',
  programRegistryActivityId: `MIN-ACT-${Date.now()}`,
});

export const generateProgramMaximal = () => ({
  programName: `Max Program ${Date.now()}`,
  programRegistry: 'Gold Standard',
  programRegistryActivityId: `MAX-ACT-${Date.now()}`,
  programRegistryProgramId: `MAX-PROG-${Date.now()}`,
  programDescription: getLongString(500),
});

export const generateProgramLongStrings = () => ({
  programName: getLongString(500),
  programRegistry: 'VCS',
  programRegistryActivityId: getLongString(200),
  programRegistryProgramId: getLongString(200),
  programDescription: getLongString(2000),
});

export const generateProgramForbiddenFields = () => ({
  programName: `FORBIDDEN-${Date.now()}`,
  programRegistry: 'VCS',
  programRegistryActivityId: `ACT-${Date.now()}`,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  cadTrustProgramId: uuidv4(),
});

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
  locationRegion: getLongString(255),
  locationGis: getLongString(10000),
  locationMapType: 'GeoJSON',
  locationMapFileLink: `https://example.com/${getLongString(400)}`,
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
  const data = {
    projectRegistryName: 'VCS',
    projectId: `PROJ-${Date.now()}`,
    projectName: `Test Project ${Date.now()}`,
    projectLink: 'https://example.com/project',
    projectDescription: 'Test project description',
    projectSector: 'Energy demand',
    projectType: 'Solar',
    projectSubtype: 'Solar',
    projectStatus: 'Registered',
    projectStatusDate: '2024-01-15',
    projectUnitMetric: 'tCO2e',
  };
  if (cadTrustProgramId) data.cadTrustProgramId = cadTrustProgramId;
  return data;
};

export const generateProjectMinimal = () => ({
  projectRegistryName: 'CAR',
  projectId: `MIN-PROJ-${Date.now()}`,
  projectName: `Min Project ${Date.now()}`,
});

export const generateProjectMaximal = (cadTrustProgramId = null) => {
  const data = {
    projectRegistryName: 'Gold Standard',
    projectId: `MAX-PROJ-${Date.now()}`,
    projectCreditingProgram: 'Test Crediting Program',
    projectName: `Max Project ${Date.now()}`,
    projectLink: `https://example.com/project/${getLongString(200)}`,
    projectDescription: getLongString(1000),
    projectSector: 'Afforestation and reforestation',
    projectType: 'Afforestation',
    projectSubtype: 'Native Species',
    projectStatus: 'Validated',
    projectStatusDate: '2024-12-31',
    projectUnitMetric: 'tCO2e',
  };
  if (cadTrustProgramId) data.cadTrustProgramId = cadTrustProgramId;
  return data;
};

export const generateProjectLongStrings = () => ({
  projectRegistryName: 'VCS',
  projectId: getLongString(200),
  projectName: getLongString(500),
  projectLink: `https://example.com/${getLongString(400)}`,
  projectDescription: getLongString(2000),
});

export const generateProjectInvalidForeignKey = () => ({
  projectRegistryName: 'VCS',
  projectId: `PROJ-${Date.now()}`,
  projectName: 'Invalid FK Project',
  cadTrustProgramId: getNonExistentId(),
});

export const generateProjectForbiddenFields = () => ({
  projectRegistryName: 'VCS',
  projectId: `FORBIDDEN-${Date.now()}`,
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
  estimationReferenceNo: `EST-REF-${Date.now()}`,
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
  estimationReferenceNo: getLongString(255),
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
  ratingName: `Test Rating ${Date.now()}`,
  ratingValue: 'A',
  ratingLink: 'https://example.com/rating',
  cadTrustProjectId,
});

export const generateRatingMinimal = (cadTrustProjectId) => ({
  ratingName: `Min Rating ${Date.now()}`,
  ratingValue: 'B',
  cadTrustProjectId,
});

export const generateRatingMaximal = (cadTrustProjectId) => ({
  ratingType: 'CCQI',
  ratingName: `Max Rating ${Date.now()}`,
  ratingValue: getLongString(255),
  ratingLink: `https://example.com/rating/${getLongString(200)}`,
  cadTrustProjectId,
});

export const generateRatingLongStrings = (cadTrustProjectId) => ({
  ratingName: getLongString(255),
  ratingValue: getLongString(255),
  ratingLink: `https://example.com/${getLongString(400)}`,
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
  stakeholderName: `Test Stakeholder ${Date.now()}`,
  stakeholderType: 'Owner',
  stakeholderLink: 'https://example.com/stakeholder',
});

export const generateStakeholderMinimal = () => ({
  stakeholderName: `Min Stakeholder ${Date.now()}`,
});

export const generateStakeholderMaximal = () => ({
  stakeholderName: `Max Stakeholder ${Date.now()}`,
  stakeholderType: 'Consultant',
  stakeholderLink: `https://example.com/stakeholder/${getLongString(200)}`,
});

export const generateStakeholderLongStrings = () => ({
  stakeholderName: getLongString(255),
  stakeholderLink: `https://example.com/${getLongString(400)}`,
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
  labelName: `Test Label ${Date.now()}`,
  labelType: 'Certification',
  labelLink: 'https://example.com/label',
  labelDate: '2024-01-15',
});

export const generateLabelMinimal = () => ({
  labelName: `Min Label ${Date.now()}`,
});

export const generateLabelMaximal = () => ({
  labelName: `Max Label ${Date.now()}`,
  labelType: 'Article 6 - Authorisation',
  labelLink: `https://example.com/label/${getLongString(200)}`,
  labelDate: '2024-12-31',
});

export const generateLabelLongStrings = () => ({
  labelName: getLongString(255),
  labelLink: `https://example.com/${getLongString(400)}`,
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
// PROJECT-METHODOLOGY GENERATORS (Composite Key)
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
// UNIT-LABEL GENERATORS (Composite Key)
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

export const generateIssuance = (cadTrustVerificationId, cadTrustMethodologyId, cadTrustLocationId = null) => {
  const data = {
    issuanceId: `ISS-${Date.now()}`,
    issuanceDate: '2024-01-15',
    cadTrustVerificationId,
    cadTrustMethodologyId,
  };
  if (cadTrustLocationId) data.cadTrustLocationId = cadTrustLocationId;
  return data;
};

export const generateIssuanceMinimal = (cadTrustVerificationId, cadTrustMethodologyId) => ({
  issuanceId: `MIN-ISS-${Date.now()}`,
  cadTrustVerificationId,
  cadTrustMethodologyId,
});

export const generateIssuanceMaximal = (cadTrustVerificationId, cadTrustMethodologyId, cadTrustLocationId) => ({
  issuanceId: `MAX-ISS-${Date.now()}`,
  issuanceDate: '2024-12-31',
  cadTrustVerificationId,
  cadTrustMethodologyId,
  cadTrustLocationId,
});

export const generateIssuanceInvalidForeignKey = () => ({
  issuanceId: 'INVALID-ISS',
  cadTrustVerificationId: getNonExistentId(),
  cadTrustMethodologyId: getNonExistentId(),
});

export const generateIssuanceForbiddenFields = (cadTrustVerificationId, cadTrustMethodologyId) => ({
  issuanceId: 'FORBIDDEN-ISS',
  cadTrustVerificationId,
  cadTrustMethodologyId,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  cadTrustIssuanceId: uuidv4(),
});

// ============================================================================
// VERIFICATION GENERATORS
// ============================================================================

export const generateVerification = (cadTrustProjectId, cadTrustValidationId = null) => {
  const data = {
    verificationId: `VER-${Date.now()}`,
    verificationStartDate: '2024-01-01',
    verificationEndDate: '2024-12-31',
    verificationBody: 'AENOR International S.A.U.',
    cadTrustProjectId,
  };
  if (cadTrustValidationId) data.cadTrustValidationId = cadTrustValidationId;
  return data;
};

export const generateVerificationMinimal = (cadTrustProjectId) => ({
  verificationId: `MIN-VER-${Date.now()}`,
  cadTrustProjectId,
});

export const generateVerificationMaximal = (cadTrustProjectId, cadTrustValidationId) => ({
  verificationId: `MAX-VER-${Date.now()}`,
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
  validationId: `VAL-${Date.now()}`,
  validationType: 'Validation of Project Design Document',
  validationBody: 'SCS Global Services',
  validationDate: '2024-01-15',
  validationCreditPeriodStartDate: '2024-01-01',
  validationCreditPeriodEndDate: '2024-12-31',
  cadTrustProjectId,
});

export const generateValidationMinimal = (cadTrustProjectId) => ({
  validationId: `MIN-VAL-${Date.now()}`,
  cadTrustProjectId,
});

export const generateValidationMaximal = (cadTrustProjectId) => ({
  validationId: `MAX-VAL-${Date.now()}`,
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
  unitSerialId: `UNIT-${Date.now()}`,
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
  unitCurrentOwner: 'Test Owner',
  unitItmosReferenceId: 'ITMOS-123',
  marketplace: 'Test Marketplace',
  marketplaceLink: 'https://example.com/marketplace',
  marketplaceIdentifier: 'MP-123',
  cadTrustIssuanceId,
});

export const generateUnitMinimal = (cadTrustIssuanceId) => ({
  unitSerialId: `MIN-UNIT-${Date.now()}`,
  unitStartBlock: '1000',
  unitEndBlock: '2000',
  unitVintageYear: 2024,
  cadTrustIssuanceId,
});

export const generateUnitMaximal = (cadTrustIssuanceId) => ({
  unitSerialId: `MAX-UNIT-${Date.now()}`,
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
  aefT1SubmissionParty: `Test Party ${Date.now()}`,
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
  aefT1SubmissionParty: `Min Party ${Date.now()}`,
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
  const data = {
    aefT2AuthorizationsId: `TEST-AUTH-${Date.now()}`,
    aefT2AuthorizationsDate: '2022-02-01',
    aefT2AuthorizationsCooperativeApproachId: `TEST-CA-${Date.now()}`,
    aefT2AuthorizationsAuthorizedPartyId: `TEST-PARTY-${Date.now()}`,
    aefT2AuthorizationsVersion: '1.0',
    aefT2AuthorizationsQuantity: 1000.5,
    aefT2AuthorizationsMetric: 'tCO2e',
    aefT2AuthorizationsGwpValue: '1.0',
    aefT2AuthorizationsApplicableNonGhgMetric: 'Test metric',
    aefT2AuthorizationsSector: 'Energy industries (renewable-/ non renewable sources)',
    aefT2AuthorizationsActivityType: 'Energy efficiency',
    aefT2AuthorizationsPurposesForAuthorization: 'Test purpose',
    aefT2AuthorizationsAuthoziedEntityId: `TEST-ENTITY-${Date.now()}`,
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

export const generateAefT2AuthorizationsMinimal = () => ({
  aefT2AuthorizationsId: `MIN-AUTH-${Date.now()}`,
  aefT2AuthorizationsDate: '2022-02-01',
  aefT2AuthorizationsCooperativeApproachId: `MIN-CA-${Date.now()}`,
  aefT2AuthorizationsAuthorizedPartyId: `MIN-PARTY-${Date.now()}`,
});

export const generateAefT2AuthorizationsMaximal = (cadTrustAefT1SubmissionId = null, cadTrustUnitId = null, cadTrustProjectId = null, cadTrustAefT5AuthorizedEntitiesId = null) => {
  const data = {
    aefT2AuthorizationsId: getLongString(255),
    aefT2AuthorizationsDate: '2099-12-31',
    aefT2AuthorizationsCooperativeApproachId: getLongString(255),
    aefT2AuthorizationsAuthorizedPartyId: getLongString(255),
    aefT2AuthorizationsVersion: getLongString(255),
    aefT2AuthorizationsQuantity: 999999.99,
    aefT2AuthorizationsMetric: 'tCO2e',
    aefT2AuthorizationsGwpValue: getLongString(255),
    aefT2AuthorizationsApplicableNonGhgMetric: getLongString(255),
    aefT2AuthorizationsSector: 'Energy industries (renewable-/ non renewable sources)',
    aefT2AuthorizationsActivityType: 'Energy efficiency',
    aefT2AuthorizationsPurposesForAuthorization: 'Test purpose',
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

export const generateAefT2AuthorizationsInvalidPicklist = () => ({
  aefT2AuthorizationsId: `INVALID-${Date.now()}`,
  aefT2AuthorizationsDate: '2022-02-01',
  aefT2AuthorizationsCooperativeApproachId: `CA-${Date.now()}`,
  aefT2AuthorizationsAuthorizedPartyId: `PARTY-${Date.now()}`,
  aefT2AuthorizationsMetric: getInvalidPicklistValue('aefT2AuthorizationsMetric'),
  aefT2AuthorizationsSector: getInvalidPicklistValue('aefT2AuthorizationsSector'),
});

export const generateAefT2AuthorizationsInvalidForeignKey = () => ({
  aefT2AuthorizationsId: `INVALID-FK-${Date.now()}`,
  aefT2AuthorizationsDate: '2022-02-01',
  aefT2AuthorizationsCooperativeApproachId: `CA-${Date.now()}`,
  aefT2AuthorizationsAuthorizedPartyId: `PARTY-${Date.now()}`,
  cadTrustAefT1SubmissionId: getNonExistentId(),
  cadTrustUnitId: getNonExistentId(),
  cadTrustProjectId: getNonExistentId(),
  cadTrustAefT5AuthorizedEntitiesId: getNonExistentId(),
});

export const generateAefT2AuthorizationsForbiddenFields = () => ({
  aefT2AuthorizationsId: `FORBIDDEN-${Date.now()}`,
  aefT2AuthorizationsDate: '2022-02-01',
  aefT2AuthorizationsCooperativeApproachId: `CA-${Date.now()}`,
  aefT2AuthorizationsAuthorizedPartyId: `PARTY-${Date.now()}`,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  cadTrustAefT2AuthorizationId: uuidv4(),
});

// ============================================================================
// AEF T3 ACTIONS GENERATORS
// ============================================================================

export const generateAefT3Actions = (cadTrustAefT2AuthorizationsId = null, cadTrustUnitId = null) => {
  const timestamp = Date.now();
  const data = {
    aefT3ActionsDate: '2022-03-01',
    aefT3ActionsCoopoerativeApproachId: `TEST-CA-${timestamp}`,
    aefT3ActionsAuthorizationId: `TEST-AUTH-${timestamp}`,
    aefT3ActionsFirstTransferringPartyId: `TEST-FIRST-${timestamp}`,
    aefT3ActionsPartyItmoRegistryId: `TEST-ITMO-REG-${timestamp}`,
    aefT3ActionsItmoFirstId: `TEST-ITMO-FIRST-${timestamp}`,
    aefT3ActionsItmoLastId: `TEST-ITMO-LAST-${timestamp}`,
    aefT3ActionsUnitRegistryId: `TEST-UNIT-REG-${timestamp}`,
    aefT3ActionsUnitFirstId: `TEST-UNIT-FIRST-${timestamp}`,
    aefT3ActionsUnitLastId: `TEST-UNIT-LAST-${timestamp}`,
    aefT3ActionsQuantityTCo2: 500.25,
    aefT3ActionsVintageYear: 2022,
    aefT3ActionsTransferringPartyId: `TEST-TRANSFER-${timestamp}`,
    aefT3ActionsAcquiringPartyId: `TEST-ACQUIRE-${timestamp}`,
    // Optional fields
    aefT3ActionsType: 'Energy efficiency',
    aefT3ActionsSubtype: 'Test subtype',
    aefT3ActionsMetric: 'tCO2e',
    aefT3ActionsGwpValue: '1.0',
    aefT3ActionsApplicableNonGhgMetric: 'Test metric',
    aefT3ActionsQuantityNonGhg: '100',
    aefT3ActionsMitigationType: 'Energy efficiency',
    aefT3ActionsPurposeOfUseOimp: 'Test purpose',
    aefT3ActionsUsingParticipatingPartyId: `TEST-USE-PARTY-${timestamp}`,
    aefT3ActionsUsingAuthorizedEntityId: `TEST-USE-ENTITY-${timestamp}`,
    aefT3ActionsItmoUsedYear: 2022,
    aefT3ActionsConsistencyCheckResult: 'Passed',
    aefT3ActionsAdditionalInformation: 'Test additional information',
  };
  if (cadTrustAefT2AuthorizationsId) data.cadTrustAefT2AuthorizationsId = cadTrustAefT2AuthorizationsId;
  if (cadTrustUnitId) data.cadTrustUnitId = cadTrustUnitId;
  return data;
};

export const generateAefT3ActionsMinimal = () => {
  const timestamp = Date.now();
  return {
    aefT3ActionsDate: '2022-03-01',
    aefT3ActionsCoopoerativeApproachId: `MIN-CA-${timestamp}`,
    aefT3ActionsAuthorizationId: `MIN-AUTH-${timestamp}`,
    aefT3ActionsFirstTransferringPartyId: `MIN-FIRST-${timestamp}`,
    aefT3ActionsPartyItmoRegistryId: `MIN-ITMO-REG-${timestamp}`,
    aefT3ActionsItmoFirstId: `MIN-ITMO-FIRST-${timestamp}`,
    aefT3ActionsItmoLastId: `MIN-ITMO-LAST-${timestamp}`,
    aefT3ActionsUnitRegistryId: `MIN-UNIT-REG-${timestamp}`,
    aefT3ActionsUnitFirstId: `MIN-UNIT-FIRST-${timestamp}`,
    aefT3ActionsUnitLastId: `MIN-UNIT-LAST-${timestamp}`,
    aefT3ActionsQuantityTCo2: 100.0,
    aefT3ActionsVintageYear: 2022,
    aefT3ActionsTransferringPartyId: `MIN-TRANSFER-${timestamp}`,
    aefT3ActionsAcquiringPartyId: `MIN-ACQUIRE-${timestamp}`,
  };
};

export const generateAefT3ActionsMaximal = (cadTrustAefT2AuthorizationsId = null, cadTrustUnitId = null) => {
  const timestamp = Date.now();
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
  aefT3ActionsId: `INVALID-FK-${Date.now()}`,
  aefT3ActionsDate: '2022-03-01',
  cadTrustAefT2AuthorizationsId: getNonExistentId(),
  cadTrustUnitId: getNonExistentId(),
});

export const generateAefT3ActionsForbiddenFields = () => ({
  aefT3ActionsId: `FORBIDDEN-${Date.now()}`,
  aefT3ActionsDate: '2022-03-01',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  cadTrustAefT3ActionId: uuidv4(),
});

// ============================================================================
// AEF T4 HOLDINGS GENERATORS
// ============================================================================

export const generateAefT4Holdings = (cadTrustAefT2AuthorizationsId = null, cadTrustUnitId = null) => {
  const timestamp = Date.now();
  const data = {
    aefT4HoldingsCoopoerativeApproachId: `TEST-CA-${timestamp}`,
    aefT4HoldingsAuthorizationId: `TEST-AUTH-${timestamp}`,
    aefT4HoldingsFirstTransferringPartyId: `TEST-FIRST-${timestamp}`,
    aefT4HoldingsPartyItmoRegistryId: `TEST-ITMO-REG-${timestamp}`,
    aefT4HoldingsItmoFirstId: `TEST-ITMO-FIRST-${timestamp}`,
    aefT4HoldingsItmoLastId: `TEST-ITMO-LAST-${timestamp}`,
    aefT4HoldingsUnitRegistryId: `TEST-UNIT-REG-${timestamp}`,
    aefT4HoldingsUnitFirstId: `TEST-UNIT-FIRST-${timestamp}`,
    aefT4HoldingsUnitLastId: `TEST-UNIT-LAST-${timestamp}`,
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
  const timestamp = Date.now();
  return {
    aefT4HoldingsCoopoerativeApproachId: `MIN-CA-${timestamp}`,
    aefT4HoldingsAuthorizationId: `MIN-AUTH-${timestamp}`,
    aefT4HoldingsFirstTransferringPartyId: `MIN-FIRST-${timestamp}`,
    aefT4HoldingsPartyItmoRegistryId: `MIN-ITMO-REG-${timestamp}`,
    aefT4HoldingsItmoFirstId: `MIN-ITMO-FIRST-${timestamp}`,
    aefT4HoldingsItmoLastId: `MIN-ITMO-LAST-${timestamp}`,
    aefT4HoldingsUnitRegistryId: `MIN-UNIT-REG-${timestamp}`,
    aefT4HoldingsUnitFirstId: `MIN-UNIT-FIRST-${timestamp}`,
    aefT4HoldingsUnitLastId: `MIN-UNIT-LAST-${timestamp}`,
    aefT4HoldingsQuantityTCo2: 100.0,
    aefT4HoldingsVintageYear: 2022,
  };
};

export const generateAefT4HoldingsMaximal = (cadTrustAefT2AuthorizationsId = null, cadTrustUnitId = null) => {
  const timestamp = Date.now();
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
  aefT4HoldingsId: `INVALID-FK-${Date.now()}`,
  aefT4HoldingsDate: '2022-04-01',
  cadTrustAefT2AuthorizationsId: getNonExistentId(),
  cadTrustUnitId: getNonExistentId(),
});

export const generateAefT4HoldingsForbiddenFields = () => ({
  aefT4HoldingsId: `FORBIDDEN-${Date.now()}`,
  aefT4HoldingsDate: '2022-04-01',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  cadTrustAefT4HoldingId: uuidv4(),
});

// ============================================================================
// AEF T5 AUTHORIZED ENTITIES GENERATORS
// ============================================================================

export const generateAefT5AuthorizedEntities = () => ({
  aefT5AuthorizedEntitiesId: `TEST-ENTITY-${Date.now()}`,
  aefT5AuthorizedEntitiesName: `Test Entity ${Date.now()}`,
  aefT5AuthorizedEntitiesAuthorizationDate: '2022-01-15',
  aefT5AuthorizedEntitiesCooperativeApproachId: `TEST-CA-${Date.now()}`,
  aefT5AuthorizedEntitiesIncorporationCountry: 'United States of America',
  aefT5AuthorizedEntitiesConditions: 'Test conditions',
  aefT5AuthorizedEntitiesChangeConditions: 'Test change conditions',
  aefT5AuthorizedEntitiesAdditionalInformation: 'Test additional information',
});

export const generateAefT5AuthorizedEntitiesMinimal = () => ({
  aefT5AuthorizedEntitiesId: `MIN-ENTITY-${Date.now()}`,
  aefT5AuthorizedEntitiesName: `Min Entity ${Date.now()}`,
  aefT5AuthorizedEntitiesAuthorizationDate: '2022-01-15',
  aefT5AuthorizedEntitiesCooperativeApproachId: `MIN-CA-${Date.now()}`,
});

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
  aefT5AuthorizedEntitiesId: `FORBIDDEN-${Date.now()}`,
  aefT5AuthorizedEntitiesName: 'Forbidden Entity',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  cadTrustAefT5AuthorizedEntityId: uuidv4(),
});
