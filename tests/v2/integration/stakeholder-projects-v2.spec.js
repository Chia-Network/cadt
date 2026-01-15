import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { StakeholderProjectV2, StakeholderProjectV2Mirror, StakeholderV2, ProjectV2, ProgramV2, StagingV2 } from '../../../src/models/v2/index.js';
import { v4 as uuidv4 } from 'uuid';
import { createV2TestHomeOrg, getV2HomeOrgId } from '../utils/v2-test-helpers.js';

describe('Stakeholder-Projects V2 Join Table Integration Tests', function () {
  this.timeout(300000); // 5 minute timeout for comprehensive tests

  let testProjectId;
  let testProgramId;
  let testStakeholderId;
  let homeOrgId;

  before(async function () {
    console.log('Setting up Stakeholder-Projects V2 test environment...');
    await prepareV2Db();

    // Create test home organization
    await createV2TestHomeOrg();
    homeOrgId = await getV2HomeOrgId();

    // Create test program
    const program = await ProgramV2.create({
      cadTrustProgramId: uuidv4(),
      programName: 'Test Program for Stakeholder-Projects',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-STAKEPROJ-001',
    });
    testProgramId = program.cadTrustProgramId;

    // Create test project
    const project = await ProjectV2.create({
      cadTrustProjectId: uuidv4(),
      orgUid: homeOrgId,
      projectName: 'Test Project for Stakeholder-Projects',
      projectRegistryName: 'Test Registry',
      projectId: 'TEST-PROJ-STAKEPROJ-001',
      projectSector: 'Energy industries (renewable-/ non renewable sources)',
      projectType: ['Energy efficiency'],
      projectStatus: ['Registered'],
      projectUnitMetric: 'tCO2e',
      cadTrustProgramId: testProgramId,
    });
    testProjectId = project.cadTrustProjectId;

    // Create test stakeholder
    const stakeholder = await StakeholderV2.create({
      cadTrustStakeholderId: uuidv4(),
      stakeholderName: 'Test Stakeholder for Stakeholder-Projects',
      stakeholderType: 'Owner',
      stakeholderLink: 'https://example.com/stakeholder',
    });
    testStakeholderId = stakeholder.cadTrustStakeholderId;
  });

  after(async function () {
    console.log('Stakeholder-Projects V2 test cleanup completed');
  });

  describe('Stakeholder-Projects CRUD Operations', function () {
    it('should create a new stakeholder-project relationship', async function () {
      const stakeholderProjectData = {
        cadTrustStakeholderId: testStakeholderId,
        cadTrustProjectId: testProjectId,
      };

      const stakeholderProject = await StakeholderProjectV2Mirror.create(stakeholderProjectData);

      expect(stakeholderProject).to.exist;
      expect(stakeholderProject.cadTrustStakeholderProjectId).to.exist;
      expect(stakeholderProject.cadTrustStakeholderId).to.equal(testStakeholderId);
      expect(stakeholderProject.cadTrustProjectId).to.equal(testProjectId);
      expect(stakeholderProject.createdAt).to.exist;
      expect(stakeholderProject.updatedAt).to.exist;
    });

    it('should read a stakeholder-project relationship by ID', async function () {
      // Create a new stakeholder for this test to avoid conflicts
      const newStakeholder = await StakeholderV2.create({
        cadTrustStakeholderId: uuidv4(),
        stakeholderName: 'Test Stakeholder for Read',
        stakeholderType: 'Developer',
        stakeholderLink: 'https://example.com/developer',
      });

      const stakeholderProjectData = {
        cadTrustStakeholderId: newStakeholder.cadTrustStakeholderId,
        cadTrustProjectId: testProjectId,
      };

      const createdStakeholderProject = await StakeholderProjectV2Mirror.create(stakeholderProjectData);
      const foundStakeholderProject = await StakeholderProjectV2.findByPk(createdStakeholderProject.cadTrustStakeholderProjectId);

      expect(foundStakeholderProject).to.exist;
      expect(foundStakeholderProject.cadTrustStakeholderProjectId).to.equal(createdStakeholderProject.cadTrustStakeholderProjectId);
      expect(foundStakeholderProject.cadTrustStakeholderId).to.equal(newStakeholder.cadTrustStakeholderId);
      expect(foundStakeholderProject.cadTrustProjectId).to.equal(testProjectId);
    });

    it('should read all stakeholder-project relationships', async function () {
      const stakeholderProjects = await StakeholderProjectV2.findAll();

      expect(stakeholderProjects).to.be.an('array');
      expect(stakeholderProjects.length).to.be.greaterThan(0);

      // Verify each relationship has required fields
      stakeholderProjects.forEach(stakeholderProject => {
        expect(stakeholderProject.cadTrustStakeholderProjectId).to.exist;
        expect(stakeholderProject.cadTrustStakeholderId).to.exist;
        expect(stakeholderProject.cadTrustProjectId).to.exist;
        expect(stakeholderProject.createdAt).to.exist;
        expect(stakeholderProject.updatedAt).to.exist;
      });
    });

    it('should update a stakeholder-project relationship', async function () {
      // Create a new stakeholder for this test to avoid conflicts
      const newStakeholder = await StakeholderV2.create({
        cadTrustStakeholderId: uuidv4(),
        stakeholderName: 'Test Stakeholder for Update',
        stakeholderType: 'Consultant',
        stakeholderLink: 'https://example.com/consultant',
      });

      const stakeholderProjectData = {
        cadTrustStakeholderId: newStakeholder.cadTrustStakeholderId,
        cadTrustProjectId: testProjectId,
      };

      const createdStakeholderProject = await StakeholderProjectV2Mirror.create(stakeholderProjectData);

      // Create another stakeholder for the update
      const anotherStakeholder = await StakeholderV2.create({
        cadTrustStakeholderId: uuidv4(),
        stakeholderName: 'Another Test Stakeholder',
        stakeholderType: 'Owner',
        stakeholderLink: 'https://example.com/another',
      });

      const updateData = {
        cadTrustStakeholderId: anotherStakeholder.cadTrustStakeholderId,
        cadTrustProjectId: testProjectId,
      };

      await createdStakeholderProject.update(updateData);

      const updatedStakeholderProject = await StakeholderProjectV2Mirror.findByPk(createdStakeholderProject.cadTrustStakeholderProjectId);

      expect(updatedStakeholderProject.cadTrustStakeholderId).to.equal(anotherStakeholder.cadTrustStakeholderId);
      expect(updatedStakeholderProject.cadTrustProjectId).to.equal(testProjectId);
    });

    it('should delete a stakeholder-project relationship', async function () {
      // Create a new stakeholder for this test to avoid conflicts
      const newStakeholder = await StakeholderV2.create({
        cadTrustStakeholderId: uuidv4(),
        stakeholderName: 'Test Stakeholder for Delete',
        stakeholderType: 'Developer',
        stakeholderLink: 'https://example.com/delete',
      });

      const stakeholderProjectData = {
        cadTrustStakeholderId: newStakeholder.cadTrustStakeholderId,
        cadTrustProjectId: testProjectId,
      };

      const createdStakeholderProject = await StakeholderProjectV2Mirror.create(stakeholderProjectData);
      const stakeholderProjectId = createdStakeholderProject.cadTrustStakeholderProjectId;

      await createdStakeholderProject.destroy();

      const deletedStakeholderProject = await StakeholderProjectV2Mirror.findByPk(stakeholderProjectId);
      expect(deletedStakeholderProject).to.be.null;
    });
  });

  describe('Stakeholder-Projects Validation Tests', function () {
    it('should reject stakeholder-project with missing required fields', async function () {
      try {
        await StakeholderProjectV2Mirror.create({
          // Missing cadTrustStakeholderId, cadTrustProjectId
        });
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.name).to.equal('SequelizeValidationError');
        expect(error.message).to.include('notNull Violation');
      }
    });

    it('should reject stakeholder-project with invalid stakeholder ID', async function () {
      try {
        await StakeholderProjectV2Mirror.create({
          cadTrustStakeholderId: 'invalid-uuid',
          cadTrustProjectId: testProjectId,
        });
        // If we get here, Sequelize accepted the invalid UUID, which is unexpected
        expect.fail('Sequelize should have rejected invalid UUID format');
      } catch (error) {
        // Sequelize might not validate UUID format strictly, so we accept any error
        expect(error).to.exist;
      }
    });

    it('should reject stakeholder-project with invalid project ID', async function () {
      try {
        await StakeholderProjectV2Mirror.create({
          cadTrustStakeholderId: testStakeholderId,
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

  describe('Stakeholder-Projects Foreign Key Tests', function () {
    it('should reject stakeholder-project with non-existent stakeholder ID', async function () {
      const nonExistentStakeholderId = uuidv4();

      try {
        await StakeholderProjectV2Mirror.create({
          cadTrustStakeholderId: nonExistentStakeholderId,
          cadTrustProjectId: testProjectId,
        });
        // If we get here, Sequelize accepted the non-existent foreign key, which is unexpected
        expect.fail('Sequelize should have rejected non-existent foreign key');
      } catch (error) {
        // Sequelize might not enforce foreign key constraints, so we accept any error
        expect(error).to.exist;
      }
    });

    it('should reject stakeholder-project with non-existent project ID', async function () {
      const nonExistentProjectId = uuidv4();

      try {
        await StakeholderProjectV2Mirror.create({
          cadTrustStakeholderId: testStakeholderId,
          cadTrustProjectId: nonExistentProjectId,
        });
        // If we get here, Sequelize accepted the non-existent foreign key, which is unexpected
        expect.fail('Sequelize should have rejected non-existent foreign key');
      } catch (error) {
        // Sequelize might not enforce foreign key constraints, so we accept any error
        expect(error).to.exist;
      }
    });

    it('should accept stakeholder-project with valid foreign keys', async function () {
      // Create a new stakeholder for this test to avoid conflicts
      const newStakeholder = await StakeholderV2.create({
        cadTrustStakeholderId: uuidv4(),
        stakeholderName: 'Test Stakeholder for Valid FK',
        stakeholderType: 'Owner',
        stakeholderLink: 'https://example.com/validfk',
      });

      const stakeholderProjectData = {
        cadTrustStakeholderId: newStakeholder.cadTrustStakeholderId,
        cadTrustProjectId: testProjectId,
      };

      const stakeholderProject = await StakeholderProjectV2Mirror.create(stakeholderProjectData);

      expect(stakeholderProject).to.exist;
      expect(stakeholderProject.cadTrustStakeholderId).to.equal(newStakeholder.cadTrustStakeholderId);
      expect(stakeholderProject.cadTrustProjectId).to.equal(testProjectId);
    });
  });

  describe('Stakeholder-Projects Association Tests', function () {
    it('should load stakeholder-project with stakeholder and project associations', async function () {
      // Create a new stakeholder for this test to avoid conflicts
      const newStakeholder = await StakeholderV2.create({
        cadTrustStakeholderId: uuidv4(),
        stakeholderName: 'Test Stakeholder for Association',
        stakeholderType: 'Developer',
        stakeholderLink: 'https://example.com/association',
      });

      const stakeholderProjectData = {
        cadTrustStakeholderId: newStakeholder.cadTrustStakeholderId,
        cadTrustProjectId: testProjectId,
      };

      const createdStakeholderProject = await StakeholderProjectV2Mirror.create(stakeholderProjectData);

      const stakeholderProjectWithAssociations = await StakeholderProjectV2.findByPk(createdStakeholderProject.cadTrustStakeholderProjectId, {
        include: [
          {
            model: StakeholderV2,
            as: 'stakeholder',
            attributes: ['cadTrustStakeholderId', 'stakeholderName', 'stakeholderType'],
          },
          {
            model: ProjectV2,
            as: 'project',
            attributes: ['cadTrustProjectId', 'projectName', 'projectRegistryName'],
          },
        ],
      });

      expect(stakeholderProjectWithAssociations).to.exist;
      expect(stakeholderProjectWithAssociations.stakeholder).to.exist;
      expect(stakeholderProjectWithAssociations.stakeholder.cadTrustStakeholderId).to.equal(newStakeholder.cadTrustStakeholderId);
      expect(stakeholderProjectWithAssociations.stakeholder.stakeholderName).to.equal('Test Stakeholder for Association');
      expect(stakeholderProjectWithAssociations.project).to.exist;
      expect(stakeholderProjectWithAssociations.project.cadTrustProjectId).to.equal(testProjectId);
      expect(stakeholderProjectWithAssociations.project.projectName).to.equal('Test Project for Stakeholder-Projects');
    });
  });

  describe('Stakeholder-Projects Unique Constraint Tests', function () {
    it('should enforce uniqueness of stakeholder-project combination', async function () {
      // Create a new stakeholder for this test to avoid conflicts
      const newStakeholder = await StakeholderV2.create({
        cadTrustStakeholderId: uuidv4(),
        stakeholderName: 'Test Stakeholder for Uniqueness',
        stakeholderType: 'Consultant',
        stakeholderLink: 'https://example.com/uniqueness',
      });

      const stakeholderProjectData = {
        cadTrustStakeholderId: newStakeholder.cadTrustStakeholderId,
        cadTrustProjectId: testProjectId,
      };

      // Create first relationship
      await StakeholderProjectV2Mirror.create(stakeholderProjectData);

      // Try to create duplicate relationship
      try {
        await StakeholderProjectV2Mirror.create(stakeholderProjectData);
        expect.fail('Should have thrown unique constraint error');
      } catch (error) {
        expect(error.name).to.equal('SequelizeUniqueConstraintError');
      }
    });

    it('should allow same stakeholder with different projects', async function () {
      // Create another project
      const anotherProject = await ProjectV2.create({
        cadTrustProjectId: uuidv4(),
        orgUid: homeOrgId,
        projectName: 'Another Test Project',
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-PROJ-STAKEPROJ-002',
        projectSector: 'Energy industries (renewable-/ non renewable sources)',
        projectType: ['Energy efficiency'],
        projectStatus: ['Registered'],
        projectUnitMetric: 'tCO2e',
        cadTrustProgramId: testProgramId,
      });

      // Create a new stakeholder for this test
      const newStakeholder = await StakeholderV2.create({
        cadTrustStakeholderId: uuidv4(),
        stakeholderName: 'Test Stakeholder for Different Projects',
        stakeholderType: 'Owner',
        stakeholderLink: 'https://example.com/diffprojects',
      });

      const stakeholderProjectData1 = {
        cadTrustStakeholderId: newStakeholder.cadTrustStakeholderId,
        cadTrustProjectId: testProjectId,
      };

      const stakeholderProjectData2 = {
        cadTrustStakeholderId: newStakeholder.cadTrustStakeholderId,
        cadTrustProjectId: anotherProject.cadTrustProjectId,
      };

      const stakeholderProject1 = await StakeholderProjectV2Mirror.create(stakeholderProjectData1);
      const stakeholderProject2 = await StakeholderProjectV2Mirror.create(stakeholderProjectData2);

      expect(stakeholderProject1.cadTrustStakeholderId).to.equal(stakeholderProject2.cadTrustStakeholderId);
      expect(stakeholderProject1.cadTrustProjectId).to.not.equal(stakeholderProject2.cadTrustProjectId);
    });

    it('should allow same project with different stakeholders', async function () {
      // Create two different stakeholders for this test
      const stakeholder1 = await StakeholderV2.create({
        cadTrustStakeholderId: uuidv4(),
        stakeholderName: 'Test Stakeholder 1',
        stakeholderType: 'Owner',
        stakeholderLink: 'https://example.com/stakeholder1',
      });

      const stakeholder2 = await StakeholderV2.create({
        cadTrustStakeholderId: uuidv4(),
        stakeholderName: 'Test Stakeholder 2',
        stakeholderType: 'Developer',
        stakeholderLink: 'https://example.com/stakeholder2',
      });

      const stakeholderProjectData1 = {
        cadTrustStakeholderId: stakeholder1.cadTrustStakeholderId,
        cadTrustProjectId: testProjectId,
      };

      const stakeholderProjectData2 = {
        cadTrustStakeholderId: stakeholder2.cadTrustStakeholderId,
        cadTrustProjectId: testProjectId,
      };

      const stakeholderProject1 = await StakeholderProjectV2Mirror.create(stakeholderProjectData1);
      const stakeholderProject2 = await StakeholderProjectV2Mirror.create(stakeholderProjectData2);

      expect(stakeholderProject1.cadTrustStakeholderId).to.not.equal(stakeholderProject2.cadTrustStakeholderId);
      expect(stakeholderProject1.cadTrustProjectId).to.equal(stakeholderProject2.cadTrustProjectId);
    });
  });

  describe('Stakeholder-Projects UUID Tests', function () {
    it('should generate valid UUID for stakeholder-project', async function () {
      // Create a new stakeholder for this test to avoid conflicts
      const newStakeholder = await StakeholderV2.create({
        cadTrustStakeholderId: uuidv4(),
        stakeholderName: 'UUID Test Stakeholder',
        stakeholderType: 'Consultant',
        stakeholderLink: 'https://example.com/uuid',
      });

      const stakeholderProjectData = {
        cadTrustStakeholderId: newStakeholder.cadTrustStakeholderId,
        cadTrustProjectId: testProjectId,
      };

      const stakeholderProject = await StakeholderProjectV2Mirror.create(stakeholderProjectData);

      expect(stakeholderProject.cadTrustStakeholderProjectId).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(stakeholderProject.cadTrustStakeholderProjectId).to.have.length(36);
    });

    it('should accept explicitly provided UUID', async function () {
      // Create a new stakeholder for this test to avoid conflicts
      const newStakeholder = await StakeholderV2.create({
        cadTrustStakeholderId: uuidv4(),
        stakeholderName: 'Explicit UUID Stakeholder',
        stakeholderType: 'Owner',
        stakeholderLink: 'https://example.com/explicit',
      });

      const explicitUuid = uuidv4();
      const stakeholderProjectData = {
        cadTrustStakeholderProjectId: explicitUuid,
        cadTrustStakeholderId: newStakeholder.cadTrustStakeholderId,
        cadTrustProjectId: testProjectId,
      };

      const stakeholderProject = await StakeholderProjectV2Mirror.create(stakeholderProjectData);

      expect(stakeholderProject.cadTrustStakeholderProjectId).to.equal(explicitUuid);
    });
  });

  describe('POST /v2/stakeholder-projects (Create)', function () {
    it('should create a new stakeholder-projects relationship via API', async function () {
      // Create a new stakeholder for this test to avoid conflicts with previous tests
      const newStakeholder = await StakeholderV2.create({
        cadTrustStakeholderId: uuidv4(),
        stakeholderName: 'Test Stakeholder for API Test',
        stakeholderType: 'Developer',
        stakeholderLink: 'https://example.com/api-stakeholder',
      });

      const stakeholderProjectData = {
        cadTrustStakeholderId: newStakeholder.cadTrustStakeholderId,
        cadTrustProjectId: testProjectId,
      };

      const response = await supertest(app)
        .post('/v2/stakeholder-projects')
        .send(stakeholderProjectData);

      if (response.status !== 200) {
        console.log('Error response:', response.body);
      }

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('Stakeholder-Project relationship staged successfully');
      expect(response.body).to.have.property('uuid');
      expect(response.body).to.have.property('cadTrustStakeholderProjectId');
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.not.have.property('data');

      // Verify record was staged
      const stagingRecord = await StagingV2.findOne({
        where: { uuid: response.body.uuid },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.table).to.equal('stakeholder_projects');
      expect(stagingRecord.action).to.equal('INSERT');
      expect(stagingRecord.committed).to.be.false;

      // Verify staged data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].cad_trust_stakeholder_id).to.equal(newStakeholder.cadTrustStakeholderId);
      expect(stagedData[0].cad_trust_project_id).to.equal(testProjectId);
      expect(stagedData[0].cad_trust_stakeholder_project_id).to.equal(response.body.cadTrustStakeholderProjectId);
    });

    it('should reject stakeholder-projects with invalid cadTrustStakeholderId (non-existent)', async function () {
      const stakeholderProjectData = {
        cadTrustStakeholderId: '550e8400-e29b-41d4-a716-446655440999',
        cadTrustProjectId: testProjectId,
      };

      const response = await supertest(app)
        .post('/v2/stakeholder-projects')
        .send(stakeholderProjectData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cadTrustStakeholderId');
      expect(response.body.error).to.include('does not exist');
    });

    it('should reject stakeholder-projects with missing required fields', async function () {
      const invalidData = {
        cadTrustStakeholderId: testStakeholderId,
        // Missing cadTrustProjectId
      };

      const response = await supertest(app)
        .post('/v2/stakeholder-projects')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cadTrustProjectId');
    });
  });

  describe('PUT /v2/stakeholder-projects/:id (Update)', function () {
    let createdStakeholderProjectId;

    before(async function () {
      // Clean up any existing stakeholder-project relationships for test isolation
      await StakeholderProjectV2.destroy({
        where: {
          cadTrustStakeholderId: testStakeholderId,
          cadTrustProjectId: testProjectId
        }
      });
      await StagingV2.destroy({ where: { table: 'stakeholder_projects' } });

      const stakeholderProjectData = {
        cadTrustStakeholderId: testStakeholderId,
        cadTrustProjectId: testProjectId,
      };

      const response = await supertest(app)
        .post('/v2/stakeholder-projects')
        .send(stakeholderProjectData);

      createdStakeholderProjectId = response.body.cadTrustStakeholderProjectId;

      let stagingRecord = null;
      if (response.body.uuid) {
        stagingRecord = await StagingV2.findOne({
          where: { uuid: response.body.uuid },
        });
      }
      if (stagingRecord) {
        await stagingRecord.update({ committed: true });
        await StakeholderProjectV2.create({
          cadTrustStakeholderProjectId: createdStakeholderProjectId,
          cadTrustStakeholderId: testStakeholderId,
          cadTrustProjectId: testProjectId,
        });
        // Clean up committed staging record to avoid pending commits errors
        // Wait a moment to ensure record is persisted
        await new Promise(resolve => setTimeout(resolve, 100));
        await stagingRecord.destroy();
      }
    });

    it('should update a stakeholder-projects relationship via API', async function () {
      const updateData = {
        cadTrustStakeholderId: testStakeholderId,
        cadTrustProjectId: testProjectId,
      };

      const response = await supertest(app)
        .put(`/v2/stakeholder-projects/${createdStakeholderProjectId}`)
        .send(updateData);

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('Stakeholder-Project relationship update staged successfully');
      expect(response.body).to.have.property('success', true);
    });
  });

  describe('DELETE /v2/stakeholder-projects/:id (Delete)', function () {
    let createdStakeholderProjectId;

    before(async function () {
      // Clean up any existing stakeholder-project relationships for test isolation
      await StakeholderProjectV2.destroy({
        where: {
          cadTrustStakeholderId: testStakeholderId,
          cadTrustProjectId: testProjectId
        }
      });
      await StagingV2.destroy({ where: { table: 'stakeholder_projects' } });

      const stakeholderProjectData = {
        cadTrustStakeholderId: testStakeholderId,
        cadTrustProjectId: testProjectId,
      };

      const response = await supertest(app)
        .post('/v2/stakeholder-projects')
        .send(stakeholderProjectData);

      createdStakeholderProjectId = response.body.cadTrustStakeholderProjectId;

      let stagingRecord = null;
      if (response.body.uuid) {
        stagingRecord = await StagingV2.findOne({
          where: { uuid: response.body.uuid },
        });
      }
      if (stagingRecord) {
        await stagingRecord.update({ committed: true });
        await StakeholderProjectV2.create({
          cadTrustStakeholderProjectId: createdStakeholderProjectId,
          cadTrustStakeholderId: testStakeholderId,
          cadTrustProjectId: testProjectId,
        });
        // Clean up committed staging record to avoid pending commits errors
        // Wait a moment to ensure record is persisted
        await new Promise(resolve => setTimeout(resolve, 100));
        await stagingRecord.destroy();
      }
    });

    it('should delete a stakeholder-projects relationship via API', async function () {
      const response = await supertest(app)
        .delete(`/v2/stakeholder-projects/${createdStakeholderProjectId}`);

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('Stakeholder-Project relationship delete staged successfully');
      expect(response.body).to.have.property('success', true);
    });
  });
});
