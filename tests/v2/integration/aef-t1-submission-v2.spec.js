import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { AefT1SubmissionV2, StagingV2 } from '../../../src/models/v2/index.js';
import { v4 as uuidv4 } from 'uuid';
import { createV2TestHomeOrg, getV2HomeOrgId } from '../utils/v2-test-helpers.js';

describe('AEF-T1-Submission V2 Integration Tests', function () {
  this.timeout(300000); // 5 minute timeout for comprehensive tests

  before(async function () {
    console.log('Setting up AEF-T1-Submission V2 test environment...');
    await prepareV2Db();
    await createV2TestHomeOrg();
  });

  after(async function () {
    console.log('AEF-T1-Submission V2 test cleanup completed');
  });

  describe('POST /v2/aef-t1-submission (Create)', function () {
    it('should create a new AEF-T1-Submission record via API', async function () {
      const aefT1SubmissionData = {
        aefT1SubmissionParty: 'API Test Party',
        aefT1SubmissionVersion: '1.0',
        aefT1SubmissionReportYear: 2024,
        aefT1SubmissionSubmissionDate: '2024-01-15',
        aefT1SubmissionReviewStatus: 'Under Review',
        aefT1SubmissionResultCheck: 'Passed',
        aefT1SubmissionNdcFirstYear: 2020,
        aefT1SubmissionNdcLastYear: 2030,
        aefT1SubmissionReferenceReviewReport: 'https://example.com/api-review-report',
      };

      const response = await supertest(app)
        .post('/v2/aef-t1-submission')
        .send(aefT1SubmissionData);

      if (response.status !== 200) {
        console.log('Error response:', response.body);
      }

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('AEF-T1-Submission staged successfully');
      expect(response.body).to.have.property('uuid');
      expect(response.body).to.have.property('cadTrustAefT1SubmissionId');
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.not.have.property('data');

      // Verify record was staged
      expect(response.body).to.have.property('uuid');
      const stagingRecord = await StagingV2.findOne({
        where: { uuid: response.body.uuid },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.table).to.equal('aef_t1_submission');
      expect(stagingRecord.action).to.equal('INSERT');
      expect(stagingRecord.committed).to.be.false;

      // Verify staged data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].aef_t1_submission_party).to.equal('API Test Party');
      expect(stagedData[0].aef_t1_submission_version).to.equal('1.0');
      expect(stagedData[0].aef_t1_submission_report_year).to.equal(2024);
      expect(stagedData[0].cad_trust_aef_t1_submission_id).to.equal(response.body.cadTrustAefT1SubmissionId);
      expect(stagedData[0]).to.have.property('org_uid');
      expect(stagedData[0].org_uid).to.equal('test-home-org-v2');
    });

    it('should reject AEF-T1-Submission with missing required fields', async function () {
      const invalidData = {
        aefT1SubmissionVersion: '1.0',
        // Missing aefT1SubmissionParty
      };

      const response = await supertest(app)
        .post('/v2/aef-t1-submission')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('aefT1SubmissionParty');
    });

    it('should reject AEF-T1-Submission with forbidden fields (createdAt, updatedAt, cadTrustAefT1SubmissionId)', async function () {
      const aefT1SubmissionData = {
        aefT1SubmissionParty: 'Test Party',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        cadTrustAefT1SubmissionId: uuidv4(),
      };

      const response = await supertest(app)
        .post('/v2/aef-t1-submission')
        .send(aefT1SubmissionData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cannot be set via API');
    });
  });

  describe('GET /v2/aef-t1-submission (List)', function () {
    it('should filter AEF-T1-Submissions by orgUid', async function () {
      await AefT1SubmissionV2.create({
        aefT1SubmissionParty: 'Org A Party',
        aefT1SubmissionVersion: '1.0',
        aefT1SubmissionReportYear: 2024,
        aefT1SubmissionSubmissionDate: '2024-01-15',
        orgUid: 'org-a',
      });
      await AefT1SubmissionV2.create({
        aefT1SubmissionParty: 'Org B Party',
        aefT1SubmissionVersion: '1.0',
        aefT1SubmissionReportYear: 2024,
        aefT1SubmissionSubmissionDate: '2024-01-15',
        orgUid: 'org-b',
      });

      const response = await supertest(app)
        .get('/v2/aef-t1-submission')
        .query({ page: 1, limit: 10, orgUid: 'org-a' })
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body.data).to.be.an('array');
      expect(response.body.data).to.have.length(1);
      expect(response.body.data[0].aefT1SubmissionParty).to.equal('Org A Party');
    });

    it('should filter AEF-T1-Submissions by orgUid=me', async function () {
      await AefT1SubmissionV2.create({
        aefT1SubmissionParty: 'My Party',
        aefT1SubmissionVersion: '1.0',
        aefT1SubmissionReportYear: 2024,
        aefT1SubmissionSubmissionDate: '2024-01-15',
        orgUid: 'test-home-org-v2',
      });
      await AefT1SubmissionV2.create({
        aefT1SubmissionParty: 'Other Party',
        aefT1SubmissionVersion: '1.0',
        aefT1SubmissionReportYear: 2024,
        aefT1SubmissionSubmissionDate: '2024-01-15',
        orgUid: 'other-org',
      });

      const response = await supertest(app)
        .get('/v2/aef-t1-submission')
        .query({ page: 1, limit: 10, orgUid: 'me' })
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body.data).to.be.an('array');
      expect(response.body.data.length).to.be.greaterThan(0);
      response.body.data.forEach(s => {
        expect(s.orgUid).to.equal('test-home-org-v2');
      });
    });
  });

  describe('PUT /v2/aef-t1-submission/:id (Update)', function () {
    let createdAefT1SubmissionId;

    before(async function () {
      // Clean up any existing AEF-T1 submissions for test isolation
      await AefT1SubmissionV2.destroy({ where: {} });
      await StagingV2.destroy({ where: { table: 'aef_t1_submission' } });
      const aefT1SubmissionData = {
        aefT1SubmissionParty: 'AEF-T1 to Update',
        aefT1SubmissionVersion: '1.0',
        aefT1SubmissionReportYear: 2024,
        aefT1SubmissionSubmissionDate: '2024-01-15',
      };

      const response = await supertest(app)
        .post('/v2/aef-t1-submission')
        .send(aefT1SubmissionData);

      if (response.status !== 200) {
        throw new Error(`POST request failed with status ${response.status}: ${JSON.stringify(response.body)}`);
      }

      createdAefT1SubmissionId = response.body.cadTrustAefT1SubmissionId;

      if (!createdAefT1SubmissionId) {
        throw new Error(`POST response did not include cadTrustAefT1SubmissionId. Response: ${JSON.stringify(response.body)}`);
      }

      let stagingRecord = null;
      if (response.body.uuid) {
        stagingRecord = await StagingV2.findOne({
          where: { uuid: response.body.uuid },
        });
      }
      if (stagingRecord) {
        await stagingRecord.update({ committed: true });
        const homeOrgId = await getV2HomeOrgId();
        await AefT1SubmissionV2.create({
          cadTrustAefT1SubmissionId: createdAefT1SubmissionId,
          aefT1SubmissionParty: 'AEF-T1 to Update',
          aefT1SubmissionVersion: '1.0',
          aefT1SubmissionReportYear: 2024,
          aefT1SubmissionSubmissionDate: '2024-01-15',
          orgUid: homeOrgId,
        });
        // Clean up committed staging record to avoid pending commits errors
        await stagingRecord.destroy();
      }

      // Verify record was created successfully
      const verifyRecord = await AefT1SubmissionV2.findByPk(createdAefT1SubmissionId);
      if (!verifyRecord) {
        throw new Error(`Failed to create AEF-T1-Submission record with ID: ${createdAefT1SubmissionId}`);
      }
    });

    it('should update an AEF-T1-Submission via API', async function () {
      const updateData = {
        aefT1SubmissionParty: 'Updated Party',
        aefT1SubmissionVersion: '2.0',
        aefT1SubmissionReportYear: 2025,
        aefT1SubmissionSubmissionDate: '2025-01-15',
        aefT1SubmissionReviewStatus: 'Approved',
      };

      const response = await supertest(app)
        .put(`/v2/aef-t1-submission/${createdAefT1SubmissionId}`)
        .send(updateData);

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('AEF-T1-Submission update staged successfully');
      expect(response.body).to.have.property('success', true);
    });
  });

  describe('DELETE /v2/aef-t1-submission/:id (Delete)', function () {
    let createdAefT1SubmissionId;

    before(async function () {
      // Clean up any existing AEF-T1 submissions for test isolation
      await AefT1SubmissionV2.destroy({ where: {} });
      await StagingV2.destroy({ where: { table: 'aef_t1_submission' } });
      const aefT1SubmissionData = {
        aefT1SubmissionParty: 'AEF-T1 to Delete',
        aefT1SubmissionVersion: '1.0',
        aefT1SubmissionReportYear: 2024,
        aefT1SubmissionSubmissionDate: '2024-01-15',
      };

      const response = await supertest(app)
        .post('/v2/aef-t1-submission')
        .send(aefT1SubmissionData);

      if (response.status !== 200) {
        throw new Error(`POST request failed with status ${response.status}: ${JSON.stringify(response.body)}`);
      }

      createdAefT1SubmissionId = response.body.cadTrustAefT1SubmissionId;

      if (!createdAefT1SubmissionId) {
        throw new Error(`POST response did not include cadTrustAefT1SubmissionId. Response: ${JSON.stringify(response.body)}`);
      }

      let stagingRecord = null;
      if (response.body.uuid) {
        stagingRecord = await StagingV2.findOne({
          where: { uuid: response.body.uuid },
        });
      }
      if (stagingRecord) {
        await stagingRecord.update({ committed: true });
        const homeOrgId = await getV2HomeOrgId();
        await AefT1SubmissionV2.create({
          cadTrustAefT1SubmissionId: createdAefT1SubmissionId,
          aefT1SubmissionParty: 'AEF-T1 to Delete',
          aefT1SubmissionVersion: '1.0',
          aefT1SubmissionReportYear: 2024,
          aefT1SubmissionSubmissionDate: '2024-01-15',
          orgUid: homeOrgId,
        });
        // Clean up committed staging record to avoid pending commits errors
        await stagingRecord.destroy();
      }

      // Verify record was created successfully
      const verifyRecord = await AefT1SubmissionV2.findByPk(createdAefT1SubmissionId);
      if (!verifyRecord) {
        throw new Error(`Failed to create AEF-T1-Submission record with ID: ${createdAefT1SubmissionId}`);
      }
    });

    it('should delete an AEF-T1-Submission via API', async function () {
      const response = await supertest(app)
        .delete(`/v2/aef-t1-submission/${createdAefT1SubmissionId}`);

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('AEF-T1-Submission delete staged successfully');
      expect(response.body).to.have.property('success', true);
    });
  });
});
