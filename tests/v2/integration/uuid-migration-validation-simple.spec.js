import { expect } from 'chai';
import { v4 as uuidv4 } from 'uuid';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { sequelizeV2 } from '../../../src/database/v2/index.js';
import {
  ProgramV2,
  ProjectV2,
  ValidationV2,
  VerificationV2,
  IssuanceV2,
  UnitV2,
  LocationV2,
  MethodologyV2,
} from '../../../src/models/v2/index.js';
import {
  resetV2StagingTable,
  resetV2DataTables,
  createV2TestHomeOrg,
  getV2HomeOrgId,
} from '../utils/v2-test-helpers.js';

describe('V2 UUID Migration Validation Tests - Simplified', function () {
  this.timeout(30000);

  before(async function () {
    console.log('Setting up V2 UUID validation test environment...');
    await prepareV2Db();
    // Create test home organization
    await createV2TestHomeOrg();
  });

  after(async function () {
    console.log('Cleaning up V2 UUID validation test environment...');
    // Cleanup handled by test framework
  });

  beforeEach(async function () {
    await resetV2StagingTable();
    await resetV2DataTables();
  });

  describe('Database Schema UUID Validation', function () {
    it('should have all data tables with TEXT primary keys', async function () {
      const dataTables = ['program', 'project', 'validation', 'verification', 'issuance', 'unit', 'location', 'methodology'];

      for (const tableName of dataTables) {
        const [results] = await sequelizeV2.query(`PRAGMA table_info(${tableName})`);
        const primaryKeyColumn = results.find(col => col.pk === 1);

        expect(primaryKeyColumn).to.exist;
        expect(primaryKeyColumn.type).to.be.oneOf(['TEXT', 'VARCHAR(255)', 'UUID']); // SQLite uses TEXT for UUIDs
        expect(primaryKeyColumn.notnull).to.equal(1);
        expect(primaryKeyColumn.pk).to.equal(1);
      }
    });

    it('should have system tables with INTEGER primary keys', async function () {
      const systemTables = ['staging', 'audit', 'organizations', 'meta', 'governance', 'simulator'];

      for (const tableName of systemTables) {
        const [results] = await sequelizeV2.query(`PRAGMA table_info(${tableName})`);
        const primaryKeyColumn = results.find(col => col.pk === 1);

        expect(primaryKeyColumn).to.exist;
        expect(primaryKeyColumn.type).to.equal('INTEGER');
        expect(primaryKeyColumn.pk).to.equal(1);
      }
    });
  });

  describe('Model UUID Generation', function () {
    it('should accept valid UUIDs for ProgramV2', async function () {
      const testUuid = uuidv4();
      const program = await ProgramV2.create({
        cadTrustProgramId: testUuid,
        programName: 'Test Program',
        programRegistry: 'Test Registry',
        programRegistryActivityId: 'TEST-001',
      });

      expect(program.cadTrustProgramId).to.equal(testUuid);
      expect(program.cadTrustProgramId).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(program.cadTrustProgramId).to.have.length(36);
    });

    it('should accept valid UUIDs for MethodologyV2', async function () {
      const testUuid = uuidv4();
      const methodology = await MethodologyV2.create({
        cadTrustMethodologyId: testUuid,
        methodologyCode: 'TEST-METHOD-001',
        methodologyName: 'Test Methodology',
        methodologyType: 'Methodology for Afforestation and Reforestation',
      });

      expect(methodology.cadTrustMethodologyId).to.equal(testUuid);
      expect(methodology.cadTrustMethodologyId).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(methodology.cadTrustMethodologyId).to.have.length(36);
    });

    it('should accept valid UUIDs for ProjectV2 with foreign key', async function () {
      const programUuid = uuidv4();
      const projectUuid = uuidv4();
      const homeOrgId = await getV2HomeOrgId();

      const program = await ProgramV2.create({
        cadTrustProgramId: programUuid,
        programName: 'Test Program',
        programRegistry: 'Test Registry',
        programRegistryActivityId: 'TEST-001',
      });

      const project = await ProjectV2.create({
        cadTrustProjectId: projectUuid,
        orgUid: homeOrgId,
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-PROJECT-001',
        projectName: 'Test Project',
        projectSector: ['Agriculture'],
        cadTrustProgramId: program.cadTrustProgramId,
      });

      expect(project.cadTrustProjectId).to.equal(projectUuid);
      expect(project.cadTrustProjectId).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(project.cadTrustProjectId).to.have.length(36);
      expect(project.cadTrustProgramId).to.equal(programUuid);
    });
  });

  describe('Foreign Key UUID Consistency', function () {
    it('should use UUID strings for all foreign key references', async function () {
      const programUuid = uuidv4();
      const projectUuid = uuidv4();
      const homeOrgId = await getV2HomeOrgId();

      const program = await ProgramV2.create({
        cadTrustProgramId: programUuid,
        programName: 'Test Program',
        programRegistry: 'Test Registry',
        programRegistryActivityId: 'TEST-001',
      });

      const project = await ProjectV2.create({
        cadTrustProjectId: projectUuid,
        orgUid: homeOrgId,
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-PROJECT-001',
        projectName: 'Test Project',
        projectSector: ['Agriculture'],
        cadTrustProgramId: program.cadTrustProgramId,
      });

      // Verify foreign key is UUID string
      expect(project.cadTrustProgramId).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(project.cadTrustProgramId).to.equal(program.cadTrustProgramId);
    });
  });

  describe('UUID Uniqueness Validation', function () {
    it('should generate unique UUIDs for multiple records', async function () {
      const programs = [];

      for (let i = 0; i < 5; i++) {
        const program = await ProgramV2.create({
          cadTrustProgramId: uuidv4(),
          programName: `Test Program ${i}`,
          programRegistry: 'Test Registry',
          programRegistryActivityId: `TEST-${i}`,
        });
        programs.push(program);
      }

      const uuids = programs.map(p => p.cadTrustProgramId);
      const uniqueUuids = new Set(uuids);

      expect(uniqueUuids.size).to.equal(uuids.length);
      expect(uuids).to.have.length(5);
    });

    it('should generate unique UUIDs across different model types', async function () {
      const programUuid = uuidv4();
      const methodologyUuid = uuidv4();

      const program = await ProgramV2.create({
        cadTrustProgramId: programUuid,
        programName: 'Test Program',
        programRegistry: 'Test Registry',
        programRegistryActivityId: 'TEST-001',
      });

      const methodology = await MethodologyV2.create({
        cadTrustMethodologyId: methodologyUuid,
        methodologyCode: 'TEST-METHOD-001',
        methodologyName: 'Test Methodology',
        methodologyType: 'Methodology for Afforestation and Reforestation',
      });

      expect(program.cadTrustProgramId).to.not.equal(methodology.cadTrustMethodologyId);
      expect(program.cadTrustProgramId).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(methodology.cadTrustMethodologyId).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });
});
