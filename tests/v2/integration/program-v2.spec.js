import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { StagingV2, ProgramV2 } from '../../../src/models/v2/index.js';
import {
  resetV2StagingTable,
  resetV2DataTables,
  waitForV2DataLayerSync,
} from '../utils/v2-test-helpers.js';

describe('V2 Program API - Basic CRUD Tests', function () {
  this.timeout(30000);

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();
  });

  after(async function () {
    console.log('Cleaning up V2 test environment...');
    // Cleanup handled by test framework
  });

  beforeEach(async function () {
    await resetV2StagingTable();
    await resetV2DataTables();
  });

  describe('POST /v2/program (Create)', function () {
    it('should create a new program record', async function () {
      const programData = {
        programName: 'Test Program',
        programRegistry: 'Test Registry',
        programRegistryActivityId: 'ACT-001',
        programRegistryProgramId: 'PROG-001',
        programDescription: 'Test program description',
      };

      const response = await supertest(app)
        .post('/v2/program')
        .send(programData);

      if (response.status !== 200) {
        console.log('Error response:', response.body);
      }

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('Program staged successfully');
      expect(response.body).to.have.property('uuid');
      expect(response.body).to.have.property('success', true);

      // Verify record was staged
      const stagingRecord = await StagingV2.findOne({
        where: { uuid: response.body.uuid },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.table).to.equal('program');
      expect(stagingRecord.action).to.equal('INSERT');
      expect(stagingRecord.commited).to.be.false;

      // Verify staged data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].program_name).to.equal('Test Program');
      expect(stagedData[0].program_registry).to.equal('Test Registry');
      expect(stagedData[0].program_registry_activity_id).to.equal('ACT-001');
    });

    it('should create program with minimal required data', async function () {
      const minimalData = {
        programName: 'Minimal Program',
        programRegistry: 'Minimal Registry',
        programRegistryActivityId: 'MIN-ACT-001',
      };

      const response = await supertest(app)
        .post('/v2/program')
        .send(minimalData)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.uuid).to.exist;
    });

    // Validation tests
    it('should reject program without required programName', async function () {
      const invalidData = {
        programRegistry: 'Missing Name Registry',
        programRegistryActivityId: 'MISSING-NAME',
      };

      const response = await supertest(app)
        .post('/v2/program')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('programName');
    });

    it('should reject program without required programRegistry', async function () {
      const invalidData = {
        programName: 'Missing Registry Program',
        programRegistryActivityId: 'MISSING-REGISTRY',
      };

      const response = await supertest(app)
        .post('/v2/program')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('programRegistry');
    });

    it('should reject requests with cadTrustProgramId in create', async function () {
      const invalidData = {
        programName: 'Test Program',
        programRegistry: 'Test Registry',
        programRegistryActivityId: 'ACT-001',
        cadTrustProgramId: '123e4567-e89b-12d3-a456-426614174000', // User-provided UUID
      };

      const response = await supertest(app)
        .post('/v2/program')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cadTrustProgramId is auto-generated and cannot be set via API');
    });

    it('should generate valid UUID for new programs', async function () {
      const programData = {
        programName: 'UUID Test Program',
        programRegistry: 'UUID Test Registry',
        programRegistryActivityId: 'UUID-ACT-001',
      };

      const response = await supertest(app)
        .post('/v2/program')
        .send(programData)
        .expect(200);

      expect(response.body.success).to.be.true;

      // Verify staged data contains valid UUID
      const stagingRecord = await StagingV2.findOne({
        where: { uuid: response.body.uuid },
      });
      expect(stagingRecord).to.exist;

      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].cad_trust_program_id).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(stagedData[0].cad_trust_program_id).to.have.length(36);
    });

    it('should reject program with forbidden createdAt field', async function () {
      const invalidData = {
        programName: 'Forbidden Field Program',
        programRegistry: 'FORBIDDEN-FIELD',
        programRegistryActivityId: 'FORBIDDEN-001',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const response = await supertest(app)
        .post('/v2/program')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('createdAt');
    });

    it('should reject program with forbidden updatedAt field', async function () {
      const invalidData = {
        programName: 'Forbidden Field Program',
        programRegistry: 'FORBIDDEN-FIELD',
        programRegistryActivityId: 'FORBIDDEN-002',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const response = await supertest(app)
        .post('/v2/program')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('updatedAt');
    });
  });

  describe('GET /v2/program (List)', function () {
    it('should return empty array when no programs exist', async function () {
      const response = await supertest(app)
        .get('/v2/program')
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body).to.have.length(0);
    });

    it('should return programs from database', async function () {
      // Create a program directly in database
      const program = await ProgramV2.create({
        cadTrustProgramId: '550e8400-e29b-41d4-a716-446655440001', // Provide explicit UUID
        programName: 'Database Program',
        programRegistry: 'DB Registry',
        programRegistryActivityId: 'DB-ACT-001',
        programRegistryProgramId: 'DB-PROG-001',
        programDescription: 'Database program description',
      });

      const response = await supertest(app)
        .get('/v2/program')
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body).to.have.length(1);
      expect(response.body[0].programName).to.equal('Database Program');
      expect(response.body[0].programRegistry).to.equal('DB Registry');
    });
  });

  describe('GET /v2/program/:id (Get One)', function () {
    it('should return 404 for non-existent program', async function () {
      const response = await supertest(app)
        .get('/v2/program/999999')
        .expect(404);

      expect(response.body.message).to.equal('Program not found');
      expect(response.body.success).to.be.false;
    });

    it('should return program by ID', async function () {
      // Create a program directly in database
      const program = await ProgramV2.create({
        cadTrustProgramId: '550e8400-e29b-41d4-a716-446655440002', // Provide explicit UUID
        programName: 'Get Test Program',
        programRegistry: 'GET Registry',
        programRegistryActivityId: 'GET-ACT-001',
      });

      const response = await supertest(app)
        .get(`/v2/program/${program.cadTrustProgramId}`)
        .expect(200);

      expect(response.body.programName).to.equal('Get Test Program');
      expect(response.body.programRegistry).to.equal('GET Registry');
      expect(response.body.programRegistryActivityId).to.equal('GET-ACT-001');
    });
  });

  describe('PUT /v2/program/:id (Update)', function () {
    it('should return 404 for non-existent program', async function () {
      const updateData = {
        programName: 'Updated Name',
        programRegistry: 'Updated Registry',
        programRegistryActivityId: 'UPDATED-001',
      };

      const response = await supertest(app)
        .put('/v2/program/999999')
        .send(updateData)
        .expect(404);

      expect(response.body.message).to.equal('Program not found');
      expect(response.body.success).to.be.false;
    });

    it('should stage program update', async function () {
      // Create a program directly in database
      const program = await ProgramV2.create({
        cadTrustProgramId: '550e8400-e29b-41d4-a716-446655440003', // Provide explicit UUID
        programName: 'Original Name',
        programRegistry: 'Original Registry',
        programRegistryActivityId: 'ORIGINAL-001',
      });

      const updateData = {
        programName: 'Updated Name',
        programRegistry: 'Updated Registry',
        programRegistryActivityId: 'UPDATED-001',
        programRegistryProgramId: 'UPDATED-PROG-001',
        programDescription: 'Updated description',
      };

      const response = await supertest(app)
        .put(`/v2/program/${program.cadTrustProgramId}`)
        .send(updateData);

      if (response.status !== 200) {
        console.log('Error response:', response.body);
      }

      expect(response.status).to.equal(200);
      expect(response.body.message).to.equal('Program update staged successfully');
      expect(response.body.success).to.be.true;

      // Verify update was staged
      const stagingRecord = await StagingV2.findOne({
        where: {
          table: 'program',
          action: 'UPDATE',
        },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.commited).to.be.false;

      // Verify staged update data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].cad_trust_program_id).to.equal(program.cadTrustProgramId);
      expect(stagedData[0].program_name).to.equal('Updated Name');
      expect(stagedData[0].program_registry).to.equal('Updated Registry');
    });
  });

  describe('DELETE /v2/program/:id (Delete)', function () {
    it('should return 404 for non-existent program', async function () {
      const response = await supertest(app)
        .delete('/v2/program/999999')
        .expect(404);

      expect(response.body.message).to.equal('Program not found');
      expect(response.body.success).to.be.false;
    });

    it('should stage program deletion', async function () {
      // Create a program directly in database
      const program = await ProgramV2.create({
        cadTrustProgramId: '550e8400-e29b-41d4-a716-446655440004', // Provide explicit UUID
        programName: 'To Be Deleted',
        programRegistry: 'DELETE Registry',
        programRegistryActivityId: 'DELETE-001',
      });

      const response = await supertest(app)
        .delete(`/v2/program/${program.cadTrustProgramId}`)
        .expect(200);

      expect(response.body.message).to.equal('Program delete staged successfully');
      expect(response.body.success).to.be.true;

      // Verify deletion was staged
      const stagingRecord = await StagingV2.findOne({
        where: {
          table: 'program',
          action: 'DELETE',
        },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.commited).to.be.false;

      // Verify staged deletion data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].cad_trust_program_id).to.equal(program.cadTrustProgramId);
    });
  });
});
