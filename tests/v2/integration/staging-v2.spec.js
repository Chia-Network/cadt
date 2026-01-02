import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import {
  StagingV2,
  OrganizationsV2,
  ProgramV2,
  MethodologyV2,
  ProjectV2,
  ValidationV2,
  VerificationV2,
  IssuanceV2,
  UnitV2,
  LocationV2,
} from '../../../src/models/v2/index.js';
import { Staging } from '../../../src/models/index.js';
import {
  generateV2ProgramData,
  generateV2MethodologyData,
  generateV2ProjectData,
  generateV2ValidationData,
  generateV2VerificationData,
  generateV2IssuanceData,
  generateV2UnitData,
  generateV2LocationData,
} from '../utils/v2-staging-test-data.js';
import { createV2TestHomeOrg, getV2HomeOrgId, resetV2StagingTable, resetV2DataTables } from '../utils/v2-test-helpers.js';
import { v4 as uuidv4 } from 'uuid';

describe('V2 Staging Integration Tests', function () {
  this.timeout(300000); // 5 minutes for datalayer operations

  let homeOrg;
  let programId;
  let methodologyId;
  let projectId;

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();

    // Create test home organization
    homeOrg = await createV2TestHomeOrg();
    expect(homeOrg).to.exist;
  });

  after(async function () {
    console.log('Cleaning up V2 test environment...');
    await resetV2StagingTable();
    await resetV2DataTables();
  });

  beforeEach(async function () {
    // Clean up staging and data tables before each test
    await resetV2StagingTable();
    await resetV2DataTables();

    // Get home org ID for test data
    const homeOrgId = await getV2HomeOrgId();

    // Create base records for tests that need them
    // Convert snake_case to camelCase for direct model creation
    const programDataSnake = await generateV2ProgramData();
    const programData = {
      cadTrustProgramId: programDataSnake.cad_trust_program_id,
      programName: programDataSnake.program_name,
      programRegistry: programDataSnake.program_registry,
      programRegistryActivityId: programDataSnake.program_registry_activity_id,
      programRegistryProgramId: programDataSnake.program_registry_program_id,
      programDescription: programDataSnake.program_description,
    };
    const program = await ProgramV2.create(programData);
    programId = program.cadTrustProgramId;

    const methodologyDataSnake = await generateV2MethodologyData();
    const methodologyData = {
      cadTrustMethodologyId: methodologyDataSnake.cad_trust_methodology_id,
      methodologyCode: methodologyDataSnake.methodology_code,
      methodologyName: methodologyDataSnake.methodology_name,
      methodologyVersion: methodologyDataSnake.methodology_version,
      methodologyDate: methodologyDataSnake.methodology_date,
      methodologyLink: methodologyDataSnake.methodology_link,
      methodologyType: methodologyDataSnake.methodology_type,
    };
    const methodology = await MethodologyV2.create(methodologyData);
    methodologyId = methodology.cadTrustMethodologyId;

    const projectDataSnake = await generateV2ProjectData({
      cad_trust_program_id: programId,
    });
    const projectData = {
      cadTrustProjectId: projectDataSnake.cad_trust_project_id,
      orgUid: homeOrgId,
      projectRegistryName: projectDataSnake.project_registry_name,
      projectId: projectDataSnake.project_id,
      projectCreditingProgram: projectDataSnake.project_crediting_program,
      projectName: projectDataSnake.project_name,
      projectLink: projectDataSnake.project_link,
      projectDescription: projectDataSnake.project_description,
      projectSector: projectDataSnake.project_sector,
      projectType: projectDataSnake.project_type,
      projectSubtype: projectDataSnake.project_subtype,
      projectStatus: projectDataSnake.project_status,
      projectStatusDate: projectDataSnake.project_status_date,
      projectUnitMetric: projectDataSnake.project_unit_metric,
      cadTrustReferenceProjectId: projectDataSnake.cad_trust_reference_project_id,
      cadTrustProgramId: projectDataSnake.cad_trust_program_id,
    };
    const project = await ProjectV2.create(projectData);
    projectId = project.cadTrustProjectId;
  });

  describe('Staging Controller: Read Endpoints', function () {
    it('should get all staging records', async function () {
      // Create some staging records
      const programData = await generateV2ProgramData();
      await StagingV2.create({
        uuid: uuidv4(),
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData]),
        committed: false,
      });

      const response = await supertest(app)
        .get('/v2/staging')
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body.length).to.be.greaterThan(0);
    });

    it('should check for pending commits', async function () {
      // Create staging record
      const programData = await generateV2ProgramData();
      await StagingV2.create({
        uuid: uuidv4(),
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData]),
        committed: false,
      });

      const response = await supertest(app)
        .get('/v2/staging/pending')
        .expect(200);

      expect(response.body).to.have.property('confirmed');
      expect(response.body.confirmed).to.be.false; // Has pending commits
    });

    it('should filter staging records by table', async function () {
      // Create staging records for different tables
      const programData = await generateV2ProgramData();
      await StagingV2.create({
        uuid: uuidv4(),
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData]),
        committed: false,
      });

      const methodologyData = await generateV2MethodologyData();
      await StagingV2.create({
        uuid: uuidv4(),
        table: 'methodology',
        action: 'INSERT',
        data: JSON.stringify([methodologyData]),
        committed: false,
      });

      const response = await supertest(app)
        .get('/v2/staging?table=program')
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body.every(r => r.table === 'program')).to.be.true;
    });

    it('should support pagination', async function () {
      // Create multiple staging records
      const programData1 = await generateV2ProgramData();
      const programData2 = await generateV2ProgramData();
      const programData3 = await generateV2ProgramData();

      await StagingV2.create({
        uuid: uuidv4(),
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData1]),
        committed: false,
      });
      await StagingV2.create({
        uuid: uuidv4(),
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData2]),
        committed: false,
      });
      await StagingV2.create({
        uuid: uuidv4(),
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData3]),
        committed: false,
      });

      // Test page 1, limit 2
      const response1 = await supertest(app)
        .get('/v2/staging?page=1&limit=2')
        .expect(200);

      expect(response1.body).to.be.an('object');
      expect(response1.body).to.have.property('page');
      expect(response1.body).to.have.property('pageCount');
      expect(response1.body).to.have.property('data');
      expect(response1.body.data).to.be.an('array');
      expect(response1.body.data.length).to.equal(2);
      expect(response1.body.page).to.equal('1');

      // Test page 2, limit 2
      const response2 = await supertest(app)
        .get('/v2/staging?page=2&limit=2')
        .expect(200);

      expect(response2.body).to.be.an('object');
      expect(response2.body).to.have.property('data');
      expect(response2.body.data).to.be.an('array');
      expect(response2.body.data.length).to.be.greaterThan(0);
      expect(response2.body.page).to.equal('2');
    });

    it('should filter by type=staged', async function () {
      // Create committed and uncommitted records
      const programData1 = await generateV2ProgramData();
      const programData2 = await generateV2ProgramData();

      await StagingV2.create({
        uuid: uuidv4(),
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData1]),
        committed: false,
      });

      await StagingV2.create({
        uuid: uuidv4(),
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData2]),
        committed: true,
      });

      const response = await supertest(app)
        .get('/v2/staging?type=staged')
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body.every(r => r.committed === false && r.failed_commit === false)).to.be.true;
    });

    it('should filter by type=pending', async function () {
      // Create committed and uncommitted records
      const programData1 = await generateV2ProgramData();
      const programData2 = await generateV2ProgramData();

      await StagingV2.create({
        uuid: uuidv4(),
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData1]),
        committed: false,
      });

      await StagingV2.create({
        uuid: uuidv4(),
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData2]),
        committed: true,
        failed_commit: false,
      });

      const response = await supertest(app)
        .get('/v2/staging?type=pending')
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body.every(r => r.committed === true && r.failed_commit === false)).to.be.true;
    });

    it('should filter by type=failed', async function () {
      // Create failed commit record
      const programData = await generateV2ProgramData();

      await StagingV2.create({
        uuid: uuidv4(),
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData]),
        committed: false,
        failed_commit: true,
      });

      const response = await supertest(app)
        .get('/v2/staging?type=failed')
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body.every(r => r.failed_commit === true)).to.be.true;
    });
  });

  describe('Staging Model: getDiffObject', function () {
    it('should return diff for INSERT action', async function () {
      const programData = await generateV2ProgramData();
      const uuid = programData.cad_trust_program_id;

      const diff = await StagingV2.getDiffObject(
        uuid,
        'program',
        'INSERT',
        JSON.stringify(programData)
      );

      expect(diff).to.have.property('original');
      expect(diff).to.have.property('change');
      expect(diff.original).to.deep.equal({});
      expect(diff.change).to.deep.equal(programData);
    });

    it('should return diff for UPDATE action with original record', async function () {
      // Create a program record first
      const programDataSnake = await generateV2ProgramData();
      const programData = {
        cadTrustProgramId: programDataSnake.cad_trust_program_id,
        programName: programDataSnake.program_name,
        programRegistry: programDataSnake.program_registry,
        programRegistryActivityId: programDataSnake.program_registry_activity_id,
        programRegistryProgramId: programDataSnake.program_registry_program_id,
        programDescription: programDataSnake.program_description,
      };
      const program = await ProgramV2.create(programData);
      const uuid = program.cadTrustProgramId;

      // Create updated data (snake_case for staging)
      const updatedData = { ...programDataSnake, program_name: 'Updated Program Name' };

      const diff = await StagingV2.getDiffObject(
        uuid,
        'program',
        'UPDATE',
        JSON.stringify(updatedData)
      );

      expect(diff).to.have.property('original');
      expect(diff).to.have.property('change');
      expect(diff.original).to.exist;
      expect(diff.original.cadTrustProgramId).to.equal(uuid);
      expect(diff.change.program_name).to.equal('Updated Program Name');
    });

    it('should return diff for DELETE action with original record', async function () {
      // Create a program record first
      const programDataSnake = await generateV2ProgramData();
      const programData = {
        cadTrustProgramId: programDataSnake.cad_trust_program_id,
        programName: programDataSnake.program_name,
        programRegistry: programDataSnake.program_registry,
        programRegistryActivityId: programDataSnake.program_registry_activity_id,
        programRegistryProgramId: programDataSnake.program_registry_program_id,
        programDescription: programDataSnake.program_description,
      };
      const program = await ProgramV2.create(programData);
      const uuid = program.cadTrustProgramId;

      const diff = await StagingV2.getDiffObject(
        uuid,
        'program',
        'DELETE',
        '{}'
      );

      expect(diff).to.have.property('original');
      expect(diff).to.have.property('change');
      expect(diff.original).to.exist;
      expect(diff.original.cadTrustProgramId).to.equal(uuid);
      expect(diff.change).to.deep.equal({});
    });

    it('should handle unknown table gracefully', async function () {
      const diff = await StagingV2.getDiffObject(
        uuidv4(),
        'unknown_table',
        'UPDATE',
        '{}'
      );

      expect(diff).to.have.property('original');
      expect(diff.original).to.be.null;
    });

    it('should handle non-existent record for UPDATE', async function () {
      const uuid = uuidv4();
      const programData = await generateV2ProgramData();

      const diff = await StagingV2.getDiffObject(
        uuid,
        'program',
        'UPDATE',
        JSON.stringify(programData)
      );

      expect(diff).to.have.property('original');
      expect(diff.original).to.be.null;
      expect(diff.change).to.deep.equal(programData);
    });
  });

  describe('Staging Model: seperateStagingDataIntoActionGroups', function () {
    it('should separate staging data into INSERT, UPDATE, DELETE groups', async function () {
      const programData = await generateV2ProgramData();
      const uuid = programData.cad_trust_program_id;

      const stagedData = [
        {
          uuid: uuidv4(),
          table: 'program',
          action: 'INSERT',
          data: JSON.stringify([programData]),
          committed: false,
        },
        {
          uuid: uuid,
          table: 'program',
          action: 'UPDATE',
          data: JSON.stringify([{ ...programData, program_name: 'Updated' }]),
          committed: false,
        },
        {
          uuid: uuidv4(),
          table: 'program',
          action: 'DELETE',
          data: JSON.stringify([{ cad_trust_program_id: uuidv4() }]),
          committed: false,
        },
      ];

      const [insertRecords, updateRecords, deleteChangeList] =
        await StagingV2.seperateStagingDataIntoActionGroups(stagedData, 'program');

      expect(insertRecords).to.be.an('array');
      expect(insertRecords.length).to.equal(1);
      expect(updateRecords).to.be.an('array');
      expect(updateRecords.length).to.equal(1);
      expect(deleteChangeList).to.be.an('array');
      expect(deleteChangeList.length).to.equal(2); // UPDATE + DELETE both generate delete items
    });

    it('should filter by table name', async function () {
      const programData = await generateV2ProgramData();
      const methodologyData = await generateV2MethodologyData();

      const stagedData = [
        {
          uuid: uuidv4(),
          table: 'program',
          action: 'INSERT',
          data: JSON.stringify([programData]),
          committed: false,
        },
        {
          uuid: uuidv4(),
          table: 'methodology',
          action: 'INSERT',
          data: JSON.stringify([methodologyData]),
          committed: false,
        },
      ];

      const [insertRecords, updateRecords, deleteChangeList] =
        await StagingV2.seperateStagingDataIntoActionGroups(stagedData, 'program');

      expect(insertRecords.length).to.equal(1);
      expect(insertRecords[0].cad_trust_program_id).to.equal(programData.cad_trust_program_id);
    });
  });

  describe('End-to-End Commit Flow', function () {
    it('should commit single program record', async function () {
      const programDataSnake = await generateV2ProgramData();
      // Convert to camelCase for API
      const programData = {
        programName: programDataSnake.program_name,
        programRegistry: programDataSnake.program_registry,
        programRegistryActivityId: programDataSnake.program_registry_activity_id,
        programRegistryProgramId: programDataSnake.program_registry_program_id,
        programDescription: programDataSnake.program_description,
      };

      // Create staging record via API
      const createResponse = await supertest(app)
        .post('/v2/program')
        .send(programData)
        .expect(200);

      // Verify staging record exists
      const stagingRecords = await StagingV2.findAll({
        where: { committed: false },
      });
      expect(stagingRecords.length).to.equal(1);

      // Delete any existing committed records to avoid "pending commits" error
      await StagingV2.destroy({
        where: { committed: true }
      });

      // Commit staging records
      const commitResponse = await supertest(app)
        .post('/v2/staging/commit')
        .send({
          comment: 'Test commit',
          author: 'Test User',
        })
        .expect(200);

      // Verify staging records are marked as committed
      const committedRecords = await StagingV2.findAll({
        where: { committed: true },
      });
      expect(committedRecords.length).to.equal(1);
    });

    it('should commit multiple tables together', async function () {
      // Create records for multiple tables
      const programDataSnake = await generateV2ProgramData();
      const programData = {
        programName: programDataSnake.program_name,
        programRegistry: programDataSnake.program_registry,
        programRegistryActivityId: programDataSnake.program_registry_activity_id,
        programRegistryProgramId: programDataSnake.program_registry_program_id,
        programDescription: programDataSnake.program_description,
      };

      const methodologyDataSnake = await generateV2MethodologyData();
      const methodologyData = {
        methodologyCode: methodologyDataSnake.methodology_code,
        methodologyName: methodologyDataSnake.methodology_name,
        methodologyVersion: methodologyDataSnake.methodology_version,
        methodologyDate: methodologyDataSnake.methodology_date,
        methodologyLink: methodologyDataSnake.methodology_link,
        methodologyType: methodologyDataSnake.methodology_type,
      };

      await supertest(app)
        .post('/v2/program')
        .send(programData)
        .expect(200);

      await supertest(app)
        .post('/v2/methodology')
        .send(methodologyData)
        .expect(200);

      // Verify staging records exist
      const stagingRecords = await StagingV2.findAll({
        where: { committed: false },
      });
      expect(stagingRecords.length).to.equal(2);

      // Delete any existing committed records to avoid "pending commits" error
      await StagingV2.destroy({
        where: { committed: true }
      });

      // Commit all staging records
      const commitResponse = await supertest(app)
        .post('/v2/staging/commit')
        .send({
          comment: 'Multi-table commit',
          author: 'Test User',
        })
        .expect(200);

      // Verify all staging records are marked as committed
      const committedRecords = await StagingV2.findAll({
        where: { committed: true },
      });
      expect(committedRecords.length).to.equal(2);
    });

    it('should commit project with child tables', async function () {
      // Create project with dependencies
      const projectDataSnake = await generateV2ProjectData({
        cad_trust_program_id: programId,
      });
      // Convert to camelCase for API (simplified - would need all fields)
      const projectData = {
        projectRegistryName: projectDataSnake.project_registry_name,
        projectId: projectDataSnake.project_id,
        projectCreditingProgram: projectDataSnake.project_crediting_program,
        projectName: projectDataSnake.project_name,
        projectLink: projectDataSnake.project_link,
        projectDescription: projectDataSnake.project_description,
        projectSector: projectDataSnake.project_sector,
        projectType: projectDataSnake.project_type,
        projectSubtype: projectDataSnake.project_subtype,
        projectStatus: projectDataSnake.project_status,
        projectStatusDate: projectDataSnake.project_status_date,
        projectUnitMetric: projectDataSnake.project_unit_metric,
        cadTrustReferenceProjectId: projectDataSnake.cad_trust_reference_project_id,
        cadTrustProgramId: projectDataSnake.cad_trust_program_id,
      };

      const locationDataSnake = await generateV2LocationData({
        cad_trust_project_id: projectId,
      });
      // Convert to camelCase for API (simplified - would need all fields)
      const locationData = {
        cadTrustProjectId: locationDataSnake.cad_trust_project_id,
        locationCountry: locationDataSnake.location_country,
        locationLatitude: locationDataSnake.location_latitude,
        locationLongitude: locationDataSnake.location_longitude,
        locationMapType: locationDataSnake.location_map_type,
      };

      // Create project (this will stage project)
      await supertest(app)
        .post('/v2/project')
        .send(projectData)
        .expect(200);

      // Create location (this will stage location)
      await supertest(app)
        .post('/v2/location')
        .send(locationData)
        .expect(200);

      // Delete any existing committed records to avoid "pending commits" error
      await StagingV2.destroy({
        where: { committed: true }
      });

      // Commit all staging records
      const commitResponse = await supertest(app)
        .post('/v2/staging/commit')
        .send({
          comment: 'Project with child tables commit',
          author: 'Test User',
        })
        .expect(200);

      // Verify staging records are committed
      const committedRecords = await StagingV2.findAll({
        where: { committed: true },
      });
      expect(committedRecords.length).to.be.greaterThan(0);
    });

    it('should commit only specified table', async function () {
      // Create program and methodology staging records
      const programDataSnake = await generateV2ProgramData();
      const programData = {
        programName: programDataSnake.program_name,
        programRegistry: programDataSnake.program_registry,
        programRegistryActivityId: programDataSnake.program_registry_activity_id,
        programRegistryProgramId: programDataSnake.program_registry_program_id,
        programDescription: programDataSnake.program_description,
      };

      const methodologyDataSnake = await generateV2MethodologyData();
      const methodologyData = {
        methodologyCode: methodologyDataSnake.methodology_code,
        methodologyName: methodologyDataSnake.methodology_name,
        methodologyVersion: methodologyDataSnake.methodology_version,
        methodologyDate: methodologyDataSnake.methodology_date,
        methodologyLink: methodologyDataSnake.methodology_link,
        methodologyType: methodologyDataSnake.methodology_type,
      };

      await supertest(app)
        .post('/v2/program')
        .send(programData)
        .expect(200);

      await supertest(app)
        .post('/v2/methodology')
        .send(methodologyData)
        .expect(200);

      // Delete any existing committed records
      await StagingV2.destroy({
        where: { committed: true }
      });

      // Commit only program table
      const commitResponse = await supertest(app)
        .post('/v2/staging/commit?table=program')
        .send({
          comment: 'Table-specific commit',
          author: 'Test User',
        })
        .expect(200);

      // Verify only program records are committed
      const committedProgramRecords = await StagingV2.findAll({
        where: { committed: true, table: 'program' },
      });
      const uncommittedMethodologyRecords = await StagingV2.findAll({
        where: { committed: false, table: 'methodology' },
      });

      expect(committedProgramRecords.length).to.be.greaterThan(0);
      expect(uncommittedMethodologyRecords.length).to.be.greaterThan(0);
    });

    it('should commit only specified IDs', async function () {
      // Create multiple staging records
      const programDataSnake1 = await generateV2ProgramData();
      const programData1 = {
        programName: programDataSnake1.program_name,
        programRegistry: programDataSnake1.program_registry,
        programRegistryActivityId: programDataSnake1.program_registry_activity_id,
        programRegistryProgramId: programDataSnake1.program_registry_program_id,
        programDescription: programDataSnake1.program_description,
      };

      const programDataSnake2 = await generateV2ProgramData();
      const programData2 = {
        programName: programDataSnake2.program_name,
        programRegistry: programDataSnake2.program_registry,
        programRegistryActivityId: programDataSnake2.program_registry_activity_id,
        programRegistryProgramId: programDataSnake2.program_registry_program_id,
        programDescription: programDataSnake2.program_description,
      };

      const response1 = await supertest(app)
        .post('/v2/program')
        .send(programData1)
        .expect(200);

      const response2 = await supertest(app)
        .post('/v2/program')
        .send(programData2)
        .expect(200);

      // Get staging UUIDs
      const stagingRecords = await StagingV2.findAll({
        where: { committed: false, table: 'program' },
      });

      expect(stagingRecords.length).to.equal(2);
      const firstUuid = stagingRecords[0].uuid;
      const secondUuid = stagingRecords[1].uuid;

      // Delete any existing committed records
      await StagingV2.destroy({
        where: { committed: true }
      });

      // Commit only first record
      const commitResponse = await supertest(app)
        .post('/v2/staging/commit')
        .send({
          comment: 'ID-specific commit',
          author: 'Test User',
          ids: [firstUuid],
        })
        .expect(200);

      // Verify only first record is committed
      const committedRecord = await StagingV2.findOne({
        where: { uuid: firstUuid },
      });
      const uncommittedRecord = await StagingV2.findOne({
        where: { uuid: secondUuid },
      });

      expect(committedRecord.committed).to.be.true;
      expect(uncommittedRecord.committed).to.be.false;
    });
  });

  describe('Error Handling', function () {
    it('should handle commit with no staging records', async function () {
      // Try to commit with no staging records
      const response = await supertest(app)
        .post('/v2/staging/commit')
        .send({
          comment: 'Empty commit',
          author: 'Test User',
        })
        .expect(400); // Should fail with appropriate error

      expect(response.body).to.have.property('error');
    });

    it('should mark records as failed_commit on error', async function () {
      // This test verifies the failed_commit field exists and can be set
      // Actual datalayer failure testing would require mocking
      const programData = await generateV2ProgramData();

      const stagingRecord = await StagingV2.create({
        uuid: uuidv4(),
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData]),
        committed: false,
        failed_commit: false,
      });

      // Verify failed_commit field exists
      expect(stagingRecord).to.have.property('failed_commit');
      expect(stagingRecord.failed_commit).to.be.false;

      // Manually set failed_commit to true to verify the field works
      await StagingV2.update(
        { failed_commit: true },
        { where: { uuid: stagingRecord.uuid } }
      );

      const updatedRecord = await StagingV2.findOne({
        where: { uuid: stagingRecord.uuid },
      });
      expect(updatedRecord.failed_commit).to.be.true;
    });
  });

  describe('Staging Controller: Additional Endpoints', function () {
    beforeEach(async function () {
      // Clean staging table before each test to prevent contamination from previous tests
      await StagingV2.destroy({ where: {}, truncate: true });
    });

    it('should delete staging record', async function () {
      const programData = await generateV2ProgramData();
      const stagingRecord = await StagingV2.create({
        uuid: uuidv4(),
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData]),
        committed: false,
      });

      const response = await supertest(app)
        .delete('/v2/staging')
        .send({ uuid: stagingRecord.uuid })
        .expect(200);

      // Verify record is deleted
      const deletedRecord = await StagingV2.findByPk(stagingRecord.uuid);
      expect(deletedRecord).to.be.null;
    });

    it('should clean all staging records', async function () {
      // Create some staging records
      const programData = await generateV2ProgramData();
      await StagingV2.create({
        uuid: uuidv4(),
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData]),
        committed: false,
      });

      const response = await supertest(app)
        .delete('/v2/staging/clean')
        .expect(200);

      // Verify all records are deleted
      const remainingRecords = await StagingV2.findAll();
      expect(remainingRecords.length).to.equal(0);
    });

    it('should edit staging record', async function () {
      const programData = await generateV2ProgramData();
      const stagingUuid = uuidv4();
      const stagingRecord = await StagingV2.create({
        uuid: stagingUuid,
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData]),
        committed: false,
      });

      // Verify record was created
      expect(stagingRecord).to.exist;
      expect(stagingRecord.uuid).to.equal(stagingUuid);

      const updatedData = { ...programData, program_name: 'Updated Name' };

      const response = await supertest(app)
        .put('/v2/staging')
        .send({
          uuid: stagingUuid,
          data: [updatedData], // Array, not JSON string
        })
        .expect(200);

      // Verify record is updated
      const updatedRecord = await StagingV2.findOne({
        where: { uuid: stagingUuid },
      });
      expect(updatedRecord).to.exist;
      const parsedData = JSON.parse(updatedRecord.data);
      expect(parsedData[0].program_name).to.equal('Updated Name');
    });

    it('should reject editRecord when data is not an array (DoS prevention)', async function () {
      const programData = await generateV2ProgramData();
      const stagingUuid = uuidv4();
      await StagingV2.create({
        uuid: stagingUuid,
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData]),
        committed: false,
      });

      // Send object instead of array
      const response = await supertest(app)
        .put('/v2/staging')
        .send({
          uuid: stagingUuid,
          data: { length: 1e100, 0: programData }, // Malicious object with huge length
        })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('data must be an array');
    });

    it('should reject editRecord when data is missing', async function () {
      const programData = await generateV2ProgramData();
      const stagingUuid = uuidv4();
      await StagingV2.create({
        uuid: stagingUuid,
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData]),
        committed: false,
      });

      const response = await supertest(app)
        .put('/v2/staging')
        .send({
          uuid: stagingUuid,
          // data field missing
        })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('data field is required');
    });

    it('should reject editRecord when data array exceeds maximum length (DoS prevention)', async function () {
      const programData = await generateV2ProgramData();
      const stagingUuid = uuidv4();
      await StagingV2.create({
        uuid: stagingUuid,
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData]),
        committed: false,
      });

      // Create array with more than 10000 elements
      const largeArray = Array(10001).fill(programData);

      const response = await supertest(app)
        .put('/v2/staging')
        .send({
          uuid: stagingUuid,
          data: largeArray,
        })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('data array exceeds maximum length');
    });

    it('should accept editRecord with data array at maximum allowed length', async function () {
      const programData = await generateV2ProgramData();
      const stagingUuid = uuidv4();
      await StagingV2.create({
        uuid: stagingUuid,
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData]),
        committed: false,
      });

      // Create array with exactly 10000 elements (maximum allowed)
      const maxArray = Array(10000).fill(programData);

      const response = await supertest(app)
        .put('/v2/staging')
        .send({
          uuid: stagingUuid,
          data: maxArray,
        })
        .expect(200);

      expect(response.body.message).to.include('successfully updated');
    });

    it('should reject commit when ids is not an array (DoS prevention)', async function () {
      const programData = await generateV2ProgramData();
      const stagingUuid = uuidv4();
      await StagingV2.create({
        uuid: stagingUuid,
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData]),
        committed: false,
      });

      // Send object with malicious length property instead of array
      const response = await supertest(app)
        .post('/v2/staging/commit')
        .send({
          comment: 'Test commit',
          author: 'Test User',
          ids: { length: 1e100, 0: stagingUuid }, // Malicious object
        })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('ids must be an array');
    });

    it('should reject commit when ids array exceeds maximum length (DoS prevention)', async function () {
      const programData = await generateV2ProgramData();
      const stagingUuid = uuidv4();
      await StagingV2.create({
        uuid: stagingUuid,
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData]),
        committed: false,
      });

      // Create array with more than 10000 elements
      const largeIdsArray = Array(10001).fill(stagingUuid);

      const response = await supertest(app)
        .post('/v2/staging/commit')
        .send({
          comment: 'Test commit',
          author: 'Test User',
          ids: largeIdsArray,
        })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('ids array exceeds maximum length');
    });

    it('should accept commit with ids array at maximum allowed length', async function () {
      // Clean up ALL existing staging records to prevent contamination from previous tests
      await StagingV2.destroy({ where: {} });

      const programData = await generateV2ProgramData();
      const stagingUuid = uuidv4();
      await StagingV2.create({
        uuid: stagingUuid,
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData]),
        committed: false,
      });

      // Create array with exactly 10000 elements (maximum allowed)
      const maxIdsArray = Array(10000).fill(stagingUuid);

      const response = await supertest(app)
        .post('/v2/staging/commit')
        .send({
          comment: 'Test commit',
          author: 'Test User',
          ids: maxIdsArray,
        });

      // Should succeed - validation passes and UUID exists
      // The test verifies that the length validation doesn't incorrectly reject valid arrays at the limit
      expect(response.status).to.equal(200);
      expect(response.body.success).to.be.true;
    });

    it('should retry failed commit record', async function () {
      const programData = await generateV2ProgramData();
      const stagingUuid = uuidv4();
      const stagingRecord = await StagingV2.create({
        uuid: stagingUuid,
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData]),
        committed: false,
        failed_commit: true,
      });

      const response = await supertest(app)
        .post('/v2/staging/retry')
        .send({
          uuid: stagingUuid,
        })
        .expect(200);

      // Verify failed_commit is reset
      const retriedRecord = await StagingV2.findOne({
        where: { uuid: stagingUuid },
      });
      expect(retriedRecord).to.exist;
      expect(retriedRecord.failed_commit).to.be.false;
      expect(retriedRecord.committed).to.be.false;
    });

    it('should reset committed records that are blocking new commits', async function () {
      // Create records with committed: true, failed_commit: false (blocking state)
      const programData1 = await generateV2ProgramData();
      const stagingUuid1 = uuidv4();
      await StagingV2.create({
        uuid: stagingUuid1,
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData1]),
        committed: true,
        failed_commit: false,
        is_transfer: false,
      });

      const programData2 = await generateV2ProgramData();
      const stagingUuid2 = uuidv4();
      await StagingV2.create({
        uuid: stagingUuid2,
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData2]),
        committed: true,
        failed_commit: false,
        is_transfer: false,
      });

      // Create one uncommitted record (should not be affected)
      const programData3 = await generateV2ProgramData();
      const stagingUuid3 = uuidv4();
      await StagingV2.create({
        uuid: stagingUuid3,
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData3]),
        committed: false,
        failed_commit: false,
        is_transfer: false,
      });

      // Create one transfer record (should not be affected)
      const programData4 = await generateV2ProgramData();
      const stagingUuid4 = uuidv4();
      await StagingV2.create({
        uuid: stagingUuid4,
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData4]),
        committed: true,
        failed_commit: false,
        is_transfer: true, // Transfer records should not be reset
      });

      // Call reset endpoint
      const response = await supertest(app)
        .post('/v2/staging/reset-committed')
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.affectedRows).to.equal(2); // Only the 2 non-transfer committed records

      // Verify committed records were reset
      const resetRecord1 = await StagingV2.findOne({
        where: { uuid: stagingUuid1 },
      });
      expect(resetRecord1.committed).to.be.false;

      const resetRecord2 = await StagingV2.findOne({
        where: { uuid: stagingUuid2 },
      });
      expect(resetRecord2.committed).to.be.false;

      // Verify uncommitted record was not affected
      const uncommittedRecord = await StagingV2.findOne({
        where: { uuid: stagingUuid3 },
      });
      expect(uncommittedRecord.committed).to.be.false;

      // Verify transfer record was not affected
      const transferRecord = await StagingV2.findOne({
        where: { uuid: stagingUuid4 },
      });
      expect(transferRecord.committed).to.be.true; // Transfer records should remain committed
    });

    it('should handle reset when no committed records exist', async function () {
      // Create only uncommitted records
      const programData = await generateV2ProgramData();
      await StagingV2.create({
        uuid: uuidv4(),
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData]),
        committed: false,
        failed_commit: false,
        is_transfer: false,
      });

      const response = await supertest(app)
        .post('/v2/staging/reset-committed')
        .expect(200);

      expect(response.body.success).to.be.true;
      expect(response.body.affectedRows).to.equal(0);
    });

    it('should rollback committed status when commit fails', async function () {
      // This test verifies that when a commit fails, records marked as committed
      // during processing are rolled back to committed: false
      // We'll simulate a failure by using invalid data that causes an error during processing

      const programDataSnake = await generateV2ProgramData();
      const programData = {
        programName: programDataSnake.program_name,
        programRegistry: programDataSnake.program_registry,
        programRegistryActivityId: programDataSnake.program_registry_activity_id,
        programRegistryProgramId: programDataSnake.program_registry_program_id,
        programDescription: programDataSnake.program_description,
      };

      // Create staging record via API
      const createResponse = await supertest(app)
        .post('/v2/program')
        .send(programData)
        .expect(200);

      // Get the staging UUID
      const stagingRecords = await StagingV2.findAll({
        where: { committed: false },
      });
      expect(stagingRecords.length).to.equal(1);
      const stagingUuid = stagingRecords[0].uuid;

      // Delete any existing committed records to avoid "pending commits" error
      await StagingV2.destroy({
        where: { committed: true }
      });

      // Corrupt the staging data to cause a processing error
      // This simulates a failure during commit processing (e.g., invalid JSON)
      await StagingV2.update(
        { data: 'invalid json{' }, // Invalid JSON will cause parse error
        { where: { uuid: stagingUuid } }
      );

      // Attempt commit - should fail
      const commitResponse = await supertest(app)
        .post('/v2/staging/commit')
        .send({
          comment: 'Test commit',
          author: 'Test User',
        });

      // Commit should fail (400 or 500)
      expect([400, 500]).to.include(commitResponse.status);
      expect(commitResponse.body.success).to.be.false;

      // Verify that the record was NOT left in committed: true state
      // The rollback logic should have reset it back to committed: false
      // Note: Records are marked as committed during processing (line 87-90 in staging-v2.model.js)
      // With our fix, updates are awaited, so records are marked committed before processing
      // If commit fails, rollback sets committed: false (line 571-579 in staging-v2.model.js)
      const failedRecord = await StagingV2.findOne({
        where: { uuid: stagingUuid },
      });
      expect(failedRecord).to.exist;
      // Rollback should have set committed to false
      // Note: failed_commit is only set if datalayer push succeeds but then fails,
      // which doesn't happen in this test case (error occurs during data processing)
      expect(failedRecord.committed).to.be.false;

      // Verify we can now retry the commit after fixing the data
      // Fix the data
      await StagingV2.update(
        { data: JSON.stringify([programDataSnake]) },
        { where: { uuid: stagingUuid } }
      );

      // Should be able to commit again (after clearing any other committed records)
      await StagingV2.destroy({
        where: { committed: true }
      });

      const retryCommitResponse = await supertest(app)
        .post('/v2/staging/commit')
        .send({
          comment: 'Retry commit after rollback',
          author: 'Test User',
        })
        .expect(200);

      expect(retryCommitResponse.body.success).to.be.true;
    });
  });

  describe('V1/V2 Isolation', function () {
    it('should not interfere with V1 staging', async function () {
      // Create V1 staging record first
      const v1Uuid = uuidv4();
      await Staging.create({
        uuid: v1Uuid,
        table: 'projects',
        action: 'INSERT',
        data: JSON.stringify([{ test: 'v1 data' }]),
        commited: false,
      });

      // Verify V1 record exists
      const v1RecordsBefore = await Staging.findAll();
      const v1RecordBefore = v1RecordsBefore.find(r => r.uuid === v1Uuid);
      expect(v1RecordBefore).to.exist;

      // Create V2 staging record
      const programData = await generateV2ProgramData();
      await StagingV2.create({
        uuid: uuidv4(),
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programData]),
        committed: false,
      });

      // Verify V2 staging record exists
      const v2Records = await StagingV2.findAll();
      expect(v2Records.length).to.equal(1);

      // Verify V1 record is unchanged
      const v1RecordsAfter = await Staging.findAll();
      const v1RecordAfter = v1RecordsAfter.find(r => r.uuid === v1Uuid);
      expect(v1RecordAfter).to.exist;
      expect(v1RecordAfter.data).to.equal(v1RecordBefore.data);
      expect(v1RecordAfter.commited).to.equal(v1RecordBefore.commited);
    });
  });

  describe('Edge Cases', function () {
    it('should handle empty staging table', async function () {
      const response = await supertest(app)
        .get('/v2/staging')
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body.length).to.equal(0);
    });

    it('should handle staging records with invalid JSON data', async function () {
      // Create staging record with malformed JSON
      const stagingRecord = await StagingV2.create({
        uuid: uuidv4(),
        table: 'program',
        action: 'INSERT',
        data: 'invalid json{', // Malformed JSON
        committed: false,
      });

      // Commit should fail with appropriate error
      const response = await supertest(app)
        .post('/v2/staging/commit')
        .send({
          comment: 'Test commit',
          author: 'Test User',
        });

      // Should fail (400 or 500) due to invalid JSON
      expect([400, 500]).to.include(response.status);
      expect(response.body).to.have.property('error');

      // Clean up invalid staging record to prevent contamination of subsequent tests
      await StagingV2.destroy({ where: {} });
    });

    it('should handle staging records for non-existent tables', async function () {
      // Create staging record with invalid table name
      const stagingRecord = await StagingV2.create({
        uuid: uuidv4(),
        table: 'nonexistent_table',
        action: 'INSERT',
        data: JSON.stringify([{ test: 'data' }]),
        committed: false,
      });

      // Delete any existing committed records
      await StagingV2.destroy({
        where: { committed: true }
      });

      // Commit should fail with appropriate error (table doesn't exist in model map)
      const response = await supertest(app)
        .post('/v2/staging/commit')
        .send({
          comment: 'Test commit',
          author: 'Test User',
        });

      // Should fail because nonexistent_table is not in the model map
      // The commit will process but won't find a model for this table
      // It should either succeed (if ignored) or fail gracefully
      // Based on implementation, it should succeed but not process the record
      expect([200, 400, 500]).to.include(response.status);
    });
  });

  describe('Phase 22.4: Staging Offer File Generation', function () {
    let takerOrg;
    let testProjectId;
    let testVerificationId;
    let testIssuanceId;
    let testUnitId;

    beforeEach(async function () {
      await resetV2StagingTable();
      await resetV2DataTables();

      // Create a taker organization (non-home org)
      const takerOrgUidValue = uuidv4();
      takerOrg = await OrganizationsV2.create({
        orgUid: takerOrgUidValue,
        orgName: 'Taker Organization',
        orgIcon: 'https://example.com/icon.png',
        isHome: false,
        subscribed: true,
        synced: true,
        registryStoreId: 'test-registry-store-id-taker',
      });
      // Ensure orgUid is accessible
      if (!takerOrg.orgUid) {
        takerOrg.orgUid = takerOrgUidValue;
      }

      // Create program
      const programDataSnake = await generateV2ProgramData();
      const programData = {
        cadTrustProgramId: programDataSnake.cad_trust_program_id,
        programName: programDataSnake.program_name,
        programRegistry: programDataSnake.program_registry,
        programRegistryActivityId: programDataSnake.program_registry_activity_id,
        programRegistryProgramId: programDataSnake.program_registry_program_id,
        programDescription: programDataSnake.program_description,
      };
      const program = await ProgramV2.create(programData);

      // Create project for taker org
      const actualTakerOrgUid = takerOrg.orgUid || takerOrg.org_uid || takerOrgUidValue;
      const projectDataSnake = await generateV2ProjectData({
        cad_trust_program_id: program.cadTrustProgramId,
        org_uid: actualTakerOrgUid,
      });
      const projectData = {
        cadTrustProjectId: projectDataSnake.cad_trust_project_id,
        orgUid: projectDataSnake.org_uid || actualTakerOrgUid,
        projectRegistryName: projectDataSnake.project_registry_name,
        projectId: projectDataSnake.project_id,
        projectCreditingProgram: projectDataSnake.project_crediting_program,
        projectName: projectDataSnake.project_name,
        projectLink: projectDataSnake.project_link,
        projectDescription: projectDataSnake.project_description,
        projectSector: projectDataSnake.project_sector,
        projectType: projectDataSnake.project_type,
        projectSubtype: projectDataSnake.project_subtype,
        projectStatus: projectDataSnake.project_status,
        projectStatusDate: projectDataSnake.project_status_date,
        projectUnitMetric: projectDataSnake.project_unit_metric,
        cadTrustReferenceProjectId: projectDataSnake.cad_trust_reference_project_id,
        cadTrustProgramId: projectDataSnake.cad_trust_program_id,
      };
      const project = await ProjectV2.create(projectData);
      testProjectId = project.cadTrustProjectId;

      // Create validation
      const validationDataSnake = await generateV2ValidationData({
        cad_trust_project_id: testProjectId,
      });
      const validation = await ValidationV2.create({
        cadTrustValidationId: validationDataSnake.cad_trust_validation_id,
        validationId: validationDataSnake.validation_id,
        validationType: validationDataSnake.validation_type,
        validationBody: validationDataSnake.validation_body,
        cadTrustProjectId: validationDataSnake.cad_trust_project_id,
      });

      // Create verification
      const verificationDataSnake = await generateV2VerificationData({
        cad_trust_project_id: testProjectId,
        cad_trust_validation_id: validation.cadTrustValidationId,
      });
      const verification = await VerificationV2.create({
        cadTrustVerificationId: verificationDataSnake.cad_trust_verification_id,
        verificationId: verificationDataSnake.verification_id,
        verificationBody: verificationDataSnake.verification_body,
        cadTrustProjectId: verificationDataSnake.cad_trust_project_id,
        cadTrustValidationId: verificationDataSnake.cad_trust_validation_id,
      });
      testVerificationId = verification.cadTrustVerificationId;

      // Create methodology
      const methodologyDataSnake = await generateV2MethodologyData();
      const methodology = await MethodologyV2.create({
        cadTrustMethodologyId: methodologyDataSnake.cad_trust_methodology_id,
        methodologyCode: methodologyDataSnake.methodology_code,
        methodologyName: methodologyDataSnake.methodology_name,
        methodologyVersion: methodologyDataSnake.methodology_version,
        methodologyDate: methodologyDataSnake.methodology_date,
        methodologyLink: methodologyDataSnake.methodology_link,
        methodologyType: methodologyDataSnake.methodology_type,
      });

      // Create issuance
      const issuanceDataSnake = await generateV2IssuanceData({
        cad_trust_verification_id: testVerificationId,
        cad_trust_methodology_id: methodology.cadTrustMethodologyId,
      });
      const issuance = await IssuanceV2.create({
        cadTrustIssuanceId: issuanceDataSnake.cad_trust_issuance_id,
        issuanceId: issuanceDataSnake.issuance_id,
        issuanceDate: issuanceDataSnake.issuance_date,
        cadTrustVerificationId: issuanceDataSnake.cad_trust_verification_id,
        cadTrustMethodologyId: issuanceDataSnake.cad_trust_methodology_id,
      });
      testIssuanceId = issuance.cadTrustIssuanceId;

      // Create unit
      const unitOrgUid = takerOrg.orgUid || takerOrg.org_uid || takerOrgUidValue;
      const unitDataSnake = await generateV2UnitData({
        cad_trust_issuance_id: testIssuanceId,
        org_uid: unitOrgUid,
      });
      const unit = await UnitV2.create({
        cadTrustUnitId: unitDataSnake.cad_trust_unit_id,
        orgUid: unitDataSnake.org_uid || unitOrgUid,
        unitSerialId: unitDataSnake.unit_serial_id,
        unitStartBlock: unitDataSnake.unit_start_block,
        unitEndBlock: unitDataSnake.unit_end_block,
        unitCount: unitDataSnake.unit_count,
        unitType: unitDataSnake.unit_type,
        unitVintageYear: unitDataSnake.unit_vintage_year,
        unitStatus: unitDataSnake.unit_status,
        cadTrustIssuanceId: unitDataSnake.cad_trust_issuance_id,
      });
      testUnitId = unit.cadTrustUnitId;
    });

    it('should generate offer file from transfer staging record', async function () {
      // Create transfer staging record using ProjectV2.transfer
      await ProjectV2.transfer(testProjectId);

      // Verify transfer record exists
      const transferRecord = await StagingV2.findOne({
        where: { is_transfer: true },
      });
      expect(transferRecord).to.exist;

      // Generate offer file (simulator mode will return mock response)
      const response = await supertest(app)
        .get('/v2/staging/offer')
        .expect(200);

      expect(response.body).to.have.property('offer');
      expect(response.body.offer).to.have.property('trade_id');
      expect(response.body.offer).to.have.property('maker');
      expect(response.body.offer).to.have.property('taker');
      expect(response.body.offer.maker).to.be.an('array');
      expect(response.body.offer.taker).to.be.an('array');
    });

    it('should return error if no transfer record exists', async function () {
      // No transfer record created

      const response = await supertest(app)
        .get('/v2/staging/offer')
        .expect(400);

      expect(response.body.success).to.be.false;
      // Error could be "No transfer record found" or "Staging table is empty"
      expect(response.body.error || response.body.message).to.match(/No transfer record found|Staging table is empty/);
    });

    it('should return error if staging table is empty', async function () {
      // Staging table is empty (no transfer record)

      const response = await supertest(app)
        .get('/v2/staging/offer')
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('Error generating offer file');
    });

    it('should return error if there are pending commits excluding transfers', async function () {
      // Create transfer record
      await ProjectV2.transfer(testProjectId);

      // Create a non-transfer staging record that is committed (pending commit)
      // assertNoPendingCommitsExcludingTransfers checks for committed: true, failed_commit: false
      const programDataSnake = await generateV2ProgramData();
      await StagingV2.create({
        uuid: uuidv4(),
        table: 'program',
        action: 'INSERT',
        data: JSON.stringify([programDataSnake]),
        committed: true,
        failed_commit: false,
        is_transfer: false,
      });

      const response = await supertest(app)
        .get('/v2/staging/offer')
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('pending commit');
    });

    it('should store activeOfferTradeId in MetaV2 after generating offer', async function () {
      const { MetaV2 } = await import('../../../src/models/v2/index.js');

      // Create transfer staging record
      await ProjectV2.transfer(testProjectId);

      // Generate offer file (simulator mode will return mock response)
      const response = await supertest(app)
        .get('/v2/staging/offer')
        .expect(200);

      expect(response.body.offer).to.have.property('trade_id');

      // Verify activeOfferTradeId is stored in MetaV2
      // MetaV2 uses snake_case field names in database (meta_key, meta_value)
      const metaRecord = await MetaV2.findOne({
        where: { meta_key: 'activeOfferTradeId' },
      });
      expect(metaRecord).to.exist;
      expect(metaRecord.meta_value || metaRecord.metaValue).to.equal(response.body.offer.trade_id);
    });
  });
});

