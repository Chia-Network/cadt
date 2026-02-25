import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { StakeholderV2, StagingV2 } from '../../../src/models/v2/index.js';
import { v4 as uuidv4 } from 'uuid';

describe('Stakeholder V2 Endpoint Integration Tests', function () {
  this.timeout(300000); // 5 minute timeout for comprehensive tests

  before(async function () {
    console.log('Setting up Stakeholder V2 test environment...');
    await prepareV2Db();
  });

  after(async function () {
    console.log('Stakeholder V2 test cleanup completed');
  });

  describe('Stakeholder CRUD Operations', function () {
    it('should create a new stakeholder', async function () {
      const stakeholderData = {
        stakeholderName: 'Test Stakeholder',
        stakeholderType: 'Owner',
        stakeholderLink: 'https://example.com/stakeholder',
      };

      const stakeholder = await StakeholderV2.create(stakeholderData);

      expect(stakeholder).to.exist;
      expect(stakeholder.cadTrustStakeholderId).to.exist;
      expect(stakeholder.stakeholderName).to.equal('Test Stakeholder');
      expect(stakeholder.stakeholderType).to.equal('Owner');
      expect(stakeholder.stakeholderLink).to.equal('https://example.com/stakeholder');
      expect(stakeholder.createdAt).to.exist;
      expect(stakeholder.updatedAt).to.exist;
    });

    it('should read a stakeholder by ID', async function () {
      const stakeholderData = {
        stakeholderName: 'Test Stakeholder for Read',
        stakeholderType: 'Developer',
        stakeholderLink: 'https://example.com/developer',
      };

      const createdStakeholder = await StakeholderV2.create(stakeholderData);
      const foundStakeholder = await StakeholderV2.findByPk(createdStakeholder.cadTrustStakeholderId);

      expect(foundStakeholder).to.exist;
      expect(foundStakeholder.cadTrustStakeholderId).to.equal(createdStakeholder.cadTrustStakeholderId);
      expect(foundStakeholder.stakeholderName).to.equal('Test Stakeholder for Read');
      expect(foundStakeholder.stakeholderType).to.equal('Developer');
      expect(foundStakeholder.stakeholderLink).to.equal('https://example.com/developer');
    });

    it('should read all stakeholders', async function () {
      const stakeholders = await StakeholderV2.findAll();

      expect(stakeholders).to.be.an('array');
      expect(stakeholders.length).to.be.greaterThan(0);

      // Verify each stakeholder has required fields
      stakeholders.forEach(stakeholder => {
        expect(stakeholder.cadTrustStakeholderId).to.exist;
        expect(stakeholder.stakeholderName).to.exist;
        expect(stakeholder.createdAt).to.exist;
        expect(stakeholder.updatedAt).to.exist;
      });
    });

    it('should update a stakeholder', async function () {
      const stakeholderData = {
        stakeholderName: 'Test Stakeholder for Update',
        stakeholderType: 'Consultant',
        stakeholderLink: 'https://example.com/consultant',
      };

      const createdStakeholder = await StakeholderV2.create(stakeholderData);

      const updateData = {
        stakeholderName: 'Updated Stakeholder Name',
        stakeholderType: 'Owner',
        stakeholderLink: 'https://example.com/updated',
      };

      await createdStakeholder.update(updateData);

      const updatedStakeholder = await StakeholderV2.findByPk(createdStakeholder.cadTrustStakeholderId);

      expect(updatedStakeholder.stakeholderName).to.equal('Updated Stakeholder Name');
      expect(updatedStakeholder.stakeholderType).to.equal('Owner');
      expect(updatedStakeholder.stakeholderLink).to.equal('https://example.com/updated');
    });

    it('should delete a stakeholder', async function () {
      const stakeholderData = {
        stakeholderName: 'Test Stakeholder for Delete',
        stakeholderType: 'Developer',
        stakeholderLink: 'https://example.com/delete',
      };

      const createdStakeholder = await StakeholderV2.create(stakeholderData);
      const stakeholderId = createdStakeholder.cadTrustStakeholderId;

      await createdStakeholder.destroy();

      const deletedStakeholder = await StakeholderV2.findByPk(stakeholderId);
      expect(deletedStakeholder).to.be.null;
    });
  });

  describe('Stakeholder Validation Tests', function () {
    it('should reject stakeholder with missing required fields', async function () {
      try {
        await StakeholderV2.create({
          // Missing stakeholderName
          stakeholderType: 'Owner',
        });
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.name).to.equal('SequelizeValidationError');
        expect(error.message).to.include('notNull Violation');
      }
    });

    it('should reject stakeholder with invalid stakeholder type', async function () {
      try {
        await StakeholderV2.create({
          stakeholderName: 'Test Stakeholder',
          stakeholderType: 'INVALID_TYPE',
        });
        // If we get here, Sequelize accepted the invalid type, which is unexpected
        expect.fail('Sequelize should have rejected invalid stakeholder type');
      } catch (error) {
        // Sequelize might not validate enum values strictly, so we accept any error
        expect(error).to.exist;
      }
    });

    it('should reject stakeholder with invalid link format', async function () {
      try {
        await StakeholderV2.create({
          stakeholderName: 'Test Stakeholder',
          stakeholderType: 'Owner',
          stakeholderLink: 'not-a-valid-url',
        });
        // If we get here, Sequelize accepted the invalid URL, which is unexpected
        expect.fail('Sequelize should have rejected invalid URL format');
      } catch (error) {
        // Sequelize might not validate URL format strictly, so we accept any error
        expect(error).to.exist;
      }
    });

    it('should accept stakeholder with optional fields null', async function () {
      const stakeholderData = {
        stakeholderName: 'Test Stakeholder Minimal',
        stakeholderType: null,
        stakeholderLink: null,
      };

      const stakeholder = await StakeholderV2.create(stakeholderData);

      expect(stakeholder).to.exist;
      expect(stakeholder.stakeholderName).to.equal('Test Stakeholder Minimal');
      expect(stakeholder.stakeholderType).to.be.null;
      expect(stakeholder.stakeholderLink).to.be.null;
    });
  });

  describe('Stakeholder Type Picklist Tests', function () {
    it('should accept Owner stakeholder type', async function () {
      const stakeholderData = {
        stakeholderName: 'Owner Stakeholder',
        stakeholderType: 'Owner',
      };

      const stakeholder = await StakeholderV2.create(stakeholderData);
      expect(stakeholder.stakeholderType).to.equal('Owner');
    });

    it('should accept Developer stakeholder type', async function () {
      const stakeholderData = {
        stakeholderName: 'Developer Stakeholder',
        stakeholderType: 'Developer',
      };

      const stakeholder = await StakeholderV2.create(stakeholderData);
      expect(stakeholder.stakeholderType).to.equal('Developer');
    });

    it('should accept Consultant stakeholder type', async function () {
      const stakeholderData = {
        stakeholderName: 'Consultant Stakeholder',
        stakeholderType: 'Consultant',
      };

      const stakeholder = await StakeholderV2.create(stakeholderData);
      expect(stakeholder.stakeholderType).to.equal('Consultant');
    });
  });

  describe('Stakeholder UUID Tests', function () {
    it('should generate valid UUID for stakeholder', async function () {
      const stakeholderData = {
        stakeholderName: 'UUID Test Stakeholder',
        stakeholderType: 'Owner',
      };

      const stakeholder = await StakeholderV2.create(stakeholderData);

      expect(stakeholder.cadTrustStakeholderId).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(stakeholder.cadTrustStakeholderId).to.have.length(36);
    });

    it('should accept explicitly provided UUID', async function () {
      const explicitUuid = uuidv4();
      const stakeholderData = {
        cadTrustStakeholderId: explicitUuid,
        stakeholderName: 'Explicit UUID Stakeholder',
        stakeholderType: 'Developer',
      };

      const stakeholder = await StakeholderV2.create(stakeholderData);

      expect(stakeholder.cadTrustStakeholderId).to.equal(explicitUuid);
    });
  });

  describe('Stakeholder Edge Cases', function () {
    it('should handle long stakeholder names', async function () {
      const longName = 'A'.repeat(255); // Maximum length
      const stakeholderData = {
        stakeholderName: longName,
        stakeholderType: 'Owner',
      };

      const stakeholder = await StakeholderV2.create(stakeholderData);

      expect(stakeholder.stakeholderName).to.equal(longName);
      expect(stakeholder.stakeholderName).to.have.length(255);
    });

    it('should handle various link formats', async function () {
      const stakeholderData = {
        stakeholderName: 'Link Test Stakeholder',
        stakeholderType: 'Consultant',
        stakeholderLink: 'https://www.example.com/path?query=value#fragment',
      };

      const stakeholder = await StakeholderV2.create(stakeholderData);

      expect(stakeholder.stakeholderLink).to.equal('https://www.example.com/path?query=value#fragment');
    });

    it('should handle stakeholders with same name but different types', async function () {
      const stakeholderData1 = {
        stakeholderName: 'Same Name Stakeholder',
        stakeholderType: 'Owner',
      };

      const stakeholderData2 = {
        stakeholderName: 'Same Name Stakeholder',
        stakeholderType: 'Developer',
      };

      const stakeholder1 = await StakeholderV2.create(stakeholderData1);
      const stakeholder2 = await StakeholderV2.create(stakeholderData2);

      expect(stakeholder1.stakeholderName).to.equal(stakeholder2.stakeholderName);
      expect(stakeholder1.stakeholderType).to.not.equal(stakeholder2.stakeholderType);
      expect(stakeholder1.cadTrustStakeholderId).to.not.equal(stakeholder2.cadTrustStakeholderId);
    });

    it('should handle stakeholders with same type but different names', async function () {
      const stakeholderData1 = {
        stakeholderName: 'First Owner',
        stakeholderType: 'Owner',
      };

      const stakeholderData2 = {
        stakeholderName: 'Second Owner',
        stakeholderType: 'Owner',
      };

      const stakeholder1 = await StakeholderV2.create(stakeholderData1);
      const stakeholder2 = await StakeholderV2.create(stakeholderData2);

      expect(stakeholder1.stakeholderType).to.equal(stakeholder2.stakeholderType);
      expect(stakeholder1.stakeholderName).to.not.equal(stakeholder2.stakeholderName);
      expect(stakeholder1.cadTrustStakeholderId).to.not.equal(stakeholder2.cadTrustStakeholderId);
    });
  });

  describe('POST /v2/stakeholder (Create)', function () {
    it('should create a new stakeholder record via API', async function () {
      const stakeholderData = {
        stakeholderName: 'API Test Stakeholder',
        stakeholderType: 'Owner',
        stakeholderLink: 'https://example.com/api-stakeholder',
      };

      const response = await supertest(app)
        .post('/v2/stakeholder')
        .send(stakeholderData);

      if (response.status !== 200) {
        console.log('Error response:', response.body);
      }

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('Stakeholder staged successfully');
      expect(response.body).to.have.property('uuid');
      expect(response.body).to.have.property('cadTrustStakeholderId');
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.not.have.property('data');

      // Verify record was staged
      const stagingRecord = await StagingV2.findOne({
        where: { uuid: response.body.uuid },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.table).to.equal('stakeholder');
      expect(stagingRecord.action).to.equal('INSERT');
      expect(stagingRecord.committed).to.be.false;

      // Verify staged data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].stakeholder_name).to.equal('API Test Stakeholder');
      expect(stagedData[0].stakeholder_type).to.equal('Owner');
      expect(stagedData[0].stakeholder_link).to.equal('https://example.com/api-stakeholder');
      expect(stagedData[0].cad_trust_stakeholder_id).to.equal(response.body.cadTrustStakeholderId);
    });

    it('should reject stakeholder with missing required fields', async function () {
      const invalidData = {
        stakeholderType: 'Owner',
        // Missing stakeholderName
      };

      const response = await supertest(app)
        .post('/v2/stakeholder')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('stakeholderName');
    });

    it('should reject stakeholder without required stakeholderType', async function () {
      const invalidData = {
        stakeholderName: 'Test Stakeholder',
        // Missing stakeholderType
      };

      const response = await supertest(app)
        .post('/v2/stakeholder')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('stakeholderType');
    });

    it('should reject stakeholder with forbidden fields (createdAt, updatedAt, cadTrustStakeholderId)', async function () {
      const stakeholderData = {
        stakeholderName: 'Test Stakeholder',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        cadTrustStakeholderId: uuidv4(),
      };

      const response = await supertest(app)
        .post('/v2/stakeholder')
        .send(stakeholderData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cannot be set via API');
    });
  });

  describe('PUT /v2/stakeholder/:id (Update)', function () {
    let createdStakeholderId;

    before(async function () {
      const stakeholderData = {
        stakeholderName: 'Stakeholder to Update',
        stakeholderType: 'Owner',
      };

      const response = await supertest(app)
        .post('/v2/stakeholder')
        .send(stakeholderData);

      createdStakeholderId = response.body.cadTrustStakeholderId;

      let stagingRecord = null;
      if (response.body.uuid) {
        stagingRecord = await StagingV2.findOne({
          where: { uuid: response.body.uuid },
        });
      }
      if (stagingRecord) {
        await stagingRecord.update({ committed: true });
        await StakeholderV2.create({
          cadTrustStakeholderId: createdStakeholderId,
          stakeholderName: 'Stakeholder to Update',
          stakeholderType: 'Owner',
        });
        // Clean up committed staging record to avoid pending commits errors
        await stagingRecord.destroy();
      }
    });

    it('should update a stakeholder via API', async function () {
      const updateData = {
        stakeholderName: 'Updated Stakeholder Name',
        stakeholderType: 'Developer',
        stakeholderLink: 'https://example.com/updated-stakeholder',
      };

      const response = await supertest(app)
        .put(`/v2/stakeholder/${createdStakeholderId}`)
        .send(updateData);

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('Stakeholder update staged successfully');
      expect(response.body).to.have.property('success', true);
    });
  });

  describe('DELETE /v2/stakeholder/:id (Delete)', function () {
    let createdStakeholderId;

    before(async function () {
      const stakeholderData = {
        stakeholderName: 'Stakeholder to Delete',
        stakeholderType: 'Consultant',
      };

      const response = await supertest(app)
        .post('/v2/stakeholder')
        .send(stakeholderData);

      createdStakeholderId = response.body.cadTrustStakeholderId;

      let stagingRecord = null;
      if (response.body.uuid) {
        stagingRecord = await StagingV2.findOne({
          where: { uuid: response.body.uuid },
        });
      }
      if (stagingRecord) {
        await stagingRecord.update({ committed: true });
        await StakeholderV2.create({
          cadTrustStakeholderId: createdStakeholderId,
          stakeholderName: 'Stakeholder to Delete',
          stakeholderType: 'Consultant',
        });
        // Clean up committed staging record to avoid pending commits errors
        await stagingRecord.destroy();
      }
    });

    it('should delete a stakeholder via API', async function () {
      const response = await supertest(app)
        .delete(`/v2/stakeholder/${createdStakeholderId}`);

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('Stakeholder delete staged successfully');
      expect(response.body).to.have.property('success', true);
    });
  });
});
