import { getPicklistValuesV2 } from '../../../src/utils/v2-data-loaders.js';

/**
 * V2 Test Utilities with Real Picklist Values
 *
 * This module provides utilities for testing V2 endpoints with the actual
 * picklist values from the governance CSV data.
 */

// Initialize picklist values
let picklistValues = null;

export const initializePicklists = async () => {
  if (!picklistValues) {
    const { pullPickListValuesV2 } = await import('../../../src/utils/v2-data-loaders.js');
    await pullPickListValuesV2();
    picklistValues = getPicklistValuesV2();
  }
  return picklistValues;
};

/**
 * Get a random valid value from a picklist
 */
export const getRandomPicklistValue = (fieldName) => {
  if (!picklistValues) {
    throw new Error('Picklists not initialized. Call initializePicklists() first.');
  }

  const values = picklistValues[fieldName];
  if (!values || !Array.isArray(values)) {
    throw new Error(`No picklist values found for field: ${fieldName}`);
  }

  return values[Math.floor(Math.random() * values.length)];
};

/**
 * Get all valid values for a picklist field
 */
export const getPicklistValues = (fieldName) => {
  if (!picklistValues) {
    throw new Error('Picklists not initialized. Call initializePicklists() first.');
  }

  return picklistValues[fieldName] || [];
};

/**
 * Check if a value is valid for a picklist field
 */
export const isValidPicklistValue = (fieldName, value) => {
  const values = getPicklistValues(fieldName);
  return values.includes(value);
};

/**
 * Get an invalid value for a picklist field (for negative testing)
 */
export const getInvalidPicklistValue = (fieldName) => {
  return `Invalid${fieldName}Value`;
};

/**
 * Test data generators with real picklist values
 */
export const generateTestData = {
  methodology: () => ({
    methodologyCode: `TEST-METHOD-${Date.now()}`,
    methodologyName: 'Test Methodology',
    methodologyVersion: '1.0',
    methodologyDate: '2024-01-01',
    methodologyLink: 'https://example.com/methodology',
    methodologyType: getRandomPicklistValue('methodologyType'),
  }),

  project: () => ({
    projectRegistryName: 'Test Registry',
    projectId: `TEST-PROJECT-${Date.now()}`,
    projectName: 'Test Project',
    projectDescription: 'Test project description',
    projectSector: [getRandomPicklistValue('projectSector')],
    projectType: [getRandomPicklistValue('projectType')],
    projectStatus: getRandomPicklistValue('projectStatus'),
    projectUnitMetric: getRandomPicklistValue('projectUnitMetric'),
  }),

  validation: () => ({
    validationId: `TEST-VALIDATION-${Date.now()}`,
    validationType: getRandomPicklistValue('validationType'),
    validationBody: getRandomPicklistValue('validationBody'),
    validationDate: '2024-01-01',
  }),

  unit: () => ({
    unitSerialId: `TEST-UNIT-${Date.now()}`,
    unitStartBlock: '1000',
    unitEndBlock: '2000',
    unitCount: 100.5,
    unitType: getRandomPicklistValue('unitType'),
    unitVintageYear: 2024,
    unitStatus: getRandomPicklistValue('unitStatus'),
    unitMetric: getRandomPicklistValue('unitMetric'),
  }),

  location: () => ({
    locationCountry: getRandomPicklistValue('locationCountry'),
    locationRegion: 'Test Region',
    locationGis: '{"type": "Point", "coordinates": [0, 0]}',
    locationMapType: getRandomPicklistValue('locationMapType'),
    locationMapFileLink: 'https://example.com/map.geojson',
  }),

  stakeholder: () => ({
    stakeholderName: 'Test Stakeholder',
    stakeholderType: getRandomPicklistValue('stakeholderType'),
    stakeholderLink: 'https://example.com/stakeholder',
  }),

  label: () => ({
    labelName: 'Test Label',
    labelType: getRandomPicklistValue('labelType'),
    labelLink: 'https://example.com/label',
    labelDate: '2024-01-01',
  }),

  coBenefit: () => ({
    coBenefitId: getRandomPicklistValue('coBenefitId'),
  }),

  rating: () => ({
    ratingType: getRandomPicklistValue('ratingType'),
    ratingValue: 'A+',
    ratingLink: 'https://example.com/rating',
  }),
};

/**
 * Validation test helpers
 */
export const validationTests = {
  /**
   * Test that a field accepts valid picklist values
   */
  testValidPicklistValues: (fieldName, endpoint, createData) => {
    return async function() {
      const values = getPicklistValues(fieldName);

      for (const value of values.slice(0, 3)) { // Test first 3 values
        const testData = { ...createData, [fieldName]: value };

        const response = await this.request
          .post(endpoint)
          .send(testData);

        this.expect(response.status).to.equal(200);
        this.expect(response.body.success).to.be.true;
      }
    };
  },

  /**
   * Test that a field rejects invalid picklist values
   */
  testInvalidPicklistValues: (fieldName, endpoint, createData) => {
    return async function() {
      const invalidValue = getInvalidPicklistValue(fieldName);
      const testData = { ...createData, [fieldName]: invalidValue };

      const response = await this.request
        .post(endpoint)
        .send(testData);

      this.expect(response.status).to.equal(400);
      this.expect(response.body.success).to.be.false;
      this.expect(response.body.error).to.include(fieldName);
    };
  },
};

/**
 * Example usage in test files:
 *
 * ```javascript
 * import {
 *   initializePicklists,
 *   generateTestData,
 *   validationTests
 * } from '../utils/v2-picklist-test-helpers.js';
 *
 * describe('V2 Endpoint Tests', function() {
 *   before(async function() {
 *     await initializePicklists();
 *   });
 *
 *   it('should create with valid picklist values', async function() {
 *     const testData = generateTestData.methodology();
 *     // Use testData in your test...
 *   });
 *
 *   it('should validate methodologyType picklist', validationTests.testValidPicklistValues(
 *     'methodologyType',
 *     '/v2/methodology',
 *     generateTestData.methodology()
 *   ));
 * });
 * ```
 */
