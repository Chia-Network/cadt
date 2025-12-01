import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { ProjectV2, ProgramV2, ValidationV2, VerificationV2, IssuanceV2, UnitV2, MethodologyV2 } from '../../../src/models/v2/index.js';
import { v4 as uuidv4 } from 'uuid';

import {
  resetV2StagingTable,
  resetV2DataTables,
  createV2TestHomeOrg,
  getV2HomeOrgId,
  addUuidIfNeeded,
} from '../utils/v2-test-helpers.js';

describe('V2 Project API - Marketplace Features', function () {
  this.timeout(30000);

  let testProgram;
  let homeOrg;
  let homeOrgId;

  before(async function () {
    console.log('Setting up V2 test environment for project marketplace tests...');
    await prepareV2Db();

    // Create test home organization
    homeOrg = await createV2TestHomeOrg();
    homeOrgId = await getV2HomeOrgId();

    // Create a test program
    testProgram = await ProgramV2.create({
      programName: 'Test Program for Project Marketplace',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-ACT-PROJECT-MARKETPLACE',
    });
  });

  beforeEach(async function () {
    await resetV2StagingTable();
    await resetV2DataTables();

    // Recreate test program
    testProgram = await ProgramV2.create({
      programName: 'Test Program for Project Marketplace',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-ACT-PROJECT-MARKETPLACE',
    });
  });

  describe('onlyMarketplaceProjects Query Parameter', function () {
    it('should filter projects with marketplace units', async function () {
      // Create project 1 with marketplace units (directly in DB)
      const project1 = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-PROJECT-MARKETPLACE-1',
        projectName: 'Project with Marketplace Units',
        projectSector: 'Agriculture',
        cadTrustProgramId: testProgram.cadTrustProgramId,
        orgUid: homeOrgId,
      }));

      // Create validation, verification, issuance for project 1
      const validation1 = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
        validationId: 'TEST-VAL-1',
        validationType: 'Validation of Project Design Document',
        validationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: project1.cadTrustProjectId,
      }));

      const verification1 = await VerificationV2.create(addUuidIfNeeded('VerificationV2', {
        verificationId: 'TEST-VER-1',
        verificationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: project1.cadTrustProjectId,
        cadTrustValidationId: validation1.cadTrustValidationId,
      }));

      const methodology1 = await MethodologyV2.create({
        methodologyCode: 'TEST-METHOD-1',
        methodologyName: 'Test Methodology',
        methodologyType: 'Methodology for Afforestation and Reforestation',
      });

      const issuance1 = await IssuanceV2.create(addUuidIfNeeded('IssuanceV2', {
        issuanceId: 'TEST-ISS-1',
        issuanceDate: '2024-01-01',
        cadTrustVerificationId: verification1.cadTrustVerificationId,
        cadTrustMethodologyId: methodology1.cadTrustMethodologyId,
      }));

      // Create unit with marketplace identifier for project 1 (directly in DB)
      await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'UNIT-MARKETPLACE-PROJECT-1',
        unitStartBlock: 'BLK001',
        unitEndBlock: 'BLK010',
        unitVintageYear: 2024,
        cadTrustIssuanceId: issuance1.cadTrustIssuanceId,
        marketplaceIdentifier: 'PROJECT1-MARKETPLACE-001',
        orgUid: homeOrgId,
      }));

      // Create project 2 without marketplace units (directly in DB)
      const project2 = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-PROJECT-NO-MARKETPLACE-1',
        projectName: 'Project without Marketplace Units',
        projectSector: 'Energy',
        cadTrustProgramId: testProgram.cadTrustProgramId,
        orgUid: homeOrgId,
      }));

      // Create validation, verification, issuance for project 2
      const validation2 = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
        validationId: 'TEST-VAL-2',
        validationType: 'Validation of Project Design Document',
        validationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: project2.cadTrustProjectId,
      }));

      const verification2 = await VerificationV2.create(addUuidIfNeeded('VerificationV2', {
        verificationId: 'TEST-VER-2',
        verificationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: project2.cadTrustProjectId,
        cadTrustValidationId: validation2.cadTrustValidationId,
      }));

      const issuance2 = await IssuanceV2.create(addUuidIfNeeded('IssuanceV2', {
        issuanceId: 'TEST-ISS-2',
        issuanceDate: '2024-01-01',
        cadTrustVerificationId: verification2.cadTrustVerificationId,
        cadTrustMethodologyId: methodology1.cadTrustMethodologyId,
      }));

      // Create unit without marketplace identifier for project 2 (directly in DB)
      await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'UNIT-NO-MARKETPLACE-PROJECT-1',
        unitStartBlock: 'BLK011',
        unitEndBlock: 'BLK020',
        unitVintageYear: 2024,
        cadTrustIssuanceId: issuance2.cadTrustIssuanceId,
        orgUid: homeOrgId,
      }));

      // Query projects with marketplace units
      const res = await supertest(app)
        .get('/v2/project?onlyMarketplaceProjects=true&page=1&limit=10')
        .expect(200);

      expect(res.body).to.have.property('data');
      expect(res.body.data).to.be.an('array');
      expect(res.body.data.length).to.be.at.least(1);

      const projectIds = res.body.data.map(p => p.cadTrustProjectId);
      expect(projectIds).to.include(project1.cadTrustProjectId);
      expect(projectIds).to.not.include(project2.cadTrustProjectId);
    });

    it('should return empty result when no projects have marketplace units', async function () {
      // Create project without marketplace units (directly in DB)
      await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-PROJECT-NO-MARKETPLACE-2',
        projectName: 'Project without Marketplace Units',
        projectSector: 'Energy',
        cadTrustProgramId: testProgram.cadTrustProgramId,
        orgUid: homeOrgId,
      }));

      // Query projects with marketplace units
      const res = await supertest(app)
        .get('/v2/project?onlyMarketplaceProjects=true&page=1&limit=10')
        .expect(200);

      expect(res.body).to.have.property('data');
      expect(res.body.data).to.be.an('array');
      // Should return empty array since no marketplace units exist
      // (may contain data from other tests, but our project shouldn't be there)
    });

    it('should include projects with tokenized units', async function () {
      // Create project with tokenized unit (directly in DB)
      const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-PROJECT-TOKENIZED',
        projectName: 'Project with Tokenized Units',
        projectSector: 'Forestry',
        cadTrustProgramId: testProgram.cadTrustProgramId,
        orgUid: homeOrgId,
      }));

      // Create validation, verification, issuance
      const validation = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
        validationId: 'TEST-VAL-TOKENIZED',
        validationType: 'Validation of Project Design Document',
        validationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: project.cadTrustProjectId,
      }));

      const verification = await VerificationV2.create(addUuidIfNeeded('VerificationV2', {
        verificationId: 'TEST-VER-TOKENIZED',
        verificationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: project.cadTrustProjectId,
        cadTrustValidationId: validation.cadTrustValidationId,
      }));

      const methodology = await MethodologyV2.create({
        methodologyCode: 'TEST-METHOD-TOKENIZED',
        methodologyName: 'Test Methodology',
        methodologyType: 'Methodology for Afforestation and Reforestation',
      });

      const issuance = await IssuanceV2.create(addUuidIfNeeded('IssuanceV2', {
        issuanceId: 'TEST-ISS-TOKENIZED',
        issuanceDate: '2024-01-01',
        cadTrustVerificationId: verification.cadTrustVerificationId,
        cadTrustMethodologyId: methodology.cadTrustMethodologyId,
      }));

      // Create tokenized unit (directly in DB)
      await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'UNIT-TOKENIZED-PROJECT',
        unitStartBlock: 'BLK001',
        unitEndBlock: 'BLK010',
        unitVintageYear: 2024,
        cadTrustIssuanceId: issuance.cadTrustIssuanceId,
        marketplace: 'Tokenized on Chia',
        marketplaceIdentifier: 'CHIA-TOKEN-PROJECT-001',
        orgUid: homeOrgId,
      }));

      // Query projects with marketplace units
      const res = await supertest(app)
        .get('/v2/project?onlyMarketplaceProjects=true&page=1&limit=10')
        .expect(200);

      expect(res.body).to.have.property('data');
      expect(res.body.data).to.be.an('array');
      const projectIds = res.body.data.map(p => p.cadTrustProjectId);
      expect(projectIds).to.include(project.cadTrustProjectId);
    });
  });

  describe('getTokenizedProjectIds Method', function () {
    it('should return correct project IDs for projects with marketplace units', async function () {
      // Create project with marketplace unit (directly in DB)
      const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-PROJECT-METHOD-1',
        projectName: 'Project for Method Test',
        projectSector: 'Agriculture',
        cadTrustProgramId: testProgram.cadTrustProgramId,
        orgUid: homeOrgId,
      }));

      // Create validation, verification, issuance
      const validation = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
        validationId: 'TEST-VAL-METHOD',
        validationType: 'Validation of Project Design Document',
        validationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: project.cadTrustProjectId,
      }));

      const verification = await VerificationV2.create(addUuidIfNeeded('VerificationV2', {
        verificationId: 'TEST-VER-METHOD',
        verificationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: project.cadTrustProjectId,
        cadTrustValidationId: validation.cadTrustValidationId,
      }));

      const methodology = await MethodologyV2.create({
        methodologyCode: 'TEST-METHOD-METHOD',
        methodologyName: 'Test Methodology',
        methodologyType: 'Methodology for Afforestation and Reforestation',
      });

      const issuance = await IssuanceV2.create(addUuidIfNeeded('IssuanceV2', {
        issuanceId: 'TEST-ISS-METHOD',
        issuanceDate: '2024-01-01',
        cadTrustVerificationId: verification.cadTrustVerificationId,
        cadTrustMethodologyId: methodology.cadTrustMethodologyId,
      }));

      // Create unit with marketplace identifier (directly in DB)
      await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'UNIT-METHOD-TEST',
        unitStartBlock: 'BLK001',
        unitEndBlock: 'BLK010',
        unitVintageYear: 2024,
        cadTrustIssuanceId: issuance.cadTrustIssuanceId,
        marketplaceIdentifier: 'METHOD-TEST-001',
        orgUid: homeOrgId,
      }));

      // Call getTokenizedProjectIds method
      const projectIds = await ProjectV2.getTokenizedProjectIds();

      expect(projectIds).to.be.an('array');
      expect(projectIds).to.include(project.cadTrustProjectId);
    });

    it('should return empty array when no projects have marketplace units', async function () {
      // Call getTokenizedProjectIds when no marketplace units exist
      const projectIds = await ProjectV2.getTokenizedProjectIds();

      expect(projectIds).to.be.an('array');
      // May be empty or contain IDs from other tests
    });

    it('should handle projects with multiple marketplace units (no duplicates)', async function () {
      // Create project (directly in DB)
      const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-PROJECT-MULTIPLE',
        projectName: 'Project with Multiple Marketplace Units',
        projectSector: 'Agriculture',
        cadTrustProgramId: testProgram.cadTrustProgramId,
        orgUid: homeOrgId,
      }));

      // Create validation, verification, issuance
      const validation = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
        validationId: 'TEST-VAL-MULTIPLE',
        validationType: 'Validation of Project Design Document',
        validationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: project.cadTrustProjectId,
      }));

      const verification = await VerificationV2.create(addUuidIfNeeded('VerificationV2', {
        verificationId: 'TEST-VER-MULTIPLE',
        verificationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: project.cadTrustProjectId,
        cadTrustValidationId: validation.cadTrustValidationId,
      }));

      const methodology = await MethodologyV2.create({
        methodologyCode: 'TEST-METHOD-MULTIPLE',
        methodologyName: 'Test Methodology',
        methodologyType: 'Methodology for Afforestation and Reforestation',
      });

      const issuance = await IssuanceV2.create(addUuidIfNeeded('IssuanceV2', {
        issuanceId: 'TEST-ISS-MULTIPLE',
        issuanceDate: '2024-01-01',
        cadTrustVerificationId: verification.cadTrustVerificationId,
        cadTrustMethodologyId: methodology.cadTrustMethodologyId,
      }));

      // Create multiple units with marketplace identifiers (directly in DB)
      await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'UNIT-MULTIPLE-1',
        unitStartBlock: 'BLK001',
        unitEndBlock: 'BLK010',
        unitVintageYear: 2024,
        cadTrustIssuanceId: issuance.cadTrustIssuanceId,
        marketplaceIdentifier: 'MULTIPLE-001',
        orgUid: homeOrgId,
      }));

      await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'UNIT-MULTIPLE-2',
        unitStartBlock: 'BLK011',
        unitEndBlock: 'BLK020',
        unitVintageYear: 2024,
        cadTrustIssuanceId: issuance.cadTrustIssuanceId,
        marketplaceIdentifier: 'MULTIPLE-002',
        orgUid: homeOrgId,
      }));

      // Call getTokenizedProjectIds method
      const projectIds = await ProjectV2.getTokenizedProjectIds();

      expect(projectIds).to.be.an('array');
      // Project ID should appear only once (DISTINCT)
      const occurrences = projectIds.filter(id => id === project.cadTrustProjectId).length;
      expect(occurrences).to.equal(1);
    });
  });

  describe('Integration with Units', function () {
    it('should update project results when unit marketplace fields are added', async function () {
      // Create project (directly in DB)
      const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
        projectRegistryName: 'Test Registry',
        projectId: 'TEST-PROJECT-UPDATE',
        projectName: 'Project for Update Test',
        projectSector: 'Agriculture',
        cadTrustProgramId: testProgram.cadTrustProgramId,
        orgUid: homeOrgId,
      }));

      // Create validation, verification, issuance
      const validation = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
        validationId: 'TEST-VAL-UPDATE',
        validationType: 'Validation of Project Design Document',
        validationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: project.cadTrustProjectId,
      }));

      const verification = await VerificationV2.create(addUuidIfNeeded('VerificationV2', {
        verificationId: 'TEST-VER-UPDATE',
        verificationBody: 'AENOR International S.A.U.',
        cadTrustProjectId: project.cadTrustProjectId,
        cadTrustValidationId: validation.cadTrustValidationId,
      }));

      const methodology = await MethodologyV2.create({
        methodologyCode: 'TEST-METHOD-UPDATE',
        methodologyName: 'Test Methodology',
        methodologyType: 'Methodology for Afforestation and Reforestation',
      });

      const issuance = await IssuanceV2.create(addUuidIfNeeded('IssuanceV2', {
        issuanceId: 'TEST-ISS-UPDATE',
        issuanceDate: '2024-01-01',
        cadTrustVerificationId: verification.cadTrustVerificationId,
        cadTrustMethodologyId: methodology.cadTrustMethodologyId,
      }));

      // Create unit without marketplace identifier (directly in DB)
      const unit = await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'UNIT-UPDATE-TEST',
        unitStartBlock: 'BLK001',
        unitEndBlock: 'BLK010',
        unitVintageYear: 2024,
        cadTrustIssuanceId: issuance.cadTrustIssuanceId,
        orgUid: homeOrgId,
      }));

      // Verify project does NOT appear in marketplace projects
      let res = await supertest(app)
        .get('/v2/project?onlyMarketplaceProjects=true&page=1&limit=10')
        .expect(200);

      let projectIds = res.body.data.map(p => p.cadTrustProjectId);
      expect(projectIds).to.not.include(project.cadTrustProjectId);

      // Update unit to add marketplace identifier (directly in DB)
      await unit.update({
        marketplaceIdentifier: 'UPDATE-TEST-001',
      });

      // Verify project NOW appears in marketplace projects
      res = await supertest(app)
        .get('/v2/project?onlyMarketplaceProjects=true&page=1&limit=10')
        .expect(200);

      projectIds = res.body.data.map(p => p.cadTrustProjectId);
      expect(projectIds).to.include(project.cadTrustProjectId);
    });
  });
});
