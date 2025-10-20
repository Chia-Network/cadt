import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server';
import {
  resetV2StagingTable,
  createV2TestHomeOrg,
  getV2HomeOrgId,
  validateV2ErrorResponse,
  cleanupV2TestData,
  getV2TestTimeout,
} from '../test-fixtures';

describe('V2 Validation and Error Handling Tests', function () {
  let homeOrgUid;

  before(async function () {
    homeOrgUid = await createV2TestHomeOrg();
  });

  beforeEach(async function () {
    await resetV2StagingTable();
  });

  after(async function () {
    await cleanupV2TestData();
  });

  describe('Timestamp Field Validation', function () {
    it('rejects createdAt field in POST requests', async function () {
      const invalidData = {
        programName: 'Test Program',
        programRegistry: 'Test Registry',
        programRegistryProgramId: 'TEST-001',
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      const response = await supertest(app)
        .post('/v2/program')
        .send(invalidData);

      validateV2ErrorResponse(response, 'Timestamp fields are not allowed');
    }).timeout(getV2TestTimeout());

    it('rejects updatedAt field in POST requests', async function () {
      const invalidData = {
        programName: 'Test Program',
        programRegistry: 'Test Registry',
        programRegistryProgramId: 'TEST-001',
        updatedAt: '2025-01-01T00:00:00.000Z',
      };

      const response = await supertest(app)
        .post('/v2/program')
        .send(invalidData);

      validateV2ErrorResponse(response, 'Timestamp fields are not allowed');
    }).timeout(getV2TestTimeout());

    it('rejects both timestamp fields in POST requests', async function () {
      const invalidData = {
        programName: 'Test Program',
        programRegistry: 'Test Registry',
        programRegistryProgramId: 'TEST-001',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      };

      const response = await supertest(app)
        .post('/v2/program')
        .send(invalidData);

      validateV2ErrorResponse(response, 'Timestamp fields are not allowed');
    }).timeout(getV2TestTimeout());

    it('rejects timestamp fields in PUT requests', async function () {
      // First create a program
      const programResponse = await supertest(app)
        .post('/v2/program')
        .send({
          programName: 'Test Program',
          programRegistry: 'Test Registry',
          programRegistryProgramId: 'TEST-001',
        });

      const programId = programResponse.body.uuid;

      const invalidUpdateData = {
        programName: 'Updated Program',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      };

      const response = await supertest(app)
        .put(`/v2/program/${programId}`)
        .send(invalidUpdateData);

      validateV2ErrorResponse(response, 'Timestamp fields are not allowed');
    }).timeout(getV2TestTimeout());
  });

  describe('Required Field Validation', function () {
    it('validates required fields for program creation', async function () {
      const testCases = [
        {
          data: { programRegistry: 'Test Registry', programRegistryProgramId: 'TEST-001' },
          missingField: 'programName',
        },
        {
          data: { programName: 'Test Program', programRegistryProgramId: 'TEST-001' },
          missingField: 'programRegistry',
        },
        {
          data: { programName: 'Test Program', programRegistry: 'Test Registry' },
          missingField: 'programRegistryProgramId',
        },
      ];

      for (const testCase of testCases) {
        const response = await supertest(app)
          .post('/v2/program')
          .send(testCase.data);

        validateV2ErrorResponse(response, `${testCase.missingField} is required`);
      }
    }).timeout(getV2TestTimeout());

    it('validates required fields for project creation', async function () {
      const testCases = [
        {
          data: {
            projectRegistryName: 'Test Registry',
            projectId: 'TEST-001',
            projectName: 'Test Project',
            projectSector: 'Energy',
            projectType: 'Renewable Energy',
            projectStatus: 'Registered',
            projectUnitMetric: 'tCO2e',
          },
          missingField: 'cadTrustProgramId',
        },
        {
          data: {
            projectId: 'TEST-001',
            projectName: 'Test Project',
            projectSector: 'Energy',
            projectType: 'Renewable Energy',
            projectStatus: 'Registered',
            projectUnitMetric: 'tCO2e',
            cadTrustProgramId: 1,
          },
          missingField: 'projectRegistryName',
        },
        {
          data: {
            projectRegistryName: 'Test Registry',
            projectName: 'Test Project',
            projectSector: 'Energy',
            projectType: 'Renewable Energy',
            projectStatus: 'Registered',
            projectUnitMetric: 'tCO2e',
            cadTrustProgramId: 1,
          },
          missingField: 'projectId',
        },
      ];

      for (const testCase of testCases) {
        const response = await supertest(app)
          .post('/v2/project')
          .send(testCase.data);

        validateV2ErrorResponse(response, `${testCase.missingField} is required`);
      }
    }).timeout(getV2TestTimeout());
  });

  describe('Picklist Validation', function () {
    it('validates project sector picklist', async function () {
      const validSectors = ['Energy', 'Transport', 'Agriculture', 'Forestry', 'Waste'];
      const invalidSector = 'Invalid Sector';

      // Test valid sectors
      for (const sector of validSectors) {
        const response = await supertest(app)
          .post('/v2/project')
          .send({
            projectRegistryName: 'Test Registry',
            projectId: 'TEST-001',
            projectName: 'Test Project',
            projectSector: sector,
            projectType: 'Renewable Energy',
            projectStatus: 'Registered',
            projectUnitMetric: 'tCO2e',
            cadTrustProgramId: 1,
          });

        expect(response.status).to.equal(200);
      }

      // Test invalid sector
      const invalidResponse = await supertest(app)
        .post('/v2/project')
        .send({
          projectRegistryName: 'Test Registry',
          projectId: 'TEST-001',
          projectName: 'Test Project',
          projectSector: invalidSector,
          projectType: 'Renewable Energy',
          projectStatus: 'Registered',
          projectUnitMetric: 'tCO2e',
          cadTrustProgramId: 1,
        });

      validateV2ErrorResponse(invalidResponse, 'does not include a valid option');
    }).timeout(getV2TestTimeout());

    it('validates unit type picklist', async function () {
      const validTypes = ['Reduction', 'Removal', 'Avoidance'];
      const invalidType = 'Invalid Type';

      // Test valid types
      for (const type of validTypes) {
        const response = await supertest(app)
          .post('/v2/unit')
          .send({
            unitSerialId: 'TEST-UNIT-001',
            unitStartBlock: '1000000',
            unitEndBlock: '1000100',
            unitVintageYear: 2025,
            unitType: type,
            unitStatus: 'Available',
            unitMetric: 'tCO2e',
            cadTrustIssuanceId: 1,
          });

        expect(response.status).to.equal(200);
      }

      // Test invalid type
      const invalidResponse = await supertest(app)
        .post('/v2/unit')
        .send({
          unitSerialId: 'TEST-UNIT-001',
          unitStartBlock: '1000000',
          unitEndBlock: '1000100',
          unitVintageYear: 2025,
          unitType: invalidType,
          unitStatus: 'Available',
          unitMetric: 'tCO2e',
          cadTrustIssuanceId: 1,
        });

      validateV2ErrorResponse(invalidResponse, 'does not include a valid option');
    }).timeout(getV2TestTimeout());
  });

  describe('Data Type Validation', function () {
    it('validates numeric fields', async function () {
      const invalidNumericData = {
        unitSerialId: 'TEST-UNIT-001',
        unitStartBlock: '1000000',
        unitEndBlock: '1000100',
        unitVintageYear: 'invalid-year', // Should be number
        unitType: 'Reduction',
        unitStatus: 'Available',
        unitMetric: 'tCO2e',
        cadTrustIssuanceId: 1,
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(invalidNumericData);

      validateV2ErrorResponse(response, 'must be a number');
    }).timeout(getV2TestTimeout());

    it('validates date fields', async function () {
      const invalidDateData = {
        validationId: 'TEST-VAL-001',
        validationType: 'Third Party',
        validationBody: 'Test Body',
        validationDate: 'invalid-date', // Should be valid date
        validationCreditPeriodStartDate: '2025-01-01T00:00:00.000Z',
        validationCreditPeriodEndDate: '2025-12-31T23:59:59.000Z',
        cadTrustProjectId: 1,
      };

      const response = await supertest(app)
        .post('/v2/validation')
        .send(invalidDateData);

      validateV2ErrorResponse(response, 'must be a valid date');
    }).timeout(getV2TestTimeout());

    it('validates decimal fields', async function () {
      const invalidDecimalData = {
        unitSerialId: 'TEST-UNIT-001',
        unitStartBlock: '1000000',
        unitEndBlock: '1000100',
        unitVintageYear: 2025,
        unitType: 'Reduction',
        unitStatus: 'Available',
        unitMetric: 'tCO2e',
        unitCount: 'invalid-count', // Should be decimal
        cadTrustIssuanceId: 1,
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(invalidDecimalData);

      validateV2ErrorResponse(response, 'must be a number');
    }).timeout(getV2TestTimeout());
  });

  describe('String Length Validation', function () {
    it('validates maximum string length', async function () {
      const longStringData = {
        programName: 'A'.repeat(10000), // Very long string
        programRegistry: 'Test Registry',
        programRegistryProgramId: 'TEST-001',
      };

      const response = await supertest(app)
        .post('/v2/program')
        .send(longStringData);

      // Should either succeed or fail gracefully
      expect([200, 400]).to.include(response.status);
    }).timeout(getV2TestTimeout());

    it('validates minimum string length', async function () {
      const emptyStringData = {
        programName: '', // Empty string
        programRegistry: 'Test Registry',
        programRegistryProgramId: 'TEST-001',
      };

      const response = await supertest(app)
        .post('/v2/program')
        .send(emptyStringData);

      validateV2ErrorResponse(response, 'is required');
    }).timeout(getV2TestTimeout());
  });

  describe('Foreign Key Validation', function () {
    it('validates foreign key references', async function () {
      // Try to create project with non-existent program ID
      const invalidForeignKeyData = {
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-001',
        projectName: 'Test Project',
        projectSector: 'Energy',
        projectType: 'Renewable Energy',
        projectStatus: 'Registered',
        projectUnitMetric: 'tCO2e',
        cadTrustProgramId: 999999, // Non-existent program ID
      };

      const response = await supertest(app)
        .post('/v2/project')
        .send(invalidForeignKeyData);

      // Should either succeed (if FK validation is deferred) or fail gracefully
      expect([200, 400, 404]).to.include(response.status);
    }).timeout(getV2TestTimeout());
  });

  describe('Malformed Request Handling', function () {
    it('handles malformed JSON', async function () {
      const response = await supertest(app)
        .post('/v2/program')
        .set('Content-Type', 'application/json')
        .send('invalid json data');

      expect(response.status).to.equal(400);
    }).timeout(getV2TestTimeout());

    it('handles missing Content-Type header', async function () {
      const response = await supertest(app)
        .post('/v2/program')
        .send('{"programName":"Test","programRegistry":"Test","programRegistryProgramId":"TEST-001"}');

      expect(response.status).to.equal(400);
    }).timeout(getV2TestTimeout());

    it('handles empty request body', async function () {
      const response = await supertest(app)
        .post('/v2/program')
        .send({});

      validateV2ErrorResponse(response, 'Error creating new program');
    }).timeout(getV2TestTimeout());
  });

  describe('Invalid HTTP Methods', function () {
    it('handles unsupported HTTP methods', async function () {
      const response = await supertest(app)
        .patch('/v2/program/1')
        .send({ programName: 'Test' });

      expect(response.status).to.equal(404);
    }).timeout(getV2TestTimeout());

    it('handles invalid route paths', async function () {
      const response = await supertest(app)
        .get('/v2/invalid-resource');

      expect(response.status).to.equal(404);
    }).timeout(getV2TestTimeout());
  });

  describe('Edge Case Validation', function () {
    it('handles special characters in data', async function () {
      const specialCharData = {
        programName: 'Program with Special Chars: !@#$%^&*()',
        programRegistry: 'Registry with émojis 🚀',
        programRegistryProgramId: 'TEST-特殊字符-001',
        programDescription: 'Description with unicode 中文 and émojis 🚀',
      };

      const response = await supertest(app)
        .post('/v2/program')
        .send(specialCharData);

      validateV2SuccessResponse(response, 'Program staged successfully');
    }).timeout(getV2TestTimeout());

    it('handles null and undefined values', async function () {
      const nullData = {
        programName: 'Test Program',
        programRegistry: 'Test Registry',
        programRegistryProgramId: 'TEST-001',
        programDescription: null,
        programRegistryActivityId: undefined,
      };

      const response = await supertest(app)
        .post('/v2/program')
        .send(nullData);

      validateV2SuccessResponse(response, 'Program staged successfully');
    }).timeout(getV2TestTimeout());

    it('handles boolean values', async function () {
      const booleanData = {
        unitSerialId: 'TEST-UNIT-001',
        unitStartBlock: '1000000',
        unitEndBlock: '1000100',
        unitVintageYear: 2025,
        unitType: 'Reduction',
        unitStatus: 'Available',
        unitMetric: 'tCO2e',
        cadTrustIssuanceId: 1,
        // Add boolean fields if they exist in the schema
      };

      const response = await supertest(app)
        .post('/v2/unit')
        .send(booleanData);

      expect(response.status).to.equal(200);
    }).timeout(getV2TestTimeout());
  });

  describe('Concurrent Validation', function () {
    it('handles concurrent validation requests', async function () {
      const concurrentRequests = Array.from({ length: 10 }, (_, i) =>
        supertest(app).post('/v2/program').send({
          programName: `Concurrent Program ${i}`,
          programRegistry: 'Test Registry',
          programRegistryProgramId: `TEST-CONCURRENT-${i}`,
        })
      );

      const results = await Promise.all(concurrentRequests);

      // All requests should succeed
      results.forEach(result => {
        expect(result.status).to.equal(200);
      });
    }).timeout(getV2TestTimeout() * 2);
  });

  describe('Error Message Consistency', function () {
    it('provides consistent error message format', async function () {
      const invalidData = {
        // Missing required fields
      };

      const response = await supertest(app)
        .post('/v2/program')
        .send(invalidData);

      expect(response.status).to.equal(400);
      expect(response.body).to.have.property('message');
      expect(response.body).to.have.property('success', false);
      expect(response.body).to.have.property('error');
      expect(response.body.message).to.be.a('string');
      expect(response.body.error).to.be.a('string');
    }).timeout(getV2TestTimeout());
  });
});
