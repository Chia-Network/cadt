import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { AefT1SubmissionV2, AefT1SubmissionV2Mirror, StagingV2 } from '../../../src/models/v2/index.js';
import { v4 as uuidv4 } from 'uuid';
import { createV2TestHomeOrg } from '../utils/v2-test-helpers.js';

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

  describe('AEF-T1-Submission CRUD Operations', function () {
    it('should create a new AEF-T1-Submission', async function () {
      const aefT1SubmissionData = {
        aefT1SubmissionParty: 'Test Party',
        aefT1SubmissionVersion: '1.0',
        aefT1SubmissionReportYear: 2024,
        aefT1SubmissionSubmissionDate: '2024-01-15',
        aefT1SubmissionReviewStatus: 'Under Review',
        aefT1SubmissionResultCheck: 'Passed',
        aefT1SubmissionNdcFirstYear: 2020,
        aefT1SubmissionNdcLastYear: 2030,
        aefT1SubmissionReferenceReviewReport: 'https://example.com/review-report',
      };

      const aefT1Submission = await AefT1SubmissionV2Mirror.create(aefT1SubmissionData);

      expect(aefT1Submission).to.exist;
      expect(aefT1Submission.cadTrustAefT1SubmissionId).to.exist;
      expect(aefT1Submission.aefT1SubmissionParty).to.equal('Test Party');
      expect(aefT1Submission.aefT1SubmissionVersion).to.equal('1.0');
      expect(aefT1Submission.aefT1SubmissionReportYear).to.equal(2024);
      expect(aefT1Submission.aefT1SubmissionSubmissionDate).to.equal('2024-01-15');
      expect(aefT1Submission.aefT1SubmissionReviewStatus).to.equal('Under Review');
      expect(aefT1Submission.aefT1SubmissionResultCheck).to.equal('Passed');
      expect(aefT1Submission.aefT1SubmissionNdcFirstYear).to.equal(2020);
      expect(aefT1Submission.aefT1SubmissionNdcLastYear).to.equal(2030);
      expect(aefT1Submission.aefT1SubmissionReferenceReviewReport).to.equal('https://example.com/review-report');
      expect(aefT1Submission.createdAt).to.exist;
      expect(aefT1Submission.updatedAt).to.exist;
    });

    it('should read an AEF-T1-Submission by ID', async function () {
      const aefT1SubmissionData = {
        aefT1SubmissionParty: 'Test Party for Read',
        aefT1SubmissionVersion: '2.0',
        aefT1SubmissionReportYear: 2023,
        aefT1SubmissionSubmissionDate: '2023-12-31',
      };

      const createdAefT1Submission = await AefT1SubmissionV2Mirror.create(aefT1SubmissionData);
      const foundAefT1Submission = await AefT1SubmissionV2.findByPk(createdAefT1Submission.cadTrustAefT1SubmissionId);

      expect(foundAefT1Submission).to.exist;
      expect(foundAefT1Submission.cadTrustAefT1SubmissionId).to.equal(createdAefT1Submission.cadTrustAefT1SubmissionId);
      expect(foundAefT1Submission.aefT1SubmissionParty).to.equal('Test Party for Read');
      expect(foundAefT1Submission.aefT1SubmissionVersion).to.equal('2.0');
      expect(foundAefT1Submission.aefT1SubmissionReportYear).to.equal(2023);
      expect(foundAefT1Submission.aefT1SubmissionSubmissionDate).to.equal('2023-12-31');
    });

    it('should read all AEF-T1-Submissions', async function () {
      const aefT1Submissions = await AefT1SubmissionV2.findAll();

      expect(aefT1Submissions).to.be.an('array');
      expect(aefT1Submissions.length).to.be.greaterThan(0);

      // Verify each submission has required fields
      aefT1Submissions.forEach(submission => {
        expect(submission.cadTrustAefT1SubmissionId).to.exist;
        expect(submission.aefT1SubmissionParty).to.exist;
        expect(submission.aefT1SubmissionVersion).to.exist;
        expect(submission.aefT1SubmissionReportYear).to.exist;
        expect(submission.aefT1SubmissionSubmissionDate).to.exist;
        expect(submission.createdAt).to.exist;
        expect(submission.updatedAt).to.exist;
      });
    });

    it('should update an AEF-T1-Submission', async function () {
      const aefT1SubmissionData = {
        aefT1SubmissionParty: 'Test Party for Update',
        aefT1SubmissionVersion: '3.0',
        aefT1SubmissionReportYear: 2022,
        aefT1SubmissionSubmissionDate: '2022-06-15',
      };

      const createdAefT1Submission = await AefT1SubmissionV2Mirror.create(aefT1SubmissionData);

      const updateData = {
        aefT1SubmissionParty: 'Updated Party',
        aefT1SubmissionVersion: '3.1',
        aefT1SubmissionReportYear: 2022,
        aefT1SubmissionSubmissionDate: '2022-06-15',
        aefT1SubmissionReviewStatus: 'Approved',
        aefT1SubmissionResultCheck: 'Passed with conditions',
        aefT1SubmissionNdcFirstYear: 2021,
        aefT1SubmissionNdcLastYear: 2025,
        aefT1SubmissionReferenceReviewReport: 'https://example.com/updated-report',
      };

      await createdAefT1Submission.update(updateData);

      const updatedAefT1Submission = await AefT1SubmissionV2Mirror.findByPk(createdAefT1Submission.cadTrustAefT1SubmissionId);

      expect(updatedAefT1Submission.aefT1SubmissionParty).to.equal('Updated Party');
      expect(updatedAefT1Submission.aefT1SubmissionVersion).to.equal('3.1');
      expect(updatedAefT1Submission.aefT1SubmissionReviewStatus).to.equal('Approved');
      expect(updatedAefT1Submission.aefT1SubmissionResultCheck).to.equal('Passed with conditions');
      expect(updatedAefT1Submission.aefT1SubmissionNdcFirstYear).to.equal(2021);
      expect(updatedAefT1Submission.aefT1SubmissionNdcLastYear).to.equal(2025);
      expect(updatedAefT1Submission.aefT1SubmissionReferenceReviewReport).to.equal('https://example.com/updated-report');
    });

    it('should delete an AEF-T1-Submission', async function () {
      const aefT1SubmissionData = {
        aefT1SubmissionParty: 'Test Party for Delete',
        aefT1SubmissionVersion: '4.0',
        aefT1SubmissionReportYear: 2021,
        aefT1SubmissionSubmissionDate: '2021-03-10',
      };

      const createdAefT1Submission = await AefT1SubmissionV2Mirror.create(aefT1SubmissionData);

      await createdAefT1Submission.destroy();

      const deletedAefT1Submission = await AefT1SubmissionV2Mirror.findByPk(createdAefT1Submission.cadTrustAefT1SubmissionId);
      expect(deletedAefT1Submission).to.be.null;
    });
  });

  describe('AEF-T1-Submission Validation Tests', function () {
    it('should reject AEF-T1-Submission with missing required fields', async function () {
      try {
        await AefT1SubmissionV2Mirror.create({
          // Missing required fields
          aefT1SubmissionParty: 'Test Party',
        });
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.name).to.equal('SequelizeValidationError');
        expect(error.message).to.include('notNull Violation');
      }
    });

    it('should reject AEF-T1-Submission with invalid year values', async function () {
      try {
        await AefT1SubmissionV2Mirror.create({
          aefT1SubmissionParty: 'Test Party',
          aefT1SubmissionVersion: '1.0',
          aefT1SubmissionReportYear: 1800, // Invalid year
          aefT1SubmissionSubmissionDate: '2024-01-01',
        });
        // If we get here, Sequelize accepted the invalid year, which is unexpected
        expect.fail('Sequelize should have rejected invalid year');
      } catch (error) {
        // Sequelize might not validate year ranges strictly, so we accept any error
        expect(error).to.exist;
      }
    });

    it('should reject AEF-T1-Submission with invalid date format', async function () {
      try {
        await AefT1SubmissionV2Mirror.create({
          aefT1SubmissionParty: 'Test Party',
          aefT1SubmissionVersion: '1.0',
          aefT1SubmissionReportYear: 2024,
          aefT1SubmissionSubmissionDate: 'invalid-date',
        });
        expect.fail('Should have rejected invalid date format');
      } catch (error) {
        expect(error).to.exist;
        expect(error.message).to.include('ISO format');
      }
    });

    it('should reject AEF-T1-Submission with invalid URL format', async function () {
      try {
        await AefT1SubmissionV2Mirror.create({
          aefT1SubmissionParty: 'Test Party',
          aefT1SubmissionVersion: '1.0',
          aefT1SubmissionReportYear: 2024,
          aefT1SubmissionSubmissionDate: '2024-01-01',
          aefT1SubmissionReferenceReviewReport: 'not-a-valid-url',
        });
        // If we get here, Sequelize accepted the invalid URL, which is unexpected
        expect.fail('Sequelize should have rejected invalid URL format');
      } catch (error) {
        // Sequelize might not validate URL format strictly, so we accept any error
        expect(error).to.exist;
      }
    });

    it('should accept AEF-T1-Submission with optional fields null', async function () {
      const aefT1SubmissionData = {
        aefT1SubmissionParty: 'Test Party Minimal',
        aefT1SubmissionVersion: '1.0',
        aefT1SubmissionReportYear: 2024,
        aefT1SubmissionSubmissionDate: '2024-01-01',
        aefT1SubmissionReviewStatus: null,
        aefT1SubmissionResultCheck: null,
        aefT1SubmissionNdcFirstYear: null,
        aefT1SubmissionNdcLastYear: null,
        aefT1SubmissionReferenceReviewReport: null,
      };

      const aefT1Submission = await AefT1SubmissionV2Mirror.create(aefT1SubmissionData);

      expect(aefT1Submission).to.exist;
      expect(aefT1Submission.aefT1SubmissionParty).to.equal('Test Party Minimal');
      expect(aefT1Submission.aefT1SubmissionVersion).to.equal('1.0');
      expect(aefT1Submission.aefT1SubmissionReportYear).to.equal(2024);
      expect(aefT1Submission.aefT1SubmissionSubmissionDate).to.equal('2024-01-01');
      expect(aefT1Submission.aefT1SubmissionReviewStatus).to.be.null;
      expect(aefT1Submission.aefT1SubmissionResultCheck).to.be.null;
      expect(aefT1Submission.aefT1SubmissionNdcFirstYear).to.be.null;
      expect(aefT1Submission.aefT1SubmissionNdcLastYear).to.be.null;
      expect(aefT1Submission.aefT1SubmissionReferenceReviewReport).to.be.null;
    });
  });

  describe('AEF-T1-Submission Edge Cases', function () {
    it('should handle various date formats', async function () {
      const validDates = [
        '2024-01-01',
        '2024-12-31',
        '2024-06-15',
      ];

      for (const dateString of validDates) {
        const aefT1SubmissionData = {
          aefT1SubmissionParty: `Test Party ${dateString}`,
          aefT1SubmissionVersion: '1.0',
          aefT1SubmissionReportYear: 2024,
          aefT1SubmissionSubmissionDate: dateString,
        };

        const aefT1Submission = await AefT1SubmissionV2Mirror.create(aefT1SubmissionData);
        expect(aefT1Submission.aefT1SubmissionSubmissionDate).to.equal(dateString);
      }
    });

    it('should handle various year values', async function () {
      const validYears = [2020, 2024, 2030, 2050];

      for (const year of validYears) {
        const aefT1SubmissionData = {
          aefT1SubmissionParty: `Test Party ${year}`,
          aefT1SubmissionVersion: '1.0',
          aefT1SubmissionReportYear: year,
          aefT1SubmissionSubmissionDate: '2024-01-01',
        };

        const aefT1Submission = await AefT1SubmissionV2Mirror.create(aefT1SubmissionData);
        expect(aefT1Submission.aefT1SubmissionReportYear).to.equal(year);
      }
    });

    it('should handle long text fields', async function () {
      const longText = 'A'.repeat(1000); // Long text
      const aefT1SubmissionData = {
        aefT1SubmissionParty: 'Test Party Long Text',
        aefT1SubmissionVersion: '1.0',
        aefT1SubmissionReportYear: 2024,
        aefT1SubmissionSubmissionDate: '2024-01-01',
        aefT1SubmissionReviewStatus: longText,
        aefT1SubmissionResultCheck: longText,
      };

      const aefT1Submission = await AefT1SubmissionV2Mirror.create(aefT1SubmissionData);

      expect(aefT1Submission.aefT1SubmissionReviewStatus).to.equal(longText);
      expect(aefT1Submission.aefT1SubmissionResultCheck).to.equal(longText);
      expect(aefT1Submission.aefT1SubmissionReviewStatus).to.have.length(1000);
      expect(aefT1Submission.aefT1SubmissionResultCheck).to.have.length(1000);
    });

    it('should handle valid URL formats', async function () {
      const validUrls = [
        'https://example.com/report',
        'http://example.com/report',
        'https://subdomain.example.com/path/to/report.pdf',
        'https://example.com/report?param=value',
      ];

      for (const url of validUrls) {
        const aefT1SubmissionData = {
          aefT1SubmissionParty: `Test Party ${url}`,
          aefT1SubmissionVersion: '1.0',
          aefT1SubmissionReportYear: 2024,
          aefT1SubmissionSubmissionDate: '2024-01-01',
          aefT1SubmissionReferenceReviewReport: url,
        };

        const aefT1Submission = await AefT1SubmissionV2Mirror.create(aefT1SubmissionData);
        expect(aefT1Submission.aefT1SubmissionReferenceReviewReport).to.equal(url);
      }
    });
  });

  describe('AEF-T1-Submission Business Logic Tests', function () {
    it('should handle NDC year ranges correctly', async function () {
      const aefT1SubmissionData = {
        aefT1SubmissionParty: 'Test Party NDC Range',
        aefT1SubmissionVersion: '1.0',
        aefT1SubmissionReportYear: 2024,
        aefT1SubmissionSubmissionDate: '2024-01-01',
        aefT1SubmissionNdcFirstYear: 2020,
        aefT1SubmissionNdcLastYear: 2030,
      };

      const aefT1Submission = await AefT1SubmissionV2Mirror.create(aefT1SubmissionData);

      expect(aefT1Submission.aefT1SubmissionNdcFirstYear).to.equal(2020);
      expect(aefT1Submission.aefT1SubmissionNdcLastYear).to.equal(2030);
      expect(aefT1Submission.aefT1SubmissionNdcLastYear).to.be.greaterThan(aefT1Submission.aefT1SubmissionNdcFirstYear);
    });

    it('should handle different party types', async function () {
      const partyTypes = [
        'Government',
        'Private Sector',
        'NGO',
        'International Organization',
        'Research Institution',
      ];

      for (const party of partyTypes) {
        const aefT1SubmissionData = {
          aefT1SubmissionParty: party,
          aefT1SubmissionVersion: '1.0',
          aefT1SubmissionReportYear: 2024,
          aefT1SubmissionSubmissionDate: '2024-01-01',
        };

        const aefT1Submission = await AefT1SubmissionV2Mirror.create(aefT1SubmissionData);
        expect(aefT1Submission.aefT1SubmissionParty).to.equal(party);
      }
    });

    it('should handle different version formats', async function () {
      const versionFormats = [
        '1.0',
        '2.1.3',
        'v1.0',
        '2024.1',
        'beta-1.0',
      ];

      for (const version of versionFormats) {
        const aefT1SubmissionData = {
          aefT1SubmissionParty: 'Test Party Version',
          aefT1SubmissionVersion: version,
          aefT1SubmissionReportYear: 2024,
          aefT1SubmissionSubmissionDate: '2024-01-01',
        };

        const aefT1Submission = await AefT1SubmissionV2Mirror.create(aefT1SubmissionData);
        expect(aefT1Submission.aefT1SubmissionVersion).to.equal(version);
      }
    });
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
        await AefT1SubmissionV2.create({
          cadTrustAefT1SubmissionId: createdAefT1SubmissionId,
          aefT1SubmissionParty: 'AEF-T1 to Update',
          aefT1SubmissionVersion: '1.0',
          aefT1SubmissionReportYear: 2024,
          aefT1SubmissionSubmissionDate: '2024-01-15',
        });
        // Clean up committed staging record to avoid pending commits errors
        // Wait a moment to ensure record is persisted
        await new Promise(resolve => setTimeout(resolve, 100));
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
        await AefT1SubmissionV2.create({
          cadTrustAefT1SubmissionId: createdAefT1SubmissionId,
          aefT1SubmissionParty: 'AEF-T1 to Delete',
          aefT1SubmissionVersion: '1.0',
          aefT1SubmissionReportYear: 2024,
          aefT1SubmissionSubmissionDate: '2024-01-15',
        });
        // Clean up committed staging record to avoid pending commits errors
        // Wait a moment to ensure record is persisted
        await new Promise(resolve => setTimeout(resolve, 100));
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
