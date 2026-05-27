import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { StagingV2, MethodologyV2, ProjectMethodologyV2, ProjectV2, ProgramV2 } from '../../../src/models/v2/index.js';
import { v4 as uuidv4 } from 'uuid';
import {
  resetV2StagingTable,
  resetV2DataTables,
  waitForV2DataLayerSync,
  createV2TestHomeOrg,
  getV2HomeOrgId,
} from '../utils/v2-test-helpers.js';

describe('V2 Methodology API - Basic CRUD Tests', function () {
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

  describe('POST /v2/methodology (Create)', function () {
        it('should create a new methodology record', async function () {
          const methodologyData = {
            methodologyCode: 'TEST-METHOD-001',
            methodologyName: 'Test Methodology',
            methodologyVersion: '1.0',
            methodologyDate: '2024-01-01',
            methodologyLink: 'https://example.com/methodology',
            methodologyType: 'Avoidance - nature',
          };

          const response = await supertest(app)
            .post('/v2/methodology')
            .send(methodologyData);

          if (response.status !== 200) {
            console.log('Error response:', response.body);
          }

          expect(response.status).to.equal(200);
          expect(response.body).to.have.property('message');
          expect(response.body.message).to.equal('Methodology staged successfully');
          expect(response.body).to.have.property('uuid');
          expect(response.body).to.have.property('success', true);

          // Verify record was staged
          expect(response.body).to.have.property('uuid');


          const stagingRecord = await StagingV2.findOne({


            where: { uuid: response.body.uuid },


          });


          expect(stagingRecord).to.exist;
          expect(stagingRecord.table).to.equal('methodology');
          expect(stagingRecord.action).to.equal('INSERT');
          expect(stagingRecord.committed).to.be.false;

          // Verify staged data
          const stagedData = JSON.parse(stagingRecord.data);
          expect(stagedData[0].methodology_code).to.equal('TEST-METHOD-001');
          expect(stagedData[0].methodology_name).to.equal('Test Methodology');
          expect(stagedData[0]).to.have.property('org_uid');
          expect(stagedData[0].org_uid).to.equal('test-home-org-v2');
        });

        it('should create methodology with minimal data', async function () {
          const minimalData = {
            methodologyCode: 'MIN-001',
            methodologyName: 'Minimal Methodology',
          };

          const response = await supertest(app)
            .post('/v2/methodology')
            .send(minimalData)
            .expect(200);

          expect(response.body.success).to.be.true;
          expect(response.body.uuid).to.exist;
        });

        // Validation tests
        it('should reject methodology without required methodologyCode', async function () {
          const invalidData = {
            methodologyName: 'Missing Code',
          };

          const response = await supertest(app)
            .post('/v2/methodology')
            .send(invalidData)
            .expect(400);

          expect(response.body.success).to.be.false;
          expect(response.body.error).to.include('methodologyCode');
        });

        it('should reject methodology without required methodologyName', async function () {
          const invalidData = {
            methodologyCode: 'MISSING-NAME',
          };

          const response = await supertest(app)
            .post('/v2/methodology')
            .send(invalidData)
            .expect(400);

          expect(response.body.success).to.be.false;
          expect(response.body.error).to.include('methodologyName');
        });

        it('should reject methodology with invalid methodologyDate format', async function () {
          const invalidData = {
            methodologyCode: 'INV-DATE',
            methodologyName: 'Invalid Date',
            methodologyDate: 'not-a-date',
          };

          const response = await supertest(app)
            .post('/v2/methodology')
            .send(invalidData)
            .expect(400);

          expect(response.body.success).to.be.false;
          expect(response.body.error).to.include('methodologyDate');
        });

        it('should reject methodology with invalid methodologyLink format', async function () {
          const invalidData = {
            methodologyCode: 'INV-LINK',
            methodologyName: 'Invalid Link',
            methodologyLink: 'not-a-valid-url',
          };

          const response = await supertest(app)
            .post('/v2/methodology')
            .send(invalidData)
            .expect(400);

          expect(response.body.success).to.be.false;
          expect(response.body.error).to.include('methodologyLink');
        });

        it('should reject methodology with invalid methodologyType (not in V2 picklist)', async function () {
          const invalidData = {
            methodologyCode: 'INV-TYPE',
            methodologyName: 'Invalid Type',
            methodologyType: 'InvalidType',
          };

          const response = await supertest(app)
            .post('/v2/methodology')
            .send(invalidData)
            .expect(400);

          expect(response.body.success).to.be.false;
          expect(response.body.error).to.include('methodologyType');
        });

        it('should accept methodology with valid V2 methodologyType', async function () {
          const validData = {
            methodologyCode: 'VALID-TYPE',
            methodologyName: 'Valid Type',
            methodologyType: 'Avoidance - nature',
          };

          const response = await supertest(app)
            .post('/v2/methodology')
            .send(validData)
            .expect(200);

          expect(response.body.success).to.be.true;
          expect(response.body.uuid).to.exist;
        });
  });

  describe('GET /v2/methodology (List)', function () {
    it('should return empty array when no methodologies exist', async function () {
      const response = await supertest(app)
        .get('/v2/methodology')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data).to.be.an('array');
      expect(response.body.data).to.have.length(0);
    });

    it('should return methodologies from database', async function () {
      // Create a methodology directly in database
      const methodology = await MethodologyV2.create({
        cadTrustMethodologyId: 'test-uuid-123',
        methodologyCode: 'DB-METHOD-001',
        methodologyName: 'Database Methodology',
        methodologyVersion: '2.0',
      });

      const response = await supertest(app)
        .get('/v2/methodology')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data).to.be.an('array');
      expect(response.body.data).to.have.length(1);
      expect(response.body.data[0].methodologyCode).to.equal('DB-METHOD-001');
      expect(response.body.data[0].methodologyName).to.equal('Database Methodology');
    });

    it('should filter methodologies by orgUid', async function () {
      await MethodologyV2.create({
        cadTrustMethodologyId: 'org-filter-1',
        methodologyCode: 'ORG-METHOD-001',
        methodologyName: 'Org A Methodology',
        orgUid: 'org-a',
      });
      await MethodologyV2.create({
        cadTrustMethodologyId: 'org-filter-2',
        methodologyCode: 'ORG-METHOD-002',
        methodologyName: 'Org B Methodology',
        orgUid: 'org-b',
      });

      const response = await supertest(app)
        .get('/v2/methodology')
        .query({ page: 1, limit: 10, orgUid: 'org-a' })
        .expect(200);

      expect(response.body.data).to.be.an('array');
      expect(response.body.data).to.have.length(1);
      expect(response.body.data[0].methodologyCode).to.equal('ORG-METHOD-001');
    });

    it('should filter methodologies by orgUid=me', async function () {
      await MethodologyV2.create({
        cadTrustMethodologyId: 'me-filter-1',
        methodologyCode: 'ME-METHOD-001',
        methodologyName: 'My Methodology',
        orgUid: 'test-home-org-v2',
      });
      await MethodologyV2.create({
        cadTrustMethodologyId: 'me-filter-2',
        methodologyCode: 'ME-METHOD-002',
        methodologyName: 'Other Methodology',
        orgUid: 'other-org',
      });

      const response = await supertest(app)
        .get('/v2/methodology')
        .query({ page: 1, limit: 10, orgUid: 'me' })
        .expect(200);

      expect(response.body.data).to.be.an('array');
      expect(response.body.data.length).to.be.greaterThan(0);
      response.body.data.forEach(m => {
        expect(m.orgUid).to.equal('test-home-org-v2');
      });
    });
  });

  describe('GET /v2/methodology/:id (Get One)', function () {
    it('should return 404 for non-existent methodology', async function () {
      const response = await supertest(app)
        .get('/v2/methodology/non-existent-id')
        .expect(404);

      expect(response.body.message).to.equal('Methodology not found');
      expect(response.body.success).to.be.false;
    });

    it('should return methodology by ID', async function () {
      // Create a methodology directly in database
      const methodology = await MethodologyV2.create({
        cadTrustMethodologyId: 'test-uuid-456',
        methodologyCode: 'GET-METHOD-001',
        methodologyName: 'Get Test Methodology',
      });

      const response = await supertest(app)
        .get(`/v2/methodology/${methodology.cadTrustMethodologyId}`)
        .expect(200);

      expect(response.body.methodologyCode).to.equal('GET-METHOD-001');
      expect(response.body.methodologyName).to.equal('Get Test Methodology');
    });
  });

  describe('PUT /v2/methodology/:id (Update)', function () {
    it('should return 404 for non-existent methodology', async function () {
      const updateData = {
        methodologyName: 'Updated Name',
      };

      const response = await supertest(app)
        .put('/v2/methodology/non-existent-id')
        .send(updateData)
        .expect(404);

      expect(response.body.message).to.equal('Methodology not found');
      expect(response.body.success).to.be.false;
    });

    it('should stage methodology update', async function () {
      // Create a methodology directly in database
      const homeOrgId = await getV2HomeOrgId();
      const methodology = await MethodologyV2.create({
        methodologyCode: 'UPDATE-METHOD-001',
        methodologyName: 'Original Name',
        orgUid: homeOrgId,
      });

      const updateData = {
        methodologyCode: 'UPDATE-METHOD-001',
        methodologyName: 'Updated Name',
        methodologyVersion: '2.0',
      };

      const response = await supertest(app)
        .put(`/v2/methodology/${methodology.cadTrustMethodologyId}`)
        .send(updateData);

      if (response.status !== 200) {
        console.log('Error response:', response.body);
      }

      expect(response.status).to.equal(200);

      expect(response.body.message).to.equal('Methodology update staged successfully');
      expect(response.body.success).to.be.true;

      // Verify update was staged
      const stagingRecord = await StagingV2.findOne({
        where: {
          table: 'methodology',
          action: 'UPDATE',
        },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.committed).to.be.false;

      // Verify staged update data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].cad_trust_methodology_id).to.equal(methodology.cadTrustMethodologyId);
      expect(stagedData[0].methodology_name).to.equal('Updated Name');
      expect(stagedData[0].methodology_version).to.equal('2.0');
    });
  });

  describe('DELETE /v2/methodology/:id (Delete)', function () {
    it('should return 404 for non-existent methodology', async function () {
      const response = await supertest(app)
        .delete('/v2/methodology/non-existent-id')
        .expect(404);

      expect(response.body.message).to.equal('Methodology not found');
      expect(response.body.success).to.be.false;
    });

    it('should stage methodology deletion', async function () {
      // Create a methodology directly in database
      const homeOrgId = await getV2HomeOrgId();
      const methodology = await MethodologyV2.create({
        cadTrustMethodologyId: 'test-uuid-delete',
        methodologyCode: 'DELETE-METHOD-001',
        methodologyName: 'To Be Deleted',
        orgUid: homeOrgId,
      });

      const response = await supertest(app)
        .delete(`/v2/methodology/${methodology.cadTrustMethodologyId}`)
        .expect(200);

      expect(response.body.message).to.equal('Methodology delete staged successfully');
      expect(response.body.success).to.be.true;

      // Verify deletion was staged
      const stagingRecord = await StagingV2.findOne({
        where: {
          table: 'methodology',
          action: 'DELETE',
        },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.committed).to.be.false;

      // Verify staged deletion data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].cad_trust_methodology_id).to.equal('test-uuid-delete');
    });
  });

  describe('DELETE /v2/methodology/:id — reference guards', function () {
    it('should return 409 when project_methodology references exist', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const methodology = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyCode: 'REFGUARD-METHOD-001',
        methodologyName: 'Referenced Methodology',
        orgUid: homeOrgId,
      });

      const program = await ProgramV2.create({
        programName: 'Ref Guard Program',
        programRegistry: 'Test Registry',
        programRegistryActivityId: 'REFGUARD-001',
      });

      const project = await ProjectV2.create({
        cadTrustProjectId: uuidv4(),
        orgUid: homeOrgId,
        projectRegistryName: 'Test Registry',
        projectId: 'REFGUARD-PROJ-001',
        projectName: 'Ref Guard Project',
        cadTrustProgramId: program.cadTrustProgramId,
      });

      await ProjectMethodologyV2.create({
        cadTrustProjectMethodologyId: uuidv4(),
        cadTrustProjectId: project.cadTrustProjectId,
        cadTrustMethodologyId: methodology.cadTrustMethodologyId,
      });

      const response = await supertest(app)
        .delete(`/v2/methodology/${methodology.cadTrustMethodologyId}`)
        .expect(409);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('Cannot delete methodology');
      expect(response.body.references).to.be.an('array').with.lengthOf(1);
      expect(response.body.references[0].table).to.equal('project_methodology');
      expect(response.body.references[0].count).to.equal(1);
      expect(response.body.hint).to.include('force=true');

      const stagingRecord = await StagingV2.findOne({
        where: { table: 'methodology', action: 'DELETE' },
      });
      expect(stagingRecord).to.be.null;
    });

    it('should return 409 when staged project_methodology references exist', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const methodology = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyCode: 'STAGED-REF-METHOD-001',
        methodologyName: 'Staged Referenced Methodology',
        orgUid: homeOrgId,
      });

      await StagingV2.create({
        uuid: uuidv4(),
        table: 'project_methodology',
        action: 'INSERT',
        data: JSON.stringify([{
          cad_trust_project_methodology_id: uuidv4(),
          cad_trust_project_id: uuidv4(),
          cad_trust_methodology_id: methodology.cadTrustMethodologyId,
        }]),
        committed: false,
        failed_commit: false,
        is_transfer: false,
      });

      const response = await supertest(app)
        .delete(`/v2/methodology/${methodology.cadTrustMethodologyId}`)
        .expect(409);

      expect(response.body.success).to.be.false;
      expect(response.body.references).to.be.an('array').with.lengthOf(1);
      expect(response.body.references[0].table).to.equal('project_methodology');
      expect(response.body.references[0].count).to.equal(1);
    });

    it('should allow delete when committed references are already staged for deletion', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const methodology = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyCode: 'STAGED-DELETE-METHOD-001',
        methodologyName: 'Methodology With Deleted Reference',
        orgUid: homeOrgId,
      });

      const program = await ProgramV2.create({
        programName: 'Staged Delete Program',
        programRegistry: 'Test Registry',
        programRegistryActivityId: 'STAGED-DELETE-001',
      });

      const project = await ProjectV2.create({
        cadTrustProjectId: uuidv4(),
        orgUid: homeOrgId,
        projectRegistryName: 'Test Registry',
        projectId: 'STAGED-DELETE-PROJ-001',
        projectName: 'Staged Delete Project',
        cadTrustProgramId: program.cadTrustProgramId,
      });

      const projectMethodology = await ProjectMethodologyV2.create({
        cadTrustProjectMethodologyId: uuidv4(),
        cadTrustProjectId: project.cadTrustProjectId,
        cadTrustMethodologyId: methodology.cadTrustMethodologyId,
      });

      await StagingV2.create({
        uuid: uuidv4(),
        table: 'project_methodology',
        action: 'DELETE',
        data: JSON.stringify([{
          cad_trust_project_methodology_id: projectMethodology.cadTrustProjectMethodologyId,
        }]),
        committed: false,
        failed_commit: false,
        is_transfer: false,
      });

      const response = await supertest(app)
        .delete(`/v2/methodology/${methodology.cadTrustMethodologyId}`)
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.message).to.equal('Methodology delete staged successfully');

      const stagingRecord = await StagingV2.findOne({
        where: { table: 'methodology', action: 'DELETE' },
      });
      expect(stagingRecord).to.exist;
    });

    it('should return 409 with ?force=true when references still exist', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const methodology = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyCode: 'FORCE-METHOD-001',
        methodologyName: 'Force Delete Methodology',
        orgUid: homeOrgId,
      });

      const program = await ProgramV2.create({
        programName: 'Force Delete Program',
        programRegistry: 'Test Registry',
        programRegistryActivityId: 'FORCE-001',
      });

      const project = await ProjectV2.create({
        cadTrustProjectId: uuidv4(),
        orgUid: homeOrgId,
        projectRegistryName: 'Test Registry',
        projectId: 'FORCE-PROJ-001',
        projectName: 'Force Delete Project',
        cadTrustProgramId: program.cadTrustProgramId,
      });

      await ProjectMethodologyV2.create({
        cadTrustProjectMethodologyId: uuidv4(),
        cadTrustProjectId: project.cadTrustProjectId,
        cadTrustMethodologyId: methodology.cadTrustMethodologyId,
      });

      const response = await supertest(app)
        .delete(`/v2/methodology/${methodology.cadTrustMethodologyId}`)
        .query({ force: 'true' })
        .expect(409);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.equal('Referenced records must be removed before deletion');

      const stagingRecord = await StagingV2.findOne({
        where: { table: 'methodology', action: 'DELETE' },
      });
      expect(stagingRecord).to.be.null;
    });
  });
});
