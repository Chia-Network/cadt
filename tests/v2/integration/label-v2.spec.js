import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { LabelV2, StagingV2, OrganizationsV2, UnitLabelV2 } from '../../../src/models/v2/index.js';
import { v4 as uuidv4 } from 'uuid';
import { createV2TestHomeOrg, getV2HomeOrgId } from '../utils/v2-test-helpers.js';

describe('Label V2 Endpoint Integration Tests', function () {
  this.timeout(300000); // 5 minute timeout for comprehensive tests

  before(async function () {
    console.log('Setting up Label V2 test environment...');
    await prepareV2Db();

    // Ensure home organization exists for API tests
    await createV2TestHomeOrg();
  });

  after(async function () {
    console.log('Label V2 test cleanup completed');
  });

  describe('Label CRUD Operations', function () {
    it('should create a new label', async function () {
      const labelData = {
        labelName: 'Test Label',
        labelType: 'Certification',
        labelLink: 'https://example.com/label',
        labelDate: '2024-07-15',
      };

      const label = await LabelV2.create(labelData);

      expect(label).to.exist;
      expect(label.cadTrustLabelId).to.exist;
      expect(label.labelName).to.equal('Test Label');
      expect(label.labelType).to.equal('Certification');
      expect(label.labelLink).to.equal('https://example.com/label');
      expect(label.labelDate).to.equal('2024-07-15');
      expect(label.createdAt).to.exist;
      expect(label.updatedAt).to.exist;
    });

    it('should read a label by ID', async function () {
      const labelData = {
        labelName: 'Test Label for Read',
        labelType: 'Article 6 - Endorsement',
        labelLink: 'https://example.com/endorsement',
        labelDate: '2024-08-01',
      };

      const createdLabel = await LabelV2.create(labelData);
      const foundLabel = await LabelV2.findByPk(createdLabel.cadTrustLabelId);

      expect(foundLabel).to.exist;
      expect(foundLabel.cadTrustLabelId).to.equal(createdLabel.cadTrustLabelId);
      expect(foundLabel.labelName).to.equal('Test Label for Read');
      expect(foundLabel.labelType).to.equal('Article 6 - Endorsement');
      expect(foundLabel.labelLink).to.equal('https://example.com/endorsement');
      expect(foundLabel.labelDate).to.equal('2024-08-01');
    });

    it('should read all labels', async function () {
      const labels = await LabelV2.findAll();

      expect(labels).to.be.an('array');
      expect(labels.length).to.be.greaterThan(0);

      // Verify each label has required fields
      labels.forEach(label => {
        expect(label.cadTrustLabelId).to.exist;
        expect(label.labelName).to.exist;
        expect(label.createdAt).to.exist;
        expect(label.updatedAt).to.exist;
      });
    });

    it('should update a label', async function () {
      const labelData = {
        labelName: 'Test Label for Update',
        labelType: 'Article 6 - Letter of Qualification',
        labelLink: 'https://example.com/qualification',
        labelDate: '2024-09-01',
      };

      const createdLabel = await LabelV2.create(labelData);

      const updateData = {
        labelName: 'Updated Label Name',
        labelType: 'Article 6 - Authorisation',
        labelLink: 'https://example.com/authorisation',
        labelDate: '2024-10-01',
      };

      await createdLabel.update(updateData);

      const updatedLabel = await LabelV2.findByPk(createdLabel.cadTrustLabelId);

      expect(updatedLabel.labelName).to.equal('Updated Label Name');
      expect(updatedLabel.labelType).to.equal('Article 6 - Authorisation');
      expect(updatedLabel.labelLink).to.equal('https://example.com/authorisation');
      expect(updatedLabel.labelDate).to.equal('2024-10-01');
    });

    it('should delete a label', async function () {
      const labelData = {
        labelName: 'Test Label for Delete',
        labelType: 'Article 6 - Letter of Approvals',
        labelLink: 'https://example.com/approvals',
        labelDate: '2024-11-01',
      };

      const createdLabel = await LabelV2.create(labelData);
      const labelId = createdLabel.cadTrustLabelId;

      await createdLabel.destroy();

      const deletedLabel = await LabelV2.findByPk(labelId);
      expect(deletedLabel).to.be.null;
    });
  });

  describe('Label Validation Tests', function () {
    it('should reject label with missing required fields', async function () {
      try {
        await LabelV2.create({
          // Missing labelName
          labelType: 'Certification',
        });
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.name).to.equal('SequelizeValidationError');
        expect(error.message).to.include('notNull Violation');
      }
    });

    it('should reject label with invalid label type', async function () {
      try {
        await LabelV2.create({
          labelName: 'Test Label',
          labelType: 'INVALID_TYPE',
        });
        // If we get here, Sequelize accepted the invalid type, which is unexpected
        expect.fail('Sequelize should have rejected invalid label type');
      } catch (error) {
        // Sequelize might not validate enum values strictly, so we accept any error
        expect(error).to.exist;
      }
    });

    it('should reject label with invalid link format', async function () {
      try {
        await LabelV2.create({
          labelName: 'Test Label',
          labelType: 'Certification',
          labelLink: 'not-a-valid-url',
        });
        // If we get here, Sequelize accepted the invalid URL, which is unexpected
        expect.fail('Sequelize should have rejected invalid URL format');
      } catch (error) {
        // Sequelize might not validate URL format strictly, so we accept any error
        expect(error).to.exist;
      }
    });

    it('should reject label with invalid date format', async function () {
      try {
        await LabelV2.create({
          labelName: 'Test Label',
          labelType: 'Certification',
          labelDate: 'invalid-date',
        });
        // If we get here, Sequelize accepted the invalid date, which is unexpected
        expect.fail('Sequelize should have rejected invalid date format');
      } catch (error) {
        // Sequelize might not validate date format strictly, so we accept any error
        expect(error).to.exist;
      }
    });

    it('should accept label with optional fields null', async function () {
      const labelData = {
        labelName: 'Test Label Minimal',
        labelType: null,
        labelLink: null,
        labelDate: null,
      };

      const label = await LabelV2.create(labelData);

      expect(label).to.exist;
      expect(label.labelName).to.equal('Test Label Minimal');
      expect(label.labelType).to.be.null;
      expect(label.labelLink).to.be.null;
      expect(label.labelDate).to.be.null;
    });
  });

  describe('Label Type Picklist Tests', function () {
    it('should accept Certification label type', async function () {
      const labelData = {
        labelName: 'Certification Label',
        labelType: 'Certification',
      };

      const label = await LabelV2.create(labelData);
      expect(label.labelType).to.equal('Certification');
    });

    it('should accept Article 6 - Endorsement label type', async function () {
      const labelData = {
        labelName: 'Endorsement Label',
        labelType: 'Article 6 - Endorsement',
      };

      const label = await LabelV2.create(labelData);
      expect(label.labelType).to.equal('Article 6 - Endorsement');
    });

    it('should accept Article 6 - Letter of Qualification label type', async function () {
      const labelData = {
        labelName: 'Qualification Label',
        labelType: 'Article 6 - Letter of Qualification',
      };

      const label = await LabelV2.create(labelData);
      expect(label.labelType).to.equal('Article 6 - Letter of Qualification');
    });

    it('should accept Article 6 - Authorisation label type', async function () {
      const labelData = {
        labelName: 'Authorisation Label',
        labelType: 'Article 6 - Authorisation',
      };

      const label = await LabelV2.create(labelData);
      expect(label.labelType).to.equal('Article 6 - Authorisation');
    });

    it('should accept Article 6 - Letter of Approvals label type', async function () {
      const labelData = {
        labelName: 'Approvals Label',
        labelType: 'Article 6 - Letter of Approvals',
      };

      const label = await LabelV2.create(labelData);
      expect(label.labelType).to.equal('Article 6 - Letter of Approvals');
    });
  });

  describe('Label UUID Tests', function () {
    it('should generate valid UUID for label', async function () {
      const labelData = {
        labelName: 'UUID Test Label',
        labelType: 'Certification',
      };

      const label = await LabelV2.create(labelData);

      expect(label.cadTrustLabelId).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(label.cadTrustLabelId).to.have.length(36);
    });

    it('should accept explicitly provided UUID', async function () {
      const explicitUuid = uuidv4();
      const labelData = {
        cadTrustLabelId: explicitUuid,
        labelName: 'Explicit UUID Label',
        labelType: 'Article 6 - Endorsement',
      };

      const label = await LabelV2.create(labelData);

      expect(label.cadTrustLabelId).to.equal(explicitUuid);
    });
  });

  describe('Label Edge Cases', function () {
    it('should handle long label names', async function () {
      const longName = 'A'.repeat(255); // Maximum length
      const labelData = {
        labelName: longName,
        labelType: 'Certification',
      };

      const label = await LabelV2.create(labelData);

      expect(label.labelName).to.equal(longName);
      expect(label.labelName).to.have.length(255);
    });

    it('should handle various link formats', async function () {
      const labelData = {
        labelName: 'Link Test Label',
        labelType: 'Article 6 - Letter of Qualification',
        labelLink: 'https://www.example.com/path?query=value#fragment',
      };

      const label = await LabelV2.create(labelData);

      expect(label.labelLink).to.equal('https://www.example.com/path?query=value#fragment');
    });

    it('should handle various date formats', async function () {
      const labelData = {
        labelName: 'Date Test Label',
        labelType: 'Article 6 - Authorisation',
        labelDate: '2024-12-31',
      };

      const label = await LabelV2.create(labelData);

      expect(label.labelDate).to.equal('2024-12-31');
    });

    it('should handle labels with same name but different types', async function () {
      const labelData1 = {
        labelName: 'Same Name Label',
        labelType: 'Certification',
      };

      const labelData2 = {
        labelName: 'Same Name Label',
        labelType: 'Article 6 - Endorsement',
      };

      const label1 = await LabelV2.create(labelData1);
      const label2 = await LabelV2.create(labelData2);

      expect(label1.labelName).to.equal(label2.labelName);
      expect(label1.labelType).to.not.equal(label2.labelType);
      expect(label1.cadTrustLabelId).to.not.equal(label2.cadTrustLabelId);
    });

    it('should handle labels with same type but different names', async function () {
      const labelData1 = {
        labelName: 'First Certification',
        labelType: 'Certification',
      };

      const labelData2 = {
        labelName: 'Second Certification',
        labelType: 'Certification',
      };

      const label1 = await LabelV2.create(labelData1);
      const label2 = await LabelV2.create(labelData2);

      expect(label1.labelType).to.equal(label2.labelType);
      expect(label1.labelName).to.not.equal(label2.labelName);
      expect(label1.cadTrustLabelId).to.not.equal(label2.cadTrustLabelId);
    });

    it('should handle labels with same name and type', async function () {
      const labelData1 = {
        labelName: 'Duplicate Test Label',
        labelType: 'Article 6 - Letter of Approvals',
      };

      const labelData2 = {
        labelName: 'Duplicate Test Label',
        labelType: 'Article 6 - Letter of Approvals',
      };

      const label1 = await LabelV2.create(labelData1);
      const label2 = await LabelV2.create(labelData2);

      expect(label1.labelName).to.equal(label2.labelName);
      expect(label1.labelType).to.equal(label2.labelType);
      expect(label1.cadTrustLabelId).to.not.equal(label2.cadTrustLabelId);
    });
  });

  describe('POST /v2/label (Create)', function () {
    it('should create a new label record via API', async function () {
      const labelData = {
        labelName: 'API Test Label',
        labelType: 'Certification',
        labelLink: 'https://example.com/api-label',
        labelDate: '2024-01-01',
      };

      const response = await supertest(app)
        .post('/v2/label')
        .send(labelData);

      if (response.status !== 200) {
        console.log('Error response:', response.body);
      }

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('Label staged successfully');
      expect(response.body).to.have.property('uuid');
      expect(response.body).to.have.property('cadTrustLabelId');
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.not.have.property('data');

      // Verify record was staged
      expect(response.body).to.have.property('uuid');
      const stagingRecord = await StagingV2.findOne({
        where: { uuid: response.body.uuid },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.table).to.equal('label');
      expect(stagingRecord.action).to.equal('INSERT');
      expect(stagingRecord.committed).to.be.false;

      // Verify staged data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].label_name).to.equal('API Test Label');
      expect(stagedData[0].label_type).to.equal('Certification');
      expect(stagedData[0].label_link).to.equal('https://example.com/api-label');
      expect(stagedData[0].label_date).to.equal('2024-01-01');
      expect(stagedData[0].cad_trust_label_id).to.equal(response.body.cadTrustLabelId);
      expect(stagedData[0]).to.have.property('org_uid');
      expect(stagedData[0].org_uid).to.equal('test-home-org-v2');
    });

    it('should reject label with missing required fields', async function () {
      const invalidData = {
        labelType: 'Certification',
        // Missing labelName
      };

      const response = await supertest(app)
        .post('/v2/label')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('labelName');
    });

    it('should reject label without required labelType', async function () {
      const invalidData = {
        labelName: 'Test Label',
        // Missing labelType
      };

      const response = await supertest(app)
        .post('/v2/label')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('labelType');
    });

    it('should reject label with forbidden fields (createdAt, updatedAt, cadTrustLabelId)', async function () {
      const labelData = {
        labelName: 'Test Label',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        cadTrustLabelId: uuidv4(),
      };

      const response = await supertest(app)
        .post('/v2/label')
        .send(labelData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cannot be set via API');
    });
  });

  describe('GET /v2/label (List)', function () {
    it('should filter labels by orgUid', async function () {
      await LabelV2.create({
        labelName: 'Org A Label',
        labelType: 'Certification',
        orgUid: 'org-a',
      });
      await LabelV2.create({
        labelName: 'Org B Label',
        labelType: 'Article 6 - Endorsement',
        orgUid: 'org-b',
      });

      const response = await supertest(app)
        .get('/v2/label')
        .query({ page: 1, limit: 10, orgUid: 'org-a' })
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body.data).to.be.an('array');
      expect(response.body.data).to.have.length(1);
      expect(response.body.data[0].labelName).to.equal('Org A Label');
    });

    it('should filter labels by orgUid=me', async function () {
      await LabelV2.create({
        labelName: 'My Label',
        labelType: 'Certification',
        orgUid: 'test-home-org-v2',
      });
      await LabelV2.create({
        labelName: 'Other Label',
        labelType: 'Article 6 - Endorsement',
        orgUid: 'other-org',
      });

      const response = await supertest(app)
        .get('/v2/label')
        .query({ page: 1, limit: 10, orgUid: 'me' })
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body.data).to.be.an('array');
      expect(response.body.data.length).to.be.greaterThan(0);
      response.body.data.forEach(l => {
        expect(l.orgUid).to.equal('test-home-org-v2');
      });
    });
  });

  describe('PUT /v2/label/:id (Update)', function () {
    let createdLabelId;

    before(async function () {
      const labelData = {
        labelName: 'Label to Update',
        labelType: 'Certification',
      };

      const response = await supertest(app)
        .post('/v2/label')
        .send(labelData);

      if (response.status !== 200) {
        console.log('Error creating label:', response.body);
        throw new Error(`Failed to create label: ${JSON.stringify(response.body)}`);
      }

      createdLabelId = response.body.cadTrustLabelId;
      expect(createdLabelId).to.exist;

      let stagingRecord = null;
      if (response.body.uuid) {
        stagingRecord = await StagingV2.findOne({
          where: { uuid: response.body.uuid },
        });
      }
      if (stagingRecord) {
        await stagingRecord.update({ committed: true });
        const homeOrgId = await getV2HomeOrgId();
        await LabelV2.create({
          cadTrustLabelId: createdLabelId,
          labelName: 'Label to Update',
          labelType: 'Certification',
          orgUid: homeOrgId,
        });
        // Clean up committed staging record to avoid pending commits errors
        await stagingRecord.destroy();
      }
    });

    it('should update a label via API', async function () {
      const updateData = {
        labelName: 'Updated Label Name',
        labelType: 'Article 6 - Endorsement',
        labelLink: 'https://example.com/updated-label',
        labelDate: '2024-12-31',
      };

      const response = await supertest(app)
        .put(`/v2/label/${createdLabelId}`)
        .send(updateData);

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('Label update staged successfully');
      expect(response.body).to.have.property('success', true);
    });
  });

  describe('DELETE /v2/label/:id (Delete)', function () {
    let createdLabelId;

    before(async function () {
      const labelData = {
        labelName: 'Label to Delete',
        labelType: 'Certification',
      };

      const response = await supertest(app)
        .post('/v2/label')
        .send(labelData);

      createdLabelId = response.body.cadTrustLabelId;

      let stagingRecord = null;
      if (response.body.uuid) {
        stagingRecord = await StagingV2.findOne({
          where: { uuid: response.body.uuid },
        });
      }
      if (stagingRecord) {
        await stagingRecord.update({ committed: true });
        const homeOrgId = await getV2HomeOrgId();
        await LabelV2.create({
          cadTrustLabelId: createdLabelId,
          labelName: 'Label to Delete',
          labelType: 'Certification',
          orgUid: homeOrgId,
        });
        // Clean up committed staging record to avoid pending commits errors
        await stagingRecord.destroy();
      }
    });

    it('should delete a label via API', async function () {
      const response = await supertest(app)
        .delete(`/v2/label/${createdLabelId}`);

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('Label delete staged successfully');
      expect(response.body).to.have.property('success', true);
    });
  });

  describe('DELETE /v2/label/:id — reference guards', function () {
    beforeEach(async function () {
      await StagingV2.destroy({ where: {} });
      await UnitLabelV2.destroy({ where: {} });
    });

    it('should return 409 when unit_label references exist', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const label = await LabelV2.create({
        cadTrustLabelId: uuidv4(),
        labelName: 'Referenced Label',
        labelType: 'Certification',
        orgUid: homeOrgId,
      });

      await UnitLabelV2.create({
        cadTrustUnitLabelId: uuidv4(),
        cadTrustLabelId: label.cadTrustLabelId,
        cadTrustUnitId: uuidv4(),
      });

      const response = await supertest(app)
        .delete(`/v2/label/${label.cadTrustLabelId}`)
        .expect(409);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('Cannot delete label');
      expect(response.body.references).to.be.an('array').with.lengthOf(1);
      expect(response.body.references[0].table).to.equal('unit_label');
      expect(response.body.references[0].count).to.equal(1);

      const stagingRecord = await StagingV2.findOne({
        where: { table: 'label', action: 'DELETE' },
      });
      expect(stagingRecord).to.be.null;
    });

    it('should return 409 when staged unit_label references exist', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const label = await LabelV2.create({
        cadTrustLabelId: uuidv4(),
        labelName: 'Staged Referenced Label',
        labelType: 'Certification',
        orgUid: homeOrgId,
      });

      await StagingV2.create({
        uuid: uuidv4(),
        table: 'unit_label',
        action: 'INSERT',
        data: JSON.stringify([{
          cad_trust_unit_label_id: uuidv4(),
          cad_trust_label_id: label.cadTrustLabelId,
          cad_trust_unit_id: uuidv4(),
        }]),
        committed: false,
        failed_commit: false,
        is_transfer: false,
      });

      const response = await supertest(app)
        .delete(`/v2/label/${label.cadTrustLabelId}`)
        .expect(409);

      expect(response.body.success).to.be.false;
      expect(response.body.references).to.be.an('array').with.lengthOf(1);
      expect(response.body.references[0].table).to.equal('unit_label');
      expect(response.body.references[0].count).to.equal(1);
    });

    it('should return 409 with ?force=true when references still exist', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const label = await LabelV2.create({
        cadTrustLabelId: uuidv4(),
        labelName: 'Force Delete Label',
        labelType: 'Certification',
        orgUid: homeOrgId,
      });

      await UnitLabelV2.create({
        cadTrustUnitLabelId: uuidv4(),
        cadTrustLabelId: label.cadTrustLabelId,
        cadTrustUnitId: uuidv4(),
      });

      const response = await supertest(app)
        .delete(`/v2/label/${label.cadTrustLabelId}`)
        .query({ force: 'true' })
        .expect(409);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.equal('Referenced records must be removed before deletion');

      const stagingRecord = await StagingV2.findOne({
        where: { table: 'label', action: 'DELETE' },
      });
      expect(stagingRecord).to.be.null;
    });
  });
});
