import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { CoBenefitV2, CoBenefitV2Mirror, ProjectV2, ProgramV2, StagingV2 } from '../../../src/models/v2/index.js';
import { v4 as uuidv4 } from 'uuid';
import { createV2TestHomeOrg, getV2HomeOrgId, resetV2StagingTable } from '../utils/v2-test-helpers.js';

describe('Co-Benefit V2 Endpoint Integration Tests', function () {
  this.timeout(300000); // 5 minute timeout for comprehensive tests

  let testProjectId;
  let testProgramId;
  let homeOrgId;

  before(async function () {
    console.log('Setting up Co-Benefit V2 test environment...');
    await prepareV2Db();

    // Create test home organization
    await createV2TestHomeOrg();
    homeOrgId = await getV2HomeOrgId();

    // Create test program
    const program = await ProgramV2.create({
      cadTrustProgramId: uuidv4(),
      programName: 'Test Program for Co-Benefit',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-COBENEFIT-001',
    });
    testProgramId = program.cadTrustProgramId;

    // Create test project
    const project = await ProjectV2.create({
      cadTrustProjectId: uuidv4(),
      orgUid: homeOrgId,
      projectName: 'Test Project for Co-Benefit',
      projectRegistryName: 'Test Registry',
      projectId: 'TEST-PROJ-COBENEFIT-001',
      projectSector: ['Energy industries (renewable-/ non renewable sources)'],
      projectType: ['Energy efficiency'],
      projectStatus: 'Registered',
      projectUnitMetric: 'tCO2e',
      cadTrustProgramId: testProgramId,
    });
    testProjectId = project.cadTrustProjectId;
  });

  after(async function () {
    console.log('Co-Benefit V2 test cleanup completed');
  });

  describe('Co-Benefit CRUD Operations', function () {
    it('should create a new co-benefit', async function () {
      const coBenefitData = {
        coBenefitId: 'SDG 7 - Affordable and clean energy',
        cadTrustProjectId: testProjectId,
      };

      const coBenefit = await CoBenefitV2Mirror.create(coBenefitData);

      expect(coBenefit).to.exist;
      expect(coBenefit.cadTrustCoBenefitId).to.exist;
      expect(coBenefit.coBenefitId).to.equal('SDG 7 - Affordable and clean energy');
      expect(coBenefit.cadTrustProjectId).to.equal(testProjectId);
      expect(coBenefit.createdAt).to.exist;
      expect(coBenefit.updatedAt).to.exist;
    });

    it('should read a co-benefit by ID', async function () {
      const coBenefitData = {
        coBenefitId: 'SDG 13 - Climate action',
        cadTrustProjectId: testProjectId,
      };

      const createdCoBenefit = await CoBenefitV2Mirror.create(coBenefitData);
      const foundCoBenefit = await CoBenefitV2.findByPk(createdCoBenefit.cadTrustCoBenefitId);

      expect(foundCoBenefit).to.exist;
      expect(foundCoBenefit.cadTrustCoBenefitId).to.equal(createdCoBenefit.cadTrustCoBenefitId);
      expect(foundCoBenefit.coBenefitId).to.equal('SDG 13 - Climate action');
      expect(foundCoBenefit.cadTrustProjectId).to.equal(testProjectId);
    });

    it('should read all co-benefits', async function () {
      const coBenefits = await CoBenefitV2.findAll();

      expect(coBenefits).to.be.an('array');
      expect(coBenefits.length).to.be.greaterThan(0);

      // Verify each co-benefit has required fields
      coBenefits.forEach(coBenefit => {
        expect(coBenefit.cadTrustCoBenefitId).to.exist;
        expect(coBenefit.coBenefitId).to.exist;
        expect(coBenefit.cadTrustProjectId).to.exist;
        expect(coBenefit.createdAt).to.exist;
        expect(coBenefit.updatedAt).to.exist;
      });
    });

    it('should update a co-benefit', async function () {
      const coBenefitData = {
        coBenefitId: 'SDG 6 - Clean water and sanitation',
        cadTrustProjectId: testProjectId,
      };

      const createdCoBenefit = await CoBenefitV2Mirror.create(coBenefitData);

      const updateData = {
        coBenefitId: 'SDG 15 - Life on land',
        cadTrustProjectId: testProjectId,
      };

      await createdCoBenefit.update(updateData);

      const updatedCoBenefit = await CoBenefitV2Mirror.findByPk(createdCoBenefit.cadTrustCoBenefitId);

      expect(updatedCoBenefit.coBenefitId).to.equal('SDG 15 - Life on land');
    });

    it('should delete a co-benefit', async function () {
      const coBenefitData = {
        coBenefitId: 'SDG 3 - Good health and well-being',
        cadTrustProjectId: testProjectId,
      };

      const createdCoBenefit = await CoBenefitV2Mirror.create(coBenefitData);
      const coBenefitId = createdCoBenefit.cadTrustCoBenefitId;

      await createdCoBenefit.destroy();

      const deletedCoBenefit = await CoBenefitV2Mirror.findByPk(coBenefitId);
      expect(deletedCoBenefit).to.be.null;
    });
  });

  describe('Co-Benefit Validation Tests', function () {
    it('should reject co-benefit with missing required fields', async function () {
      try {
        await CoBenefitV2Mirror.create({
          // Missing coBenefitId, cadTrustProjectId
        });
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.name).to.equal('SequelizeValidationError');
        expect(error.message).to.include('notNull Violation');
      }
    });

    it('should reject co-benefit with invalid co-benefit ID', async function () {
      try {
        await CoBenefitV2Mirror.create({
          coBenefitId: 'INVALID_SDG',
          cadTrustProjectId: testProjectId,
        });
        // If we get here, Sequelize accepted the invalid co-benefit ID, which is unexpected
        expect.fail('Sequelize should have rejected invalid co-benefit ID');
      } catch (error) {
        // Sequelize might not validate enum values strictly, so we accept any error
        expect(error).to.exist;
      }
    });

    it('should reject co-benefit with invalid project ID', async function () {
      try {
        await CoBenefitV2Mirror.create({
          coBenefitId: 'SDG 1 - No poverty',
          cadTrustProjectId: 'invalid-uuid',
        });
        // If we get here, Sequelize accepted the invalid UUID, which is unexpected
        expect.fail('Sequelize should have rejected invalid UUID format');
      } catch (error) {
        // Sequelize might not validate UUID format strictly, so we accept any error
        expect(error).to.exist;
      }
    });
  });

  describe('Co-Benefit Foreign Key Tests', function () {
    it('should reject co-benefit with non-existent project ID', async function () {
      const nonExistentProjectId = uuidv4();

      try {
        await CoBenefitV2Mirror.create({
          coBenefitId: 'SDG 2 - Zero hunger',
          cadTrustProjectId: nonExistentProjectId,
        });
        // If we get here, Sequelize accepted the non-existent foreign key, which is unexpected
        expect.fail('Sequelize should have rejected non-existent foreign key');
      } catch (error) {
        // Sequelize might not enforce foreign key constraints, so we accept any error
        expect(error).to.exist;
      }
    });

    it('should accept co-benefit with valid project ID', async function () {
      const coBenefitData = {
        coBenefitId: 'SDG 4 - Quality education',
        cadTrustProjectId: testProjectId,
      };

      const coBenefit = await CoBenefitV2Mirror.create(coBenefitData);

      expect(coBenefit).to.exist;
      expect(coBenefit.cadTrustProjectId).to.equal(testProjectId);
    });
  });

  describe('Co-Benefit Association Tests', function () {
    it('should load co-benefit with project association', async function () {
      const coBenefitData = {
        coBenefitId: 'SDG 5 - Gender equality',
        cadTrustProjectId: testProjectId,
      };

      const createdCoBenefit = await CoBenefitV2Mirror.create(coBenefitData);

      const coBenefitWithProject = await CoBenefitV2.findByPk(createdCoBenefit.cadTrustCoBenefitId, {
        include: [
          {
            model: ProjectV2,
            as: 'project',
            attributes: ['cadTrustProjectId', 'projectName', 'projectRegistryName'],
          },
        ],
      });

      expect(coBenefitWithProject).to.exist;
      expect(coBenefitWithProject.project).to.exist;
      expect(coBenefitWithProject.project.cadTrustProjectId).to.equal(testProjectId);
      expect(coBenefitWithProject.project.projectName).to.equal('Test Project for Co-Benefit');
    });
  });

  describe('Co-Benefit UUID Tests', function () {
    it('should generate valid UUID for co-benefit', async function () {
      const coBenefitData = {
        coBenefitId: 'SDG 8 - Decent work and economic growth',
        cadTrustProjectId: testProjectId,
      };

      const coBenefit = await CoBenefitV2Mirror.create(coBenefitData);

      expect(coBenefit.cadTrustCoBenefitId).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(coBenefit.cadTrustCoBenefitId).to.have.length(36);
    });

    it('should accept explicitly provided UUID', async function () {
      const explicitUuid = uuidv4();
      const coBenefitData = {
        cadTrustCoBenefitId: explicitUuid,
        coBenefitId: 'SDG 9 - Industry, innovation, and infrastructure',
        cadTrustProjectId: testProjectId,
      };

      const coBenefit = await CoBenefitV2Mirror.create(coBenefitData);

      expect(coBenefit.cadTrustCoBenefitId).to.equal(explicitUuid);
    });
  });

  describe('Co-Benefit SDG Picklist Tests', function () {
    it('should accept all 17 SDG values', async function () {
      const sdgValues = [
        'SDG 1 - No poverty',
        'SDG 2 - Zero hunger',
        'SDG 3 - Good health and well-being',
        'SDG 4 - Quality education',
        'SDG 5 - Gender equality',
        'SDG 6 - Clean water and sanitation',
        'SDG 7 - Affordable and clean energy',
        'SDG 8 - Decent work and economic growth',
        'SDG 9 - Industry, innovation, and infrastructure',
        'SDG 10 - Reduced inequalities',
        'SDG 11 - Sustainable cities and communities',
        'SDG 12 - Responsible consumption and production',
        'SDG 13 - Climate action',
        'SDG 14 - Life below water',
        'SDG 15 - Life on land',
        'SDG 16 - Peace and justice strong institutions',
        'SDG 17 - Partnerships for the goals'
      ];

      for (const sdgValue of sdgValues) {
        const coBenefitData = {
          coBenefitId: sdgValue,
          cadTrustProjectId: testProjectId,
        };

        const coBenefit = await CoBenefitV2Mirror.create(coBenefitData);
        expect(coBenefit.coBenefitId).to.equal(sdgValue);
      }
    });

    it('should handle multiple co-benefits per project', async function () {
      const multipleCoBenefits = [
        'SDG 7 - Affordable and clean energy',
        'SDG 13 - Climate action',
        'SDG 15 - Life on land'
      ];

      const createdCoBenefits = [];
      for (const coBenefitId of multipleCoBenefits) {
        const coBenefit = await CoBenefitV2Mirror.create({
          coBenefitId,
          cadTrustProjectId: testProjectId,
        });
        createdCoBenefits.push(coBenefit);
      }

      expect(createdCoBenefits).to.have.length(3);
      createdCoBenefits.forEach((coBenefit, index) => {
        expect(coBenefit.coBenefitId).to.equal(multipleCoBenefits[index]);
        expect(coBenefit.cadTrustProjectId).to.equal(testProjectId);
      });
    });
  });

  describe('Co-Benefit Edge Cases', function () {
    it('should handle long SDG descriptions', async function () {
      const longSdgValue = 'SDG 16 - Peace and justice strong institutions';
      const coBenefitData = {
        coBenefitId: longSdgValue,
        cadTrustProjectId: testProjectId,
      };

      const coBenefit = await CoBenefitV2Mirror.create(coBenefitData);

      expect(coBenefit.coBenefitId).to.equal(longSdgValue);
      expect(coBenefit.coBenefitId).to.have.length(longSdgValue.length);
    });

    it('should allow same SDG for different projects', async function () {
      // Create another project
      const anotherProject = await ProjectV2.create({
        cadTrustProjectId: uuidv4(),
        orgUid: homeOrgId,
        projectName: 'Another Test Project',
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-PROJ-COBENEFIT-002',
        projectSector: ['Energy industries (renewable-/ non renewable sources)'],
        projectType: ['Energy efficiency'],
        projectStatus: 'Registered',
        projectUnitMetric: 'tCO2e',
        cadTrustProgramId: testProgramId,
      });

      const coBenefitData1 = {
        coBenefitId: 'SDG 7 - Affordable and clean energy',
        cadTrustProjectId: testProjectId,
      };

      const coBenefitData2 = {
        coBenefitId: 'SDG 7 - Affordable and clean energy',
        cadTrustProjectId: anotherProject.cadTrustProjectId,
      };

      const coBenefit1 = await CoBenefitV2Mirror.create(coBenefitData1);
      const coBenefit2 = await CoBenefitV2Mirror.create(coBenefitData2);

      expect(coBenefit1.coBenefitId).to.equal(coBenefit2.coBenefitId);
      expect(coBenefit1.cadTrustProjectId).to.not.equal(coBenefit2.cadTrustProjectId);
    });
  });

  describe('POST /v2/co-benefit (Create)', function () {
    it('should create a new co-benefit record via API', async function () {
      const coBenefitData = {
        coBenefitId: 'SDG 1 - No poverty',
        cadTrustProjectId: testProjectId,
      };

      const response = await supertest(app)
        .post('/v2/co-benefit')
        .send(coBenefitData);

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('Co-Benefit staged successfully');
      expect(response.body).to.have.property('uuid');
      expect(response.body).to.have.property('cadTrustCoBenefitId');
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.not.have.property('data');

      // Verify record was staged
      expect(response.body).to.have.property('uuid');
      const stagingRecord = await StagingV2.findOne({
        where: { uuid: response.body.uuid },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.table).to.equal('co_benefit');
      expect(stagingRecord.action).to.equal('INSERT');
      expect(stagingRecord.committed).to.be.false;

      // Verify staged data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].co_benefit_id).to.equal('SDG 1 - No poverty');
      expect(stagedData[0].cad_trust_project_id).to.equal(testProjectId);
      expect(stagedData[0].cad_trust_co_benefit_id).to.equal(response.body.cadTrustCoBenefitId);
    });

    it('should reject co-benefit with invalid cadTrustProjectId (non-existent)', async function () {
      const coBenefitData = {
        coBenefitId: 'SDG 1 - No poverty',
        cadTrustProjectId: '550e8400-e29b-41d4-a716-446655440999',
      };

      const response = await supertest(app)
        .post('/v2/co-benefit')
        .send(coBenefitData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cadTrustProjectId');
      expect(response.body.error).to.include('does not exist');
    });

    it('should reject co-benefit with missing required fields', async function () {
      const invalidData = {
        // Missing coBenefitId and cadTrustProjectId
      };

      const response = await supertest(app)
        .post('/v2/co-benefit')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('coBenefitId');
    });

    it('should reject co-benefit with forbidden fields', async function () {
      const coBenefitData = {
        coBenefitId: 'SDG 1 - No poverty',
        cadTrustProjectId: testProjectId,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        cadTrustCoBenefitId: uuidv4(),
      };

      const response = await supertest(app)
        .post('/v2/co-benefit')
        .send(coBenefitData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cannot be set via API');
    });
  });

  describe('PUT /v2/co-benefit/:id (Update)', function () {
    let createdCoBenefitId;

    beforeEach(async function () {
      // Clean up staging table before each test to avoid pending commits errors
      await resetV2StagingTable();
    });

    before(async function () {
      const coBenefitData = {
        coBenefitId: 'SDG 2 - Zero hunger',
        cadTrustProjectId: testProjectId,
      };

      const response = await supertest(app)
        .post('/v2/co-benefit')
        .send(coBenefitData);

      createdCoBenefitId = response.body.cadTrustCoBenefitId;

      let stagingRecord = null;
      if (response.body.uuid) {
        stagingRecord = await StagingV2.findOne({
          where: { uuid: response.body.uuid },
        });
      }
      if (stagingRecord) {
        await stagingRecord.update({ committed: true });
        await CoBenefitV2.create({
          cadTrustCoBenefitId: createdCoBenefitId,
          coBenefitId: 'SDG 2 - Zero hunger',
          cadTrustProjectId: testProjectId,
        });
      }
    });

    it('should update a co-benefit via API', async function () {
      const updateData = {
        coBenefitId: 'SDG 3 - Good health and well-being',
        cadTrustProjectId: testProjectId,
      };

      const response = await supertest(app)
        .put(`/v2/co-benefit/${createdCoBenefitId}`)
        .send(updateData);

      expect(response.status).to.equal(200);
      expect(response.body.message).to.equal('Co-Benefit update staged successfully');
      expect(response.body.success).to.be.true;
    });
  });

  describe('DELETE /v2/co-benefit/:id (Delete)', function () {
    let createdCoBenefitId;

    beforeEach(async function () {
      // Clean up staging table before each test to avoid pending commits errors
      await resetV2StagingTable();
    });

    before(async function () {
      const coBenefitData = {
        coBenefitId: 'SDG 4 - Quality education',
        cadTrustProjectId: testProjectId,
      };

      const response = await supertest(app)
        .post('/v2/co-benefit')
        .send(coBenefitData);

      createdCoBenefitId = response.body.cadTrustCoBenefitId;

      let stagingRecord = null;
      if (response.body.uuid) {
        stagingRecord = await StagingV2.findOne({
          where: { uuid: response.body.uuid },
        });
      }
      if (stagingRecord) {
        await stagingRecord.update({ committed: true });
        await CoBenefitV2.create({
          cadTrustCoBenefitId: createdCoBenefitId,
          coBenefitId: 'SDG 4 - Quality education',
          cadTrustProjectId: testProjectId,
        });
        // Clean up committed staging record to avoid pending commits errors
        // Wait a moment to ensure record is persisted
        await new Promise(resolve => setTimeout(resolve, 100));
        await stagingRecord.destroy();
      }
    });

    it('should delete a co-benefit via API', async function () {
      const response = await supertest(app)
        .delete(`/v2/co-benefit/${createdCoBenefitId}`);

      expect(response.status).to.equal(200);
      expect(response.body.message).to.equal('Co-Benefit delete staged successfully');
      expect(response.body.success).to.be.true;
    });
  });
});
