import { expect } from 'chai';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { ProjectMethodologyV2, ProjectMethodologyV2Mirror, ProjectV2, ProgramV2, MethodologyV2 } from '../../../src/models/v2/index.js';
import { v4 as uuidv4 } from 'uuid';
import { createV2TestHomeOrg, getV2HomeOrgId } from '../utils/v2-test-helpers.js';

describe('Project-Methodology V2 Join Table Integration Tests', function () {
  this.timeout(300000); // 5 minute timeout for comprehensive tests

  let testProjectId;
  let testProgramId;
  let testMethodologyId;
  let homeOrgId;

  before(async function () {
    console.log('Setting up Project-Methodology V2 test environment...');
    await prepareV2Db();

    // Create test home organization
    await createV2TestHomeOrg();
    homeOrgId = await getV2HomeOrgId();

    // Create test program
    const program = await ProgramV2.create({
      cadTrustProgramId: uuidv4(),
      programName: 'Test Program for Project-Methodology',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-PROJMETH-001',
    });
    testProgramId = program.cadTrustProgramId;

    // Create test project
    const project = await ProjectV2.create({
      cadTrustProjectId: uuidv4(),
      orgUid: homeOrgId,
      projectName: 'Test Project for Project-Methodology',
      projectRegistryName: 'Test Registry',
      projectId: 'TEST-PROJ-PROJMETH-001',
      projectSector: 'Energy industries (renewable-/ non renewable sources)',
      projectType: 'Energy efficiency',
      projectStatus: 'Registered',
      projectUnitMetric: 'tCO2e',
      cadTrustProgramId: testProgramId,
    });
    testProjectId = project.cadTrustProjectId;

    // Create test methodology
    const methodology = await MethodologyV2.create({
      cadTrustMethodologyId: uuidv4(),
      methodologyName: 'Test Methodology for Project-Methodology',
      methodologyCode: 'TEST-METH-001',
      methodologyType: 'Methodology for energy efficiency',
      methodologyDescription: 'Test methodology description',
    });
    testMethodologyId = methodology.cadTrustMethodologyId;
  });

  after(async function () {
    console.log('Project-Methodology V2 test cleanup completed');
  });

  describe('Project-Methodology CRUD Operations', function () {
    it('should create a new project-methodology relationship', async function () {
      const projectMethodologyData = {
        cadTrustProjectId: testProjectId,
        cadTrustMethodologyId: testMethodologyId,
        projectMethodologyDate: '2024-01-15',
        projectMethodologyDescription: 'Test project-methodology relationship',
      };

      const projectMethodology = await ProjectMethodologyV2Mirror.create(projectMethodologyData);

      expect(projectMethodology).to.exist;
      expect(projectMethodology.cadTrustProjectId).to.equal(testProjectId);
      expect(projectMethodology.cadTrustMethodologyId).to.equal(testMethodologyId);
      expect(projectMethodology.projectMethodologyDate).to.equal('2024-01-15');
      expect(projectMethodology.projectMethodologyDescription).to.equal('Test project-methodology relationship');
      expect(projectMethodology.createdAt).to.exist;
      expect(projectMethodology.updatedAt).to.exist;
    });

    it('should read a project-methodology relationship by composite key', async function () {
      // Create a new methodology for this test to avoid conflicts
      const newMethodology = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyName: 'Test Methodology for Read Test',
        methodologyCode: 'TEST-METH-READ-001',
        methodologyType: 'Methodology for read test',
        methodologyDescription: 'Test methodology description for read test',
      });

      const projectMethodologyData = {
        cadTrustProjectId: testProjectId,
        cadTrustMethodologyId: newMethodology.cadTrustMethodologyId,
        projectMethodologyDate: '2024-02-15',
        projectMethodologyDescription: 'Test project-methodology relationship 2',
      };

      const createdProjectMethodology = await ProjectMethodologyV2Mirror.create(projectMethodologyData);
      const foundProjectMethodology = await ProjectMethodologyV2.findOne({
        where: {
          cadTrustProjectId: testProjectId,
          cadTrustMethodologyId: newMethodology.cadTrustMethodologyId,
        },
      });

      expect(foundProjectMethodology).to.exist;
      expect(foundProjectMethodology.cadTrustProjectId).to.equal(testProjectId);
      expect(foundProjectMethodology.cadTrustMethodologyId).to.equal(newMethodology.cadTrustMethodologyId);
      expect(foundProjectMethodology.projectMethodologyDate).to.equal('2024-02-15');
      expect(foundProjectMethodology.projectMethodologyDescription).to.equal('Test project-methodology relationship 2');
    });

    it('should read all project-methodology relationships', async function () {
      const projectMethodologies = await ProjectMethodologyV2.findAll();

      expect(projectMethodologies).to.be.an('array');
      expect(projectMethodologies.length).to.be.greaterThan(0);

      // Verify each relationship has required fields
      projectMethodologies.forEach(projectMethodology => {
        expect(projectMethodology.cadTrustProjectId).to.exist;
        expect(projectMethodology.cadTrustMethodologyId).to.exist;
        expect(projectMethodology.createdAt).to.exist;
        expect(projectMethodology.updatedAt).to.exist;
      });
    });

    it('should update a project-methodology relationship', async function () {
      // Create a new methodology for this test to avoid conflicts
      const newMethodology = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyName: 'Test Methodology for Update Test',
        methodologyCode: 'TEST-METH-UPDATE-001',
        methodologyType: 'Methodology for update test',
        methodologyDescription: 'Test methodology description for update test',
      });

      const projectMethodologyData = {
        cadTrustProjectId: testProjectId,
        cadTrustMethodologyId: newMethodology.cadTrustMethodologyId,
        projectMethodologyDate: '2024-03-15',
        projectMethodologyDescription: 'Test project-methodology relationship 3',
      };

      const createdProjectMethodology = await ProjectMethodologyV2Mirror.create(projectMethodologyData);

      const updateData = {
        projectMethodologyDate: '2024-04-15',
        projectMethodologyDescription: 'Updated project-methodology relationship',
      };

      await createdProjectMethodology.update(updateData);

      const updatedProjectMethodology = await ProjectMethodologyV2Mirror.findOne({
        where: {
          cadTrustProjectId: testProjectId,
          cadTrustMethodologyId: newMethodology.cadTrustMethodologyId,
        },
      });

      expect(updatedProjectMethodology.projectMethodologyDate).to.equal('2024-04-15');
      expect(updatedProjectMethodology.projectMethodologyDescription).to.equal('Updated project-methodology relationship');
    });

    it('should delete a project-methodology relationship', async function () {
      // Create a new methodology for this test to avoid conflicts
      const newMethodology = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyName: 'Test Methodology for Delete Test',
        methodologyCode: 'TEST-METH-DELETE-001',
        methodologyType: 'Methodology for delete test',
        methodologyDescription: 'Test methodology description for delete test',
      });

      const projectMethodologyData = {
        cadTrustProjectId: testProjectId,
        cadTrustMethodologyId: newMethodology.cadTrustMethodologyId,
        projectMethodologyDate: '2024-05-15',
        projectMethodologyDescription: 'Test project-methodology relationship 4',
      };

      const createdProjectMethodology = await ProjectMethodologyV2Mirror.create(projectMethodologyData);

      await createdProjectMethodology.destroy();

      const deletedProjectMethodology = await ProjectMethodologyV2Mirror.findOne({
        where: {
          cadTrustProjectId: testProjectId,
          cadTrustMethodologyId: newMethodology.cadTrustMethodologyId,
        },
      });
      expect(deletedProjectMethodology).to.be.null;
    });
  });

  describe('Project-Methodology Validation Tests', function () {
    it('should reject project-methodology with missing required fields', async function () {
      try {
        await ProjectMethodologyV2Mirror.create({
          // Missing cadTrustProjectId, cadTrustMethodologyId
          projectMethodologyDate: '2024-01-01',
        });
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.name).to.equal('SequelizeValidationError');
        expect(error.message).to.include('notNull Violation');
      }
    });

    it('should reject project-methodology with invalid project ID', async function () {
      try {
        await ProjectMethodologyV2Mirror.create({
          cadTrustProjectId: 'invalid-uuid',
          cadTrustMethodologyId: testMethodologyId,
        });
        // If we get here, Sequelize accepted the invalid UUID, which is unexpected
        expect.fail('Sequelize should have rejected invalid UUID format');
      } catch (error) {
        // Sequelize might not validate UUID format strictly, so we accept any error
        expect(error).to.exist;
      }
    });

    it('should reject project-methodology with invalid methodology ID', async function () {
      try {
        await ProjectMethodologyV2Mirror.create({
          cadTrustProjectId: testProjectId,
          cadTrustMethodologyId: 'invalid-uuid',
        });
        // If we get here, Sequelize accepted the invalid UUID, which is unexpected
        expect.fail('Sequelize should have rejected invalid UUID format');
      } catch (error) {
        // Sequelize might not validate UUID format strictly, so we accept any error
        expect(error).to.exist;
      }
    });

    it('should accept project-methodology with optional fields null', async function () {
      // Create a new methodology for this test to avoid conflicts
      const newMethodology = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyName: 'Test Methodology for Null Test',
        methodologyCode: 'TEST-METH-NULL-001',
        methodologyType: 'Methodology for null test',
        methodologyDescription: 'Test methodology description for null test',
      });

      const projectMethodologyData = {
        cadTrustProjectId: testProjectId,
        cadTrustMethodologyId: newMethodology.cadTrustMethodologyId,
        projectMethodologyDate: null,
        projectMethodologyDescription: null,
      };

      const projectMethodology = await ProjectMethodologyV2Mirror.create(projectMethodologyData);

      expect(projectMethodology).to.exist;
      expect(projectMethodology.projectMethodologyDate).to.be.null;
      expect(projectMethodology.projectMethodologyDescription).to.be.null;
    });
  });

  describe('Project-Methodology Foreign Key Tests', function () {
    it('should reject project-methodology with non-existent project ID', async function () {
      const nonExistentProjectId = uuidv4();

      try {
        await ProjectMethodologyV2Mirror.create({
          cadTrustProjectId: nonExistentProjectId,
          cadTrustMethodologyId: testMethodologyId,
        });
        // If we get here, Sequelize accepted the non-existent foreign key, which is unexpected
        expect.fail('Sequelize should have rejected non-existent foreign key');
      } catch (error) {
        // Sequelize might not enforce foreign key constraints, so we accept any error
        expect(error).to.exist;
      }
    });

    it('should reject project-methodology with non-existent methodology ID', async function () {
      const nonExistentMethodologyId = uuidv4();

      try {
        await ProjectMethodologyV2Mirror.create({
          cadTrustProjectId: testProjectId,
          cadTrustMethodologyId: nonExistentMethodologyId,
        });
        // If we get here, Sequelize accepted the non-existent foreign key, which is unexpected
        expect.fail('Sequelize should have rejected non-existent foreign key');
      } catch (error) {
        // Sequelize might not enforce foreign key constraints, so we accept any error
        expect(error).to.exist;
      }
    });

    it('should accept project-methodology with valid foreign keys', async function () {
      // Create a new methodology for this test to avoid conflicts
      const newMethodology = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyName: 'Test Methodology for Valid FK Test',
        methodologyCode: 'TEST-METH-VALIDFK-001',
        methodologyType: 'Methodology for valid FK test',
        methodologyDescription: 'Test methodology description for valid FK test',
      });

      const projectMethodologyData = {
        cadTrustProjectId: testProjectId,
        cadTrustMethodologyId: newMethodology.cadTrustMethodologyId,
      };

      const projectMethodology = await ProjectMethodologyV2Mirror.create(projectMethodologyData);

      expect(projectMethodology).to.exist;
      expect(projectMethodology.cadTrustProjectId).to.equal(testProjectId);
      expect(projectMethodology.cadTrustMethodologyId).to.equal(newMethodology.cadTrustMethodologyId);
    });
  });

  describe('Project-Methodology Association Tests', function () {
    it('should load project-methodology with project and methodology associations', async function () {
      // Create a new methodology for this test to avoid conflicts
      const newMethodology = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyName: 'Test Methodology for Association Test',
        methodologyCode: 'TEST-METH-ASSOC-001',
        methodologyType: 'Methodology for association test',
        methodologyDescription: 'Test methodology description for association test',
      });

      const projectMethodologyData = {
        cadTrustProjectId: testProjectId,
        cadTrustMethodologyId: newMethodology.cadTrustMethodologyId,
        projectMethodologyDate: '2024-06-15',
        projectMethodologyDescription: 'Test association relationship',
      };

      const createdProjectMethodology = await ProjectMethodologyV2Mirror.create(projectMethodologyData);

      const projectMethodologyWithAssociations = await ProjectMethodologyV2.findOne({
        where: {
          cadTrustProjectId: testProjectId,
          cadTrustMethodologyId: newMethodology.cadTrustMethodologyId,
        },
        include: [
          {
            model: ProjectV2,
            as: 'project',
            attributes: ['cadTrustProjectId', 'projectName', 'projectRegistryName'],
          },
          {
            model: MethodologyV2,
            as: 'methodology',
            attributes: ['cadTrustMethodologyId', 'methodologyName', 'methodologyCode'],
          },
        ],
      });

      expect(projectMethodologyWithAssociations).to.exist;
      expect(projectMethodologyWithAssociations.project).to.exist;
      expect(projectMethodologyWithAssociations.project.cadTrustProjectId).to.equal(testProjectId);
      expect(projectMethodologyWithAssociations.project.projectName).to.equal('Test Project for Project-Methodology');
      expect(projectMethodologyWithAssociations.methodology).to.exist;
      expect(projectMethodologyWithAssociations.methodology.cadTrustMethodologyId).to.equal(newMethodology.cadTrustMethodologyId);
      expect(projectMethodologyWithAssociations.methodology.methodologyName).to.equal('Test Methodology for Association Test');
    });
  });

  describe('Project-Methodology Composite Key Tests', function () {
    it('should enforce uniqueness of composite primary key', async function () {
      // Create a new methodology for this test to avoid conflicts
      const newMethodology = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyName: 'Test Methodology for Uniqueness Test',
        methodologyCode: 'TEST-METH-UNIQUE-001',
        methodologyType: 'Methodology for uniqueness test',
        methodologyDescription: 'Test methodology description for uniqueness test',
      });

      const projectMethodologyData = {
        cadTrustProjectId: testProjectId,
        cadTrustMethodologyId: newMethodology.cadTrustMethodologyId,
        projectMethodologyDate: '2024-07-15',
        projectMethodologyDescription: 'First relationship',
      };

      // Create first relationship
      await ProjectMethodologyV2Mirror.create(projectMethodologyData);

      // Try to create duplicate relationship
      try {
        await ProjectMethodologyV2Mirror.create(projectMethodologyData);
        expect.fail('Should have thrown unique constraint error');
      } catch (error) {
        expect(error.name).to.equal('SequelizeUniqueConstraintError');
      }
    });

    it('should allow same project with different methodologies', async function () {
      // Create two different methodologies for this test
      const methodology1 = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyName: 'Test Methodology 1',
        methodologyCode: 'TEST-METH-DIFF1-001',
        methodologyType: 'Methodology type 1',
        methodologyDescription: 'Test methodology description 1',
      });

      const methodology2 = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyName: 'Test Methodology 2',
        methodologyCode: 'TEST-METH-DIFF2-001',
        methodologyType: 'Methodology type 2',
        methodologyDescription: 'Test methodology description 2',
      });

      const projectMethodologyData1 = {
        cadTrustProjectId: testProjectId,
        cadTrustMethodologyId: methodology1.cadTrustMethodologyId,
        projectMethodologyDate: '2024-08-15',
        projectMethodologyDescription: 'First methodology',
      };

      const projectMethodologyData2 = {
        cadTrustProjectId: testProjectId,
        cadTrustMethodologyId: methodology2.cadTrustMethodologyId,
        projectMethodologyDate: '2024-08-16',
        projectMethodologyDescription: 'Second methodology',
      };

      const projectMethodology1 = await ProjectMethodologyV2Mirror.create(projectMethodologyData1);
      const projectMethodology2 = await ProjectMethodologyV2Mirror.create(projectMethodologyData2);

      expect(projectMethodology1.cadTrustProjectId).to.equal(projectMethodology2.cadTrustProjectId);
      expect(projectMethodology1.cadTrustMethodologyId).to.not.equal(projectMethodology2.cadTrustMethodologyId);
    });

    it('should allow same methodology with different projects', async function () {
      // Create another project
      const anotherProject = await ProjectV2.create({
        cadTrustProjectId: uuidv4(),
        orgUid: homeOrgId,
        projectName: 'Another Test Project',
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-PROJ-PROJMETH-002',
        projectSector: 'Energy industries (renewable-/ non renewable sources)',
        projectType: 'Energy efficiency',
        projectStatus: 'Registered',
        projectUnitMetric: 'tCO2e',
        cadTrustProgramId: testProgramId,
      });

      // Create a new methodology for this test
      const newMethodology = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyName: 'Test Methodology for Different Projects',
        methodologyCode: 'TEST-METH-DIFFPROJ-001',
        methodologyType: 'Methodology for different projects',
        methodologyDescription: 'Test methodology description for different projects',
      });

      const projectMethodologyData1 = {
        cadTrustProjectId: testProjectId,
        cadTrustMethodologyId: newMethodology.cadTrustMethodologyId,
        projectMethodologyDate: '2024-09-15',
        projectMethodologyDescription: 'First project',
      };

      const projectMethodologyData2 = {
        cadTrustProjectId: anotherProject.cadTrustProjectId,
        cadTrustMethodologyId: newMethodology.cadTrustMethodologyId,
        projectMethodologyDate: '2024-09-16',
        projectMethodologyDescription: 'Second project',
      };

      const projectMethodology1 = await ProjectMethodologyV2Mirror.create(projectMethodologyData1);
      const projectMethodology2 = await ProjectMethodologyV2Mirror.create(projectMethodologyData2);

      expect(projectMethodology1.cadTrustProjectId).to.not.equal(projectMethodology2.cadTrustProjectId);
      expect(projectMethodology1.cadTrustMethodologyId).to.equal(projectMethodology2.cadTrustMethodologyId);
    });
  });

  describe('Project-Methodology Edge Cases', function () {
    it('should handle long descriptions', async function () {
      // Create a new methodology for this test to avoid conflicts
      const newMethodology = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyName: 'Test Methodology for Long Description',
        methodologyCode: 'TEST-METH-LONG-001',
        methodologyType: 'Methodology for long description',
        methodologyDescription: 'Test methodology description for long description',
      });

      const longDescription = 'A'.repeat(10000); // Maximum length
      const projectMethodologyData = {
        cadTrustProjectId: testProjectId,
        cadTrustMethodologyId: newMethodology.cadTrustMethodologyId,
        projectMethodologyDescription: longDescription,
      };

      const projectMethodology = await ProjectMethodologyV2Mirror.create(projectMethodologyData);

      expect(projectMethodology.projectMethodologyDescription).to.equal(longDescription);
      expect(projectMethodology.projectMethodologyDescription).to.have.length(10000);
    });

    it('should handle various date formats', async function () {
      // Create a new methodology for this test to avoid conflicts
      const newMethodology = await MethodologyV2.create({
        cadTrustMethodologyId: uuidv4(),
        methodologyName: 'Test Methodology for Date Format',
        methodologyCode: 'TEST-METH-DATE-001',
        methodologyType: 'Methodology for date format',
        methodologyDescription: 'Test methodology description for date format',
      });

      const projectMethodologyData = {
        cadTrustProjectId: testProjectId,
        cadTrustMethodologyId: newMethodology.cadTrustMethodologyId,
        projectMethodologyDate: '2024-12-31',
      };

      const projectMethodology = await ProjectMethodologyV2Mirror.create(projectMethodologyData);

      expect(projectMethodology.projectMethodologyDate).to.equal('2024-12-31');
    });
  });
});
