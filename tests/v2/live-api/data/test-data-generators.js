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

/**
 * Generate large dataset of methodologies
 * @param {string} resourceType - Resource type (e.g., 'methodology')
 * @param {number} count - Number of records to generate
 * @param {string} variant - Variant to use: 'standard', 'minimal', 'maximal', 'longStrings'
 * @returns {Array}
 */
export const generateLargeDataset = (resourceType, count, variant = 'standard') => {
  const generators = {
    methodology: {
      standard: generateMethodology,
      minimal: generateMethodologyMinimal,
      maximal: generateMethodologyMaximal,
      longStrings: generateMethodologyLongStrings,
    },
  };

  const generator = generators[resourceType]?.[variant] || generators[resourceType]?.standard;

  if (!generator) {
    throw new Error(`No generator found for resource type: ${resourceType}`);
  }

  const dataset = [];
  for (let i = 0; i < count; i++) {
    // Generate unique data by adding index to ensure uniqueness
    const data = generator();
    // Make codes unique by appending index
    if (data.methodologyCode) {
      data.methodologyCode = `${data.methodologyCode}-${i}`;
    }
    dataset.push(data);
  }

  return dataset;
};
