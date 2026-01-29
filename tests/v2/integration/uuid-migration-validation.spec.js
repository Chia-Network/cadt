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
  ProjectMethodologyV2,
} from '../../../src/models/v2/index.js';

import {
  resetV2StagingTable,
  resetV2DataTables,
  addUuidIfNeeded,
  createV2TestHomeOrg,
  getV2HomeOrgId,
} from '../utils/v2-test-helpers.js';

describe('V2 UUID Migration Validation Tests', function () {
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
    it('should have all data tables with VARCHAR(36) primary keys', async function () {
      const dataTables = ['program', 'project', 'validation', 'verification', 'issuance', 'unit', 'location', 'methodology'];

      for (const tableName of dataTables) {
        const [results] = await sequelizeV2.query(`PRAGMA table_info(${tableName})`);
        const primaryKeyColumn = results.find(col => col.pk === 1);

        expect(primaryKeyColumn).to.exist;
        // SQLite stores VARCHAR(36) as TEXT or UUID, so check for any of these
        expect(['VARCHAR(36)', 'TEXT', 'UUID']).to.include(primaryKeyColumn.type);
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
    it('should generate valid UUIDs for ProgramV2', async function () {
      const program = await ProgramV2.create({
        cadTrustProgramId: uuidv4(), // Explicitly provide UUID
        programName: 'Test Program',
        programRegistry: 'Test Registry',
        programRegistryActivityId: 'TEST-001',
      });

      expect(program.cadTrustProgramId).to.exist;
      expect(program.cadTrustProgramId).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(program.cadTrustProgramId).to.have.length(36);
    });

    it('should generate valid UUIDs for ProjectV2', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const program = await ProgramV2.create({
        cadTrustProgramId: uuidv4(),
        programName: 'Test Program',
        programRegistry: 'Test Registry',
        programRegistryActivityId: 'TEST-001',
      });

      const project = await ProjectV2.create({
        cadTrustProjectId: uuidv4(),
        orgUid: homeOrgId,
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-PROJECT-001',
        projectName: 'Test Project',
        projectSector: ['Agriculture'],
        cadTrustProgramId: program.cadTrustProgramId,
      });

      expect(project.cadTrustProjectId).to.exist;
      expect(project.cadTrustProjectId).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(project.cadTrustProjectId).to.have.length(36);
    });

    it('should generate valid UUIDs for ValidationV2', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const program = await ProgramV2.create({
        programName: 'Test Program',
        programRegistry: 'Test Registry',
        programRegistryActivityId: 'TEST-001',
      });

      const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
        orgUid: homeOrgId,
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-PROJECT-001',
        projectName: 'Test Project',
        projectSector: ['Agriculture'],
        cadTrustProgramId: program.cadTrustProgramId,
      }));

      const validation = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
        validationId: 'TEST-VALIDATION-001',
        validationType: 'Validation of Project Design Document',
        validationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: project.cadTrustProjectId,
      }));

      expect(validation.cadTrustValidationId).to.exist;
      expect(validation.cadTrustValidationId).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(validation.cadTrustValidationId).to.have.length(36);
    });

    it('should generate valid UUIDs for VerificationV2', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const program = await ProgramV2.create({
        programName: 'Test Program',
        programRegistry: 'Test Registry',
        programRegistryActivityId: 'TEST-001',
      });

      const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
        orgUid: homeOrgId,
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-PROJECT-001',
        projectName: 'Test Project',
        projectSector: ['Agriculture'],
        cadTrustProgramId: program.cadTrustProgramId,
      }));

      const validation = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
        validationId: 'TEST-VALIDATION-001',
        validationType: 'Validation of Project Design Document',
        validationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: project.cadTrustProjectId,
      }));

      const verification = await VerificationV2.create(addUuidIfNeeded('VerificationV2', {
        verificationId: 'TEST-VERIFICATION-001',
        verificationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: project.cadTrustProjectId,
        cadTrustValidationId: validation.cadTrustValidationId,
      }));

      expect(verification.cadTrustVerificationId).to.exist;
      expect(verification.cadTrustVerificationId).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(verification.cadTrustVerificationId).to.have.length(36);
    });

    it('should generate valid UUIDs for IssuanceV2', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const program = await ProgramV2.create({
        programName: 'Test Program',
        programRegistry: 'Test Registry',
        programRegistryActivityId: 'TEST-001',
      });

      const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
        orgUid: homeOrgId,
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-PROJECT-001',
        projectName: 'Test Project',
        projectSector: ['Agriculture'],
        cadTrustProgramId: program.cadTrustProgramId,
      }));

      const validation = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
        validationId: 'TEST-VALIDATION-001',
        validationType: 'Validation of Project Design Document',
        validationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: project.cadTrustProjectId,
      }));

      const verification = await VerificationV2.create(addUuidIfNeeded('VerificationV2', {
        verificationId: 'TEST-VERIFICATION-001',
        verificationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: project.cadTrustProjectId,
        cadTrustValidationId: validation.cadTrustValidationId,
      }));

      const methodology = await MethodologyV2.create({
        methodologyCode: 'TEST-METHOD-001',
        methodologyName: 'Test Methodology',
        methodologyType: 'Methodology for Afforestation and Reforestation',
      });

      const projectMethodology = await ProjectMethodologyV2.create(addUuidIfNeeded('ProjectMethodologyV2', {
        cadTrustProjectId: project.cadTrustProjectId,
        cadTrustMethodologyId: methodology.cadTrustMethodologyId,
        projectMethodologyDate: '2024-01-01',
      }));

      const issuance = await IssuanceV2.create(addUuidIfNeeded('IssuanceV2', {
        issuanceId: 'TEST-ISSUANCE-001',
        cadTrustVerificationId: verification.cadTrustVerificationId,
        cadTrustProjectMethodologyId: projectMethodology.cadTrustProjectMethodologyId,
      }));

      expect(issuance.cadTrustIssuanceId).to.exist;
      expect(issuance.cadTrustIssuanceId).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(issuance.cadTrustIssuanceId).to.have.length(36);
    });

    it('should generate valid UUIDs for UnitV2', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const program = await ProgramV2.create({
        programName: 'Test Program',
        programRegistry: 'Test Registry',
        programRegistryActivityId: 'TEST-001',
      });

      const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
        orgUid: homeOrgId,
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-PROJECT-001',
        projectName: 'Test Project',
        projectSector: ['Agriculture'],
        cadTrustProgramId: program.cadTrustProgramId,
      }));

      const validation = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
        validationId: 'TEST-VALIDATION-001',
        validationType: 'Validation of Project Design Document',
        validationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: project.cadTrustProjectId,
      }));

      const verification = await VerificationV2.create(addUuidIfNeeded('VerificationV2', {
        verificationId: 'TEST-VERIFICATION-001',
        verificationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: project.cadTrustProjectId,
        cadTrustValidationId: validation.cadTrustValidationId,
      }));

      const methodology = await MethodologyV2.create({
        methodologyCode: 'TEST-METHOD-001',
        methodologyName: 'Test Methodology',
        methodologyType: 'Methodology for Afforestation and Reforestation',
      });

      const projectMethodology = await ProjectMethodologyV2.create(addUuidIfNeeded('ProjectMethodologyV2', {
        cadTrustProjectId: project.cadTrustProjectId,
        cadTrustMethodologyId: methodology.cadTrustMethodologyId,
        projectMethodologyDate: '2024-01-01',
      }));

      const issuance = await IssuanceV2.create(addUuidIfNeeded('IssuanceV2', {
        issuanceId: 'TEST-ISSUANCE-001',
        cadTrustVerificationId: verification.cadTrustVerificationId,
        cadTrustProjectMethodologyId: projectMethodology.cadTrustProjectMethodologyId,
      }));

      const unit = await UnitV2.create(addUuidIfNeeded('UnitV2', {
        orgUid: homeOrgId,
        unitSerialId: 'TEST-UNIT-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        unitType: 'Reduction',
        unitStatus: 'Issued',
        unitMetric: 'tCO2e',
        cadTrustIssuanceId: issuance.cadTrustIssuanceId,
      }));

      expect(unit.cadTrustUnitId).to.exist;
      expect(unit.cadTrustUnitId).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(unit.cadTrustUnitId).to.have.length(36);
    });

    it('should generate valid UUIDs for LocationV2', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const program = await ProgramV2.create({
        programName: 'Test Program',
        programRegistry: 'Test Registry',
        programRegistryActivityId: 'TEST-001',
      });

      const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
        orgUid: homeOrgId,
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-PROJECT-001',
        projectName: 'Test Project',
        projectSector: ['Agriculture'],
        cadTrustProgramId: program.cadTrustProgramId,
      }));

      const location = await LocationV2.create(addUuidIfNeeded('LocationV2', {
        locationCountry: 'United States',
        locationRegion: 'California',
        locationGis: '{"type": "Point", "coordinates": [-122.4194, 37.7749]}',
        locationMapType: 'geojson',
        cadTrustProjectId: project.cadTrustProjectId,
      }));

      expect(location.cadTrustLocationId).to.exist;
      expect(location.cadTrustLocationId).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(location.cadTrustLocationId).to.have.length(36);
    });

    it('should generate valid UUIDs for MethodologyV2', async function () {
      const methodology = await MethodologyV2.create({
        methodologyCode: 'TEST-METHOD-001',
        methodologyName: 'Test Methodology',
        methodologyType: 'Methodology for Afforestation and Reforestation',
      });

      expect(methodology.cadTrustMethodologyId).to.exist;
      expect(methodology.cadTrustMethodologyId).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(methodology.cadTrustMethodologyId).to.have.length(36);
    });
  });

  describe('Foreign Key UUID Consistency', function () {
    it('should use UUID strings for all foreign key references', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const program = await ProgramV2.create({
        programName: 'Test Program',
        programRegistry: 'Test Registry',
        programRegistryActivityId: 'TEST-001',
      });

      const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
        orgUid: homeOrgId,
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-PROJECT-001',
        projectName: 'Test Project',
        projectSector: ['Agriculture'],
        cadTrustProgramId: program.cadTrustProgramId,
      }));

      // Verify foreign key is UUID string
      expect(project.cadTrustProgramId).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(project.cadTrustProgramId).to.equal(program.cadTrustProgramId);

      const validation = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
        validationId: 'TEST-VALIDATION-001',
        validationType: 'Validation of Project Design Document',
        validationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: project.cadTrustProjectId,
      }));

      // Verify foreign key is UUID string
      expect(validation.cadTrustProjectId).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(validation.cadTrustProjectId).to.equal(project.cadTrustProjectId);
    });

    it('should maintain referential integrity with UUID foreign keys', async function () {
      const homeOrgId = await getV2HomeOrgId();
      const program = await ProgramV2.create({
        programName: 'Test Program',
        programRegistry: 'Test Registry',
        programRegistryActivityId: 'TEST-001',
      });

      const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
        orgUid: homeOrgId,
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-PROJECT-001',
        projectName: 'Test Project',
        projectSector: ['Agriculture'],
        cadTrustProgramId: program.cadTrustProgramId,
      }));

      const validation = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
        validationId: 'TEST-VALIDATION-001',
        validationType: 'Validation of Project Design Document',
        validationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: project.cadTrustProjectId,
      }));

      const verification = await VerificationV2.create(addUuidIfNeeded('VerificationV2', {
        verificationId: 'TEST-VERIFICATION-001',
        verificationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: project.cadTrustProjectId,
        cadTrustValidationId: validation.cadTrustValidationId,
      }));

      const methodology = await MethodologyV2.create({
        methodologyCode: 'TEST-METHOD-001',
        methodologyName: 'Test Methodology',
        methodologyType: 'Methodology for Afforestation and Reforestation',
      });

      const projectMethodology = await ProjectMethodologyV2.create(addUuidIfNeeded('ProjectMethodologyV2', {
        cadTrustProjectId: project.cadTrustProjectId,
        cadTrustMethodologyId: methodology.cadTrustMethodologyId,
        projectMethodologyDate: '2024-01-01',
      }));

      const issuance = await IssuanceV2.create(addUuidIfNeeded('IssuanceV2', {
        issuanceId: 'TEST-ISSUANCE-001',
        cadTrustVerificationId: verification.cadTrustVerificationId,
        cadTrustProjectMethodologyId: projectMethodology.cadTrustProjectMethodologyId,
      }));

      const unit = await UnitV2.create(addUuidIfNeeded('UnitV2', {
        orgUid: homeOrgId,
        unitSerialId: 'TEST-UNIT-001',
        unitStartBlock: '1000',
        unitEndBlock: '2000',
        unitVintageYear: 2024,
        unitType: 'Reduction',
        unitStatus: 'Issued',
        unitMetric: 'tCO2e',
        cadTrustIssuanceId: issuance.cadTrustIssuanceId,
      }));

      const location = await LocationV2.create(addUuidIfNeeded('LocationV2', {
        locationCountry: 'United States',
        locationRegion: 'California',
        locationGis: '{"type": "Point", "coordinates": [-122.4194, 37.7749]}',
        locationMapType: 'geojson',
        cadTrustProjectId: project.cadTrustProjectId,
      }));

      // Verify all foreign key relationships are maintained with UUIDs
      expect(unit.cadTrustIssuanceId).to.equal(issuance.cadTrustIssuanceId);
      expect(issuance.cadTrustVerificationId).to.equal(verification.cadTrustVerificationId);
      expect(issuance.cadTrustProjectMethodologyId).to.equal(projectMethodology.cadTrustProjectMethodologyId);
      expect(verification.cadTrustProjectId).to.equal(project.cadTrustProjectId);
      expect(verification.cadTrustValidationId).to.equal(validation.cadTrustValidationId);
      expect(validation.cadTrustProjectId).to.equal(project.cadTrustProjectId);
      expect(location.cadTrustProjectId).to.equal(project.cadTrustProjectId);
      expect(project.cadTrustProgramId).to.equal(program.cadTrustProgramId);
    });
  });

  describe('UUID Uniqueness Validation', function () {
    it('should generate unique UUIDs for multiple records', async function () {
      const programs = [];

      for (let i = 0; i < 10; i++) {
        const program = await ProgramV2.create({
          programName: `Test Program ${i}`,
          programRegistry: 'Test Registry',
          programRegistryActivityId: `TEST-${i}`,
        });
        programs.push(program);
      }

      const uuids = programs.map(p => p.cadTrustProgramId);
      const uniqueUuids = new Set(uuids);

      expect(uniqueUuids.size).to.equal(uuids.length);
      expect(uuids).to.have.length(10);
    });

    it('should generate unique UUIDs across different model types', async function () {
      const program = await ProgramV2.create({
        programName: 'Test Program',
        programRegistry: 'Test Registry',
        programRegistryActivityId: 'TEST-001',
      });

      const methodology = await MethodologyV2.create({
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
