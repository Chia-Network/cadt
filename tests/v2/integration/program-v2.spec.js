import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { StagingV2, ProgramV2, ProjectV2 } from '../../../src/models/v2/index.js';
import { v4 as uuidv4 } from 'uuid';
import {
  resetV2StagingTable,
  resetV2DataTables,
  createV2TestHomeOrg,
  getV2HomeOrgId,
} from '../utils/v2-test-helpers.js';
import { runCrudStagingSuite } from '../utils/crud-suite-factory.js';

describe('V2 Program API - Basic CRUD Tests', function () {
  this.timeout(30000);

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();
    await createV2TestHomeOrg();
  });

  after(async function () {
    console.log('Cleaning up V2 test environment...');
    // Cleanup handled by test framework
  });

  beforeEach(async function () {
    await resetV2StagingTable();
    await resetV2DataTables();
  });

  runCrudStagingSuite({
    resource: 'program',
    label: 'Program',
    pk: 'cadTrustProgramId',
    pkColumn: 'cad_trust_program_id',
    missingId: '999999',
    requiredFields: ['programName', 'programRegistry'],
    validPayload: () => ({
      programName: 'Test Program',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'ACT-001',
      programRegistryProgramId: 'PROG-001',
      programDescription: 'Test program description',
    }),
    expectStagedInsert: (staged) => {
      expect(staged.program_name).to.equal('Test Program');
      expect(staged.program_registry).to.equal('Test Registry');
      expect(staged.program_registry_activity_id).to.equal('ACT-001');
      expect(staged).to.have.property('org_uid');
      expect(staged.org_uid).to.equal('test-home-org-v2');
    },
    list: {
      seed: () =>
        ProgramV2.create({
          cadTrustProgramId: uuidv4(),
          programName: 'Database Program',
          programRegistry: 'DB Registry',
          programRegistryActivityId: 'DB-ACT-001',
          programRegistryProgramId: 'DB-PROG-001',
          programDescription: 'Database program description',
        }),
      expectRow: (row) => {
        expect(row.programName).to.equal('Database Program');
        expect(row.programRegistry).to.equal('DB Registry');
      },
    },
    seed: async () =>
      ProgramV2.create({
        cadTrustProgramId: uuidv4(),
        programName: 'Original Name',
        programRegistry: 'Original Registry',
        programRegistryActivityId: 'ORIGINAL-001',
        orgUid: await getV2HomeOrgId(),
      }),
    updatePayload: () => ({
      programName: 'Updated Name',
      programRegistry: 'Updated Registry',
      programRegistryActivityId: 'UPDATED-001',
      programRegistryProgramId: 'UPDATED-PROG-001',
      programDescription: 'Updated description',
    }),
    expectStagedUpdate: (staged) => {
      expect(staged.program_name).to.equal('Updated Name');
      expect(staged.program_registry).to.equal('Updated Registry');
    },
  });

  describe('POST /v2/program (Create)', function () {
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
  });

  describe('GET /v2/program (List)', function () {
    it('should filter programs by orgUid', async function () {
      await ProgramV2.create({
        cadTrustProgramId: '550e8400-e29b-41d4-a716-446655440010',
        programName: 'Org A Program',
        programRegistry: 'Org A Registry',
        programRegistryActivityId: 'ORG-A-ACT-001',
        orgUid: 'org-a',
      });
      await ProgramV2.create({
        cadTrustProgramId: '550e8400-e29b-41d4-a716-446655440011',
        programName: 'Org B Program',
        programRegistry: 'Org B Registry',
        programRegistryActivityId: 'ORG-B-ACT-001',
        orgUid: 'org-b',
      });

      const response = await supertest(app)
        .get('/v2/program')
        .query({ page: 1, limit: 10, orgUid: 'org-a' })
        .expect(200);

      expect(response.body.data).to.be.an('array');
      expect(response.body.data).to.have.length(1);
      expect(response.body.data[0].programName).to.equal('Org A Program');
    });

    it('should filter programs by orgUid=me', async function () {
      await ProgramV2.create({
        cadTrustProgramId: '550e8400-e29b-41d4-a716-446655440020',
        programName: 'My Program',
        programRegistry: 'My Registry',
        programRegistryActivityId: 'ME-ACT-001',
        orgUid: 'test-home-org-v2',
      });
      await ProgramV2.create({
        cadTrustProgramId: '550e8400-e29b-41d4-a716-446655440021',
        programName: 'Other Program',
        programRegistry: 'Other Registry',
        programRegistryActivityId: 'OTHER-ACT-001',
        orgUid: 'other-org',
      });

      const response = await supertest(app)
        .get('/v2/program')
        .query({ page: 1, limit: 10, orgUid: 'me' })
        .expect(200);

      expect(response.body.data).to.be.an('array');
      expect(response.body.data.length).to.be.greaterThan(0);
      response.body.data.forEach(p => {
        expect(p.orgUid).to.equal('test-home-org-v2');
      });
    });
  });

  describe('GET /v2/program/:id (Get One)', function () {
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

  describe('DELETE /v2/program/:id — reference guards', function () {
    it('should return 409 when projects reference the program', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const program = await ProgramV2.create({
        cadTrustProgramId: uuidv4(),
        programName: 'Referenced Program',
        programRegistry: 'Test Registry',
        programRegistryActivityId: 'REFGUARD-PROG-001',
        orgUid: homeOrgId,
      });

      await ProjectV2.create({
        cadTrustProjectId: uuidv4(),
        orgUid: homeOrgId,
        projectRegistryName: 'Test Registry',
        projectId: 'REFGUARD-PROJ-001',
        projectName: 'Project Using Program',
        cadTrustProgramId: program.cadTrustProgramId,
      });

      const response = await supertest(app)
        .delete(`/v2/program/${program.cadTrustProgramId}`)
        .expect(409);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('Cannot delete program');
      expect(response.body.references).to.be.an('array').with.lengthOf(1);
      expect(response.body.references[0].table).to.equal('project');
      expect(response.body.references[0].count).to.equal(1);
      expect(response.body.error).to.equal('Referenced records must be removed before deletion');

      const stagingRecord = await StagingV2.findOne({
        where: { table: 'program', action: 'DELETE' },
      });
      expect(stagingRecord).to.be.null;
    });

    it('should return 409 when staged project references exist', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const program = await ProgramV2.create({
        cadTrustProgramId: uuidv4(),
        programName: 'Staged Referenced Program',
        programRegistry: 'Test Registry',
        programRegistryActivityId: 'STAGED-REF-PROG-001',
        orgUid: homeOrgId,
      });

      await StagingV2.create({
        uuid: uuidv4(),
        table: 'project',
        action: 'INSERT',
        data: JSON.stringify([{
          cad_trust_project_id: uuidv4(),
          org_uid: homeOrgId,
          project_registry_name: 'Test Registry',
          project_id: 'STAGED-REF-PROJECT-001',
          project_name: 'Staged Project',
          cad_trust_program_id: program.cadTrustProgramId,
        }]),
        committed: false,
        failed_commit: false,
        is_transfer: false,
      });

      const response = await supertest(app)
        .delete(`/v2/program/${program.cadTrustProgramId}`)
        .expect(409);

      expect(response.body.success).to.be.false;
      expect(response.body.references).to.be.an('array').with.lengthOf(1);
      expect(response.body.references[0].table).to.equal('project');
      expect(response.body.references[0].count).to.equal(1);
    });

    it('should return 409 with ?force=true when references still exist', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const program = await ProgramV2.create({
        cadTrustProgramId: uuidv4(),
        programName: 'Force Delete Program',
        programRegistry: 'Test Registry',
        programRegistryActivityId: 'FORCE-PROG-001',
        orgUid: homeOrgId,
      });

      await ProjectV2.create({
        cadTrustProjectId: uuidv4(),
        orgUid: homeOrgId,
        projectRegistryName: 'Test Registry',
        projectId: 'FORCE-PROJ-001',
        projectName: 'Project Using Program for Force',
        cadTrustProgramId: program.cadTrustProgramId,
      });

      const response = await supertest(app)
        .delete(`/v2/program/${program.cadTrustProgramId}`)
        .query({ force: 'true' })
        .expect(409);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.equal('Referenced records must be removed before deletion');

      const stagingRecord = await StagingV2.findOne({
        where: { table: 'program', action: 'DELETE' },
      });
      expect(stagingRecord).to.be.null;
    });
  });
});
