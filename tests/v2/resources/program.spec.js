import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server';
import newProgram from '../test-data/new-program.js';
import {
  resetV2StagingTable,
  createV2TestHomeOrg,
  getV2HomeOrgId,
  validateV2SuccessResponse,
  validateV2ErrorResponse,
  validateV2RecordStructure,
  validateV2TimestampFields,
  validateV2PrimaryKey,
  cleanupV2TestData,
  getV2TestTimeout,
} from '../test-fixtures';

describe('V2 Program Resource CRUD', function () {
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

  describe('POST - Create Program', function () {
    it('creates a new program successfully', async function () {
      const response = await supertest(app)
        .post('/v2/program')
        .send(newProgram);

      validateV2SuccessResponse(response, 'Program staged successfully');
      expect(response.body).to.have.property('uuid');
      expect(response.body.uuid).to.be.a('string');
    }).timeout(getV2TestTimeout());

    it('rejects program creation with missing required fields', async function () {
      const invalidProgram = {
        programRegistry: 'Test Registry',
        // Missing programName and programRegistryProgramId
      };

      const response = await supertest(app)
        .post('/v2/program')
        .send(invalidProgram);

      validateV2ErrorResponse(response, 'Error creating new program');
    }).timeout(getV2TestTimeout());

    it('rejects program creation with timestamp fields', async function () {
      const programWithTimestamps = {
        ...newProgram,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      };

      const response = await supertest(app)
        .post('/v2/program')
        .send(programWithTimestamps);

      validateV2ErrorResponse(response, 'Timestamp fields are not allowed');
    }).timeout(getV2TestTimeout());

    it('creates program with all optional fields', async function () {
      const fullProgram = {
        ...newProgram,
        programRegistryActivityId: 'V2-ACT-001',
        programDescription: 'A comprehensive V2 carbon reduction program',
      };

      const response = await supertest(app)
        .post('/v2/program')
        .send(fullProgram);

      validateV2SuccessResponse(response, 'Program staged successfully');
    }).timeout(getV2TestTimeout());
  });

  describe('GET - Find All Programs', function () {
    beforeEach(async function () {
      // Create test programs
      await supertest(app).post('/v2/program').send(newProgram);
      await supertest(app).post('/v2/program').send({
        ...newProgram,
        programName: 'V2 Forest Program',
        programRegistryProgramId: 'V2-PROG-002',
      });
    });

    it('retrieves all programs successfully', async function () {
      const response = await supertest(app).get('/v2/program');

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      expect(response.body.length).to.be.greaterThan(0);
    }).timeout(getV2TestTimeout());

    it('retrieves programs with pagination', async function () {
      const response = await supertest(app)
        .get('/v2/program')
        .query({ page: 1, limit: 1 });

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('pagination');
      expect(response.body.data).to.be.an('array');
      expect(response.body.pagination).to.have.property('total');
      expect(response.body.pagination).to.have.property('page', 1);
      expect(response.body.pagination).to.have.property('limit', 1);
    }).timeout(getV2TestTimeout());

    it('filters programs by search criteria', async function () {
      const response = await supertest(app)
        .get('/v2/program')
        .query({ search: 'Forest' });

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('array');
      // Should find the Forest program
      const forestProgram = response.body.find(p => p.programName.includes('Forest'));
      expect(forestProgram).to.be.ok;
    }).timeout(getV2TestTimeout());
  });

  describe('GET - Find Program by ID', function () {
    let programId;

    beforeEach(async function () {
      const response = await supertest(app)
        .post('/v2/program')
        .send(newProgram);
      programId = response.body.uuid;
    });

    it('retrieves a specific program by ID', async function () {
      const response = await supertest(app).get(`/v2/program/${programId}`);

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an('object');
      expect(response.body).to.have.property('programName', newProgram.programName);
      expect(response.body).to.have.property('programRegistry', newProgram.programRegistry);
      expect(response.body).to.have.property('programRegistryProgramId', newProgram.programRegistryProgramId);
    }).timeout(getV2TestTimeout());

    it('returns 404 for non-existent program ID', async function () {
      const response = await supertest(app).get('/v2/program/999999');

      expect(response.status).to.equal(404);
      expect(response.body).to.have.property('message', 'Program not found');
      expect(response.body).to.have.property('success', false);
    }).timeout(getV2TestTimeout());
  });

  describe('PUT - Update Program', function () {
    let programId;

    beforeEach(async function () {
      const response = await supertest(app)
        .post('/v2/program')
        .send(newProgram);
      programId = response.body.uuid;
    });

    it('updates a program successfully', async function () {
      const updateData = {
        programName: 'Updated V2 Program Name',
        programDescription: 'Updated description',
      };

      const response = await supertest(app)
        .put(`/v2/program/${programId}`)
        .send(updateData);

      validateV2SuccessResponse(response, 'Program update staged successfully');
    }).timeout(getV2TestTimeout());

    it('rejects update with timestamp fields', async function () {
      const updateData = {
        programName: 'Updated Name',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      };

      const response = await supertest(app)
        .put(`/v2/program/${programId}`)
        .send(updateData);

      validateV2ErrorResponse(response, 'Timestamp fields are not allowed');
    }).timeout(getV2TestTimeout());

    it('returns 404 for update of non-existent program', async function () {
      const updateData = { programName: 'Updated Name' };

      const response = await supertest(app)
        .put('/v2/program/999999')
        .send(updateData);

      expect(response.status).to.equal(404);
      expect(response.body).to.have.property('message', 'Program not found');
    }).timeout(getV2TestTimeout());
  });

  describe('DELETE - Delete Program', function () {
    let programId;

    beforeEach(async function () {
      const response = await supertest(app)
        .post('/v2/program')
        .send(newProgram);
      programId = response.body.uuid;
    });

    it('deletes a program successfully', async function () {
      const response = await supertest(app).delete(`/v2/program/${programId}`);

      validateV2SuccessResponse(response, 'Program delete staged successfully');
    }).timeout(getV2TestTimeout());

    it('returns 404 for deletion of non-existent program', async function () {
      const response = await supertest(app).delete('/v2/program/999999');

      expect(response.status).to.equal(404);
      expect(response.body).to.have.property('message', 'Program not found');
    }).timeout(getV2TestTimeout());
  });

  describe('Validation Tests', function () {
    it('validates program name is required', async function () {
      const invalidProgram = {
        programRegistry: 'Test Registry',
        programRegistryProgramId: 'TEST-001',
        // Missing programName
      };

      const response = await supertest(app)
        .post('/v2/program')
        .send(invalidProgram);

      validateV2ErrorResponse(response, 'programName is required');
    }).timeout(getV2TestTimeout());

    it('validates program registry is required', async function () {
      const invalidProgram = {
        programName: 'Test Program',
        programRegistryProgramId: 'TEST-001',
        // Missing programRegistry
      };

      const response = await supertest(app)
        .post('/v2/program')
        .send(invalidProgram);

      validateV2ErrorResponse(response, 'programRegistry is required');
    }).timeout(getV2TestTimeout());

    it('validates program registry program ID is required', async function () {
      const invalidProgram = {
        programName: 'Test Program',
        programRegistry: 'Test Registry',
        // Missing programRegistryProgramId
      };

      const response = await supertest(app)
        .post('/v2/program')
        .send(invalidProgram);

      validateV2ErrorResponse(response, 'programRegistryProgramId is required');
    }).timeout(getV2TestTimeout());
  });

  describe('Edge Cases', function () {
    it('handles very long program names', async function () {
      const longNameProgram = {
        ...newProgram,
        programName: 'A'.repeat(1000), // Very long name
      };

      const response = await supertest(app)
        .post('/v2/program')
        .send(longNameProgram);

      // Should either succeed or fail gracefully
      expect([200, 400]).to.include(response.status);
    }).timeout(getV2TestTimeout());

    it('handles special characters in program data', async function () {
      const specialCharProgram = {
        ...newProgram,
        programName: 'Program with Special Chars: !@#$%^&*()',
        programDescription: 'Description with émojis 🚀 and unicode 中文',
      };

      const response = await supertest(app)
        .post('/v2/program')
        .send(specialCharProgram);

      validateV2SuccessResponse(response, 'Program staged successfully');
    }).timeout(getV2TestTimeout());

    it('handles empty optional fields', async function () {
      const minimalProgram = {
        programName: 'Minimal Program',
        programRegistry: 'Minimal Registry',
        programRegistryProgramId: 'MIN-001',
        programRegistryActivityId: '',
        programDescription: '',
      };

      const response = await supertest(app)
        .post('/v2/program')
        .send(minimalProgram);

      validateV2SuccessResponse(response, 'Program staged successfully');
    }).timeout(getV2TestTimeout());
  });
});
