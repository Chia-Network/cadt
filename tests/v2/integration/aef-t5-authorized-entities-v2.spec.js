import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { AefT5AuthorizedEntitiesV2, AefT1SubmissionV2, UnitV2, ProjectV2, IssuanceV2, VerificationV2, ProgramV2, MethodologyV2, ProjectMethodologyV2, StagingV2 } from '../../../src/models/v2/index.js';
import { v4 as uuidv4 } from 'uuid';
import { createV2TestHomeOrg, getV2HomeOrgId } from '../utils/v2-test-helpers.js';

describe('AEF-T5-Authorized-Entities V2 Integration Tests', function () {
  this.timeout(300000); // 5 minute timeout for comprehensive tests

  let testAefT1SubmissionId;
  let testUnitId;
  let testProjectId;
  let testIssuanceId;
  let testVerificationId;
  let testProgramId;
  let testMethodologyId;

  before(async function () {
    console.log('Setting up AEF-T5-Authorized-Entities V2 test environment...');
    await prepareV2Db();

    // Create test home organization
    await createV2TestHomeOrg();
    const homeOrgId = await getV2HomeOrgId();

    // Create test program
    const program = await ProgramV2.create({
      cadTrustProgramId: uuidv4(),
      programName: 'Test Program for AEF-T5',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-AEFT5-001',
    });
    testProgramId = program.cadTrustProgramId;

    // Create test project
    const project = await ProjectV2.create({
      cadTrustProjectId: uuidv4(),
      orgUid: homeOrgId,
      projectName: 'Test Project for AEF-T5',
      projectRegistryName: 'Test Registry',
      projectId: 'TEST-PROJ-AEFT5-001',
      projectSector: ['Energy industries (renewable-/ non renewable sources)'],
      projectType: ['Energy efficiency'],
      projectStatus: 'Registered',
      projectUnitMetric: 'tCO2e',
      cadTrustProgramId: testProgramId,
    });
    testProjectId = project.cadTrustProjectId;

    // Create test methodology
    const methodology = await MethodologyV2.create({
      cadTrustMethodologyId: uuidv4(),
      methodologyName: 'Test Methodology for AEF-T5',
      methodologyCode: 'TEST-METH-AEFT5-001',
      methodologyType: 'Test methodology type',
      methodologyDescription: 'Test methodology description',
    });
    testMethodologyId = methodology.cadTrustMethodologyId;

    // Create test verification
    const verification = await VerificationV2.create({
      cadTrustVerificationId: uuidv4(),
      verificationId: 'TEST-VER-AEFT5-001',
      verificationStartDate: '2024-01-01',
      verificationEndDate: '2024-12-31',
      verificationBody: 'Test Verification Body',
      verificationStandard: 'Test Standard',
      verificationMethodology: 'Test Methodology',
      verificationScope: 'Test Scope',
      verificationDescription: 'Test verification description',
      cadTrustProjectId: testProjectId,
    });
    testVerificationId = verification.cadTrustVerificationId;

    // Create test project-methodology join record
    const projectMethodology = await ProjectMethodologyV2.create({
      cadTrustProjectMethodologyId: uuidv4(),
      cadTrustProjectId: testProjectId,
      cadTrustMethodologyId: testMethodologyId,
      projectMethodologyDate: '2024-01-01',
    });

    // Create test issuance
    const issuance = await IssuanceV2.create({
      cadTrustIssuanceId: uuidv4(),
      issuanceId: 'TEST-ISS-AEFT5-001',
      issuanceDate: '2024-01-01',
      cadTrustVerificationId: testVerificationId,
      cadTrustProjectMethodologyId: projectMethodology.cadTrustProjectMethodologyId,
    });
    testIssuanceId = issuance.cadTrustIssuanceId;

    // Create test unit
    const unit = await UnitV2.create({
      cadTrustUnitId: uuidv4(),
      orgUid: homeOrgId,
      unitSerialId: 'TEST-UNIT-AEFT5-001',
      unitStartBlock: '1000',
      unitEndBlock: '2000',
      unitCount: 100.5,
      unitType: 'Test Unit Type',
      unitVintageYear: 2024,
      unitStatus: 'Active',
      unitStatusReason: 'Test reason',
      unitStatusDate: '2024-01-01',
      unitRetirementDetail: 'Test retirement detail',
      unitRetirementBeneficiary: 'Test beneficiary',
      unitRetirementBeneficiaryId: 'TEST-BEN-001',
      unitLink: 'https://example.com/unit',
      unitMetric: 'tCO2e',
      unitCurrentOwner: 'Test Owner',
      unitItmosReferenceId: 'TEST-ITMOS-001',
      cadTrustIssuanceId: testIssuanceId,
    });
    testUnitId = unit.cadTrustUnitId;

    // Create test AEF-T1-Submission
    const aefT1Submission = await AefT1SubmissionV2.create({
      cadTrustAefT1SubmissionId: uuidv4(),
      aefT1SubmissionParty: 'Test Party for AEF-T5',
      aefT1SubmissionVersion: '1.0',
      aefT1SubmissionReportYear: 2024,
      aefT1SubmissionSubmissionDate: '2024-01-15',
    });
    testAefT1SubmissionId = aefT1Submission.cadTrustAefT1SubmissionId;
  });

  after(async function () {
    console.log('AEF-T5-Authorized-Entities V2 test cleanup completed');
  });

  describe('POST /v2/aef-t5-authorized-entities (Create)', function () {
    it('should create a new AEF-T5-Authorized-Entities record via API', async function () {
      const aefT5AuthorizedEntitiesData = {
        cadTrustAefT1SubmissionId: testAefT1SubmissionId,
        cadTrustUnitId: testUnitId,
        cadTrustProjectId: testProjectId,
        aefT5AuthorizedEntitiesAuthorizationDate: '2024-01-15',
        aefT5AuthorizedEntitiesName: 'API Test Entity',
        aefT5AuthorizedEntitiesId: 'TEST-AE-API',
        aefT5AuthorizedEntitiesCooperativeApproachId: 'TEST-CA-API',
      };

      const response = await supertest(app)
        .post('/v2/aef-t5-authorized-entities')
        .send(aefT5AuthorizedEntitiesData);

      if (response.status !== 200) {
        console.log('Error response:', response.body);
      }

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('AEF-T5-Authorized-Entities staged successfully');
      expect(response.body).to.have.property('uuid');
      expect(response.body).to.have.property('cadTrustAefT5AuthorizedEntitiesId');
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.not.have.property('data');

      // Verify record was staged
      const stagingRecord = await StagingV2.findOne({
        where: { uuid: response.body.uuid },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.table).to.equal('aef_t5_authorized_entities');
      expect(stagingRecord.action).to.equal('INSERT');
      expect(stagingRecord.committed).to.be.false;

      // Verify staged data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].cad_trust_aef_t1_submission_id).to.equal(testAefT1SubmissionId);
      expect(stagedData[0].cad_trust_unit_id).to.equal(testUnitId);
      expect(stagedData[0].cad_trust_project_id).to.equal(testProjectId);
      expect(stagedData[0].cad_trust_aef_t5_authorized_entities_id).to.equal(response.body.cadTrustAefT5AuthorizedEntitiesId);
    });

    it('should reject AEF-T5-Authorized-Entities with invalid foreign key (non-existent)', async function () {
      const aefT5AuthorizedEntitiesData = {
        aefT5AuthorizedEntitiesAuthorizationDate: '2024-01-15',
        aefT5AuthorizedEntitiesName: 'Test Entity FK',
        aefT5AuthorizedEntitiesId: 'TEST-AE-FK',
        aefT5AuthorizedEntitiesCooperativeApproachId: 'TEST-CA-FK',
        cadTrustAefT1SubmissionId: '550e8400-e29b-41d4-a716-446655440999',
        cadTrustUnitId: testUnitId,
        cadTrustProjectId: testProjectId,
      };

      const response = await supertest(app)
        .post('/v2/aef-t5-authorized-entities')
        .send(aefT5AuthorizedEntitiesData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cadTrustAefT1SubmissionId');
      expect(response.body.error).to.include('does not exist');
    });

    it('should reject AEF-T5-Authorized-Entities with forbidden fields', async function () {
      const aefT5AuthorizedEntitiesData = {
        cadTrustAefT1SubmissionId: testAefT1SubmissionId,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        cadTrustAefT5AuthorizedEntitiesId: uuidv4(),
      };

      const response = await supertest(app)
        .post('/v2/aef-t5-authorized-entities')
        .send(aefT5AuthorizedEntitiesData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cannot be set via API');
    });
  });

  describe('PUT /v2/aef-t5-authorized-entities/:id (Update)', function () {
    let createdAefT5AuthorizedEntitiesId;

    before(async function () {
      const aefT5AuthorizedEntitiesData = {
        aefT5AuthorizedEntitiesAuthorizationDate: '2024-01-15',
        aefT5AuthorizedEntitiesName: 'AEF-T5 to Update',
        aefT5AuthorizedEntitiesId: 'TEST-AE-UPDATE',
        aefT5AuthorizedEntitiesCooperativeApproachId: 'TEST-CA-UPDATE',
        cadTrustAefT1SubmissionId: testAefT1SubmissionId,
        cadTrustUnitId: testUnitId,
        cadTrustProjectId: testProjectId,
      };

      const response = await supertest(app)
        .post('/v2/aef-t5-authorized-entities')
        .send(aefT5AuthorizedEntitiesData);

      createdAefT5AuthorizedEntitiesId = response.body.cadTrustAefT5AuthorizedEntitiesId;

      let stagingRecord = null;
      if (response.body.uuid) {
        stagingRecord = await StagingV2.findOne({
          where: { uuid: response.body.uuid },
        });
      }
      if (stagingRecord) {
        await stagingRecord.update({ committed: true });
        await AefT5AuthorizedEntitiesV2.create({
          cadTrustAefT5AuthorizedEntitiesId: createdAefT5AuthorizedEntitiesId,
          aefT5AuthorizedEntitiesAuthorizationDate: '2024-01-15',
          aefT5AuthorizedEntitiesName: 'AEF-T5 to Update',
          aefT5AuthorizedEntitiesId: 'TEST-AE-UPDATE',
          aefT5AuthorizedEntitiesCooperativeApproachId: 'TEST-CA-UPDATE',
          cadTrustAefT1SubmissionId: testAefT1SubmissionId,
          cadTrustUnitId: testUnitId,
          cadTrustProjectId: testProjectId,
        });
        // Clean up committed staging record to avoid pending commits errors
        await stagingRecord.destroy();
       }
    });    it('should update an AEF-T5-Authorized-Entities via API', async function () {
      const updateData = {
        aefT5AuthorizedEntitiesAuthorizationDate: '2024-12-31',
        aefT5AuthorizedEntitiesName: 'Updated Entity Name',
        aefT5AuthorizedEntitiesId: 'TEST-AE-UPDATED',
        aefT5AuthorizedEntitiesCooperativeApproachId: 'TEST-CA-UPDATE',
        cadTrustAefT1SubmissionId: testAefT1SubmissionId,
        cadTrustUnitId: testUnitId,
        cadTrustProjectId: testProjectId,
      };

      const response = await supertest(app)
        .put(`/v2/aef-t5-authorized-entities/${createdAefT5AuthorizedEntitiesId}`)
        .send(updateData);

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('AEF-T5-Authorized-Entities update staged successfully');
      expect(response.body).to.have.property('success', true);
    });
  });

  describe('DELETE /v2/aef-t5-authorized-entities/:id (Delete)', function () {
    let createdAefT5AuthorizedEntitiesId;

    before(async function () {
      const aefT5AuthorizedEntitiesData = {
        aefT5AuthorizedEntitiesAuthorizationDate: '2024-01-15',
        aefT5AuthorizedEntitiesName: 'AEF-T5 to Delete',
        aefT5AuthorizedEntitiesId: 'TEST-AE-DELETE',
        aefT5AuthorizedEntitiesCooperativeApproachId: 'TEST-CA-DELETE',
        cadTrustAefT1SubmissionId: testAefT1SubmissionId,
        cadTrustUnitId: testUnitId,
        cadTrustProjectId: testProjectId,
      };

      const response = await supertest(app)
        .post('/v2/aef-t5-authorized-entities')
        .send(aefT5AuthorizedEntitiesData);

      createdAefT5AuthorizedEntitiesId = response.body.cadTrustAefT5AuthorizedEntitiesId;

      let stagingRecord = null;
      if (response.body.uuid) {
        stagingRecord = await StagingV2.findOne({
          where: { uuid: response.body.uuid },
        });
      }
      if (stagingRecord) {
        await stagingRecord.update({ committed: true });
        await AefT5AuthorizedEntitiesV2.create({
          cadTrustAefT5AuthorizedEntitiesId: createdAefT5AuthorizedEntitiesId,
          aefT5AuthorizedEntitiesAuthorizationDate: '2024-01-15',
          aefT5AuthorizedEntitiesName: 'AEF-T5 to Delete',
          aefT5AuthorizedEntitiesId: 'TEST-AE-DELETE',
          aefT5AuthorizedEntitiesCooperativeApproachId: 'TEST-CA-DELETE',
          cadTrustAefT1SubmissionId: testAefT1SubmissionId,
          cadTrustUnitId: testUnitId,
          cadTrustProjectId: testProjectId,
        });
        // Clean up committed staging record to avoid pending commits errors
        await stagingRecord.destroy();
       }
    });it('should delete an AEF-T5-Authorized-Entities via API', async function () {
      const response = await supertest(app)
        .delete(`/v2/aef-t5-authorized-entities/${createdAefT5AuthorizedEntitiesId}`);

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('AEF-T5-Authorized-Entities delete staged successfully');
      expect(response.body).to.have.property('success', true);
    });
  });
});
