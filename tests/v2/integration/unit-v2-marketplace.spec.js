import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { StagingV2, UnitV2, IssuanceV2, VerificationV2, MethodologyV2, ProjectMethodologyV2, ProjectV2, ValidationV2, ProgramV2 } from '../../../src/models/v2/index.js';
import { v4 as uuidv4 } from 'uuid';

import {
  resetV2StagingTable,
  resetV2DataTables,
  waitForV2DataLayerSync,
  createV2TestHomeOrg,
  getV2HomeOrgId,
  addUuidIfNeeded,
  commitV2StagingAndWait,
  commitV2StagingAndWaitForCondition,
} from '../utils/v2-test-helpers.js';

describe('V2 Unit API - Marketplace Features', function () {
  this.timeout(60000); // Increased to 60s to accommodate 50s sync wait

  let testIssuance;
  let homeOrg;
  let testProject;

  before(async function () {
    console.log('Setting up V2 test environment for marketplace tests...');
    await prepareV2Db();

    // Create test home organization
    homeOrg = await createV2TestHomeOrg();

    // Create a test program, project, validation, verification, methodology, and issuance
    const testProgram = await ProgramV2.create({
      programName: 'Test Program for Marketplace',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-ACT-001',
    });

    const homeOrgId = await getV2HomeOrgId();
    testProject = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
      projectRegistryName: 'Test Registry',
      projectId: 'TEST-PROJECT-MARKETPLACE',
      projectName: 'Test Project for Marketplace',
      projectSector: 'Agriculture',
      cadTrustProgramId: testProgram.cadTrustProgramId,
      orgUid: homeOrgId,
    }));

    const testValidation = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
      validationId: 'TEST-VALIDATION-MARKETPLACE',
      validationType: 'Validation of Project Design Document',
      validationBody: 'AENOR International S.A.U.',
      cadTrustProjectId: testProject.cadTrustProjectId,
    }));

    const testVerification = await VerificationV2.create(addUuidIfNeeded('VerificationV2', {
      verificationId: 'TEST-VERIFICATION-MARKETPLACE',
      verificationBody: 'AENOR International S.A.U.',
      cadTrustProjectId: testProject.cadTrustProjectId,
      cadTrustValidationId: testValidation.cadTrustValidationId,
    }));

    const testMethodology = await MethodologyV2.create({
      methodologyCode: 'TEST-METHODOLOGY-MARKETPLACE',
      methodologyName: 'Test Methodology for Marketplace',
      methodologyType: 'Methodology for Afforestation and Reforestation',
    });

    const testProjectMethodology = await ProjectMethodologyV2.create(addUuidIfNeeded('ProjectMethodologyV2', {
      cadTrustProjectId: testProject.cadTrustProjectId,
      cadTrustMethodologyId: testMethodology.cadTrustMethodologyId,
      projectMethodologyDate: '2024-01-01',
    }));

    testIssuance = await IssuanceV2.create(addUuidIfNeeded('IssuanceV2', {
      issuanceId: 'TEST-ISSUANCE-MARKETPLACE',
      issuanceDate: '2024-01-01',
      cadTrustVerificationId: testVerification.cadTrustVerificationId,
      cadTrustProjectMethodologyId: testProjectMethodology.cadTrustProjectMethodologyId,
    }));
  });

  beforeEach(async function () {
    await resetV2StagingTable();
    await resetV2DataTables();

    // Recreate test data after cleanup
    const testProgram = await ProgramV2.create({
      programName: 'Test Program for Marketplace',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-ACT-001',
    });

    const homeOrgId = await getV2HomeOrgId();
    testProject = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
      projectRegistryName: 'Test Registry',
      projectId: 'TEST-PROJECT-MARKETPLACE',
      projectName: 'Test Project for Marketplace',
      projectSector: 'Agriculture',
      cadTrustProgramId: testProgram.cadTrustProgramId,
      orgUid: homeOrgId,
    }));

    const testValidation = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
      validationId: 'TEST-VALIDATION-MARKETPLACE',
      validationType: 'Validation of Project Design Document',
      validationBody: 'AENOR International S.A.U.',
      cadTrustProjectId: testProject.cadTrustProjectId,
    }));

    const testVerification = await VerificationV2.create(addUuidIfNeeded('VerificationV2', {
      verificationId: 'TEST-VERIFICATION-MARKETPLACE',
      verificationBody: 'AENOR International S.A.U.',
      cadTrustProjectId: testProject.cadTrustProjectId,
      cadTrustValidationId: testValidation.cadTrustValidationId,
    }));

    const testMethodology = await MethodologyV2.create({
      methodologyCode: 'TEST-METHODOLOGY-MARKETPLACE',
      methodologyName: 'Test Methodology for Marketplace',
      methodologyType: 'Methodology for Afforestation and Reforestation',
    });

    const testProjectMethodology = await ProjectMethodologyV2.create(addUuidIfNeeded('ProjectMethodologyV2', {
      cadTrustProjectId: testProject.cadTrustProjectId,
      cadTrustMethodologyId: testMethodology.cadTrustMethodologyId,
      projectMethodologyDate: '2024-01-01',
    }));

    testIssuance = await IssuanceV2.create(addUuidIfNeeded('IssuanceV2', {
      issuanceId: 'TEST-ISSUANCE-MARKETPLACE',
      issuanceDate: '2024-01-01',
      cadTrustVerificationId: testVerification.cadTrustVerificationId,
      cadTrustProjectMethodologyId: testProjectMethodology.cadTrustProjectMethodologyId,
    }));
  });

  describe('Basic Marketplace Fields', function () {
    // Clean staging before each test to prevent contamination
    beforeEach(async function () {
      await StagingV2.destroy({ where: {}, truncate: true });
    });

    it('should create unit with marketplace fields', async function () {
      const unitData = {
        unitSerialId: 'UNIT-MARKETPLACE-001',
        unitStartBlock: 'BLK001',
        unitEndBlock: 'BLK010',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
        marketplace: 'Demo Marketplace',
        marketplaceLink: 'http://climateWarehouse.com/myMarketplace',
        marketplaceIdentifier: 'AKFEE3',
      };

      const res = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.message).to.equal('Unit staged successfully');
      // Verify marketplace fields in staged data
      const stagingRecord = await StagingV2.findOne({
        where: { uuid: res.body.uuid },
      });
      expect(stagingRecord).to.exist;
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].marketplace).to.equal('Demo Marketplace');
      expect(stagedData[0].marketplace_link).to.equal('http://climateWarehouse.com/myMarketplace');
      expect(stagedData[0].marketplace_identifier).to.equal('AKFEE3');
    });

    it('should update unit to add marketplace fields', async function () {
      // Create unit without marketplace fields (directly in DB)
      const homeOrgId = await getV2HomeOrgId();
      const unit = await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'UNIT-MARKETPLACE-002',
        unitStartBlock: 'BLK011',
        unitEndBlock: 'BLK020',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
        orgUid: homeOrgId,
      }));

      // Update unit to add marketplace fields
      const updateRes = await supertest(app)
        .put(`/v2/unit/${unit.cadTrustUnitId}`)
        .send({
          unitSerialId: unit.unitSerialId,
          unitStartBlock: unit.unitStartBlock,
          unitEndBlock: unit.unitEndBlock,
          unitVintageYear: unit.unitVintageYear,
          cadTrustIssuanceId: unit.cadTrustIssuanceId,
          marketplace: 'Climate Marketplace',
          marketplaceLink: 'https://marketplace.com/units/ABC123',
          marketplaceIdentifier: 'ABC123',
        })
        .expect(200);

      expect(updateRes.body.success).to.be.true;
      expect(updateRes.body.message).to.equal('Unit update staged successfully');

      const unitId = unit.cadTrustUnitId;

      // Commit and wait with smart polling - passes as soon as sync completes
      await commitV2StagingAndWaitForCondition(
        async () => {
          const updatedUnit = await UnitV2.findOne({
            where: { cadTrustUnitId: unitId },
          });
          // Check if marketplace fields are synced
          return updatedUnit?.marketplace === 'Climate Marketplace' &&
                 updatedUnit?.marketplaceLink === 'https://marketplace.com/units/ABC123' &&
                 updatedUnit?.marketplaceIdentifier === 'ABC123';
        },
        { description: 'Unit marketplace fields update sync to main table' }
      );

      // Verify marketplace fields in the updated unit (final assertion for clarity)
      const updatedUnit = await UnitV2.findOne({
        where: { cadTrustUnitId: unitId },
      });
      expect(updatedUnit).to.exist;
      expect(updatedUnit.marketplace).to.equal('Climate Marketplace');
      expect(updatedUnit.marketplaceLink).to.equal('https://marketplace.com/units/ABC123');
      expect(updatedUnit.marketplaceIdentifier).to.equal('ABC123');
    });

    it('should update unit to remove marketplace fields', async function () {
      // Create unit with marketplace fields (directly in DB)
      const homeOrgId = await getV2HomeOrgId();
      const unit = await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'UNIT-MARKETPLACE-003',
        unitStartBlock: 'BLK021',
        unitEndBlock: 'BLK030',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
        marketplace: 'Demo Marketplace',
        marketplaceIdentifier: 'XYZ789',
        orgUid: homeOrgId,
      }));

      // Update unit to remove marketplace fields
      const updateRes = await supertest(app)
        .put(`/v2/unit/${unit.cadTrustUnitId}`)
        .send({
          unitSerialId: unit.unitSerialId,
          unitStartBlock: unit.unitStartBlock,
          unitEndBlock: unit.unitEndBlock,
          unitVintageYear: unit.unitVintageYear,
          cadTrustIssuanceId: unit.cadTrustIssuanceId,
          marketplace: null,
          marketplaceLink: null,
          marketplaceIdentifier: null,
        })
        .expect(200);

      expect(updateRes.body.success).to.be.true;
      expect(updateRes.body.message).to.equal('Unit update staged successfully');
      // Verify marketplace fields are null in staged update data
      const updateStagingRecord = await StagingV2.findOne({
        where: {
          table: 'unit',
          action: 'UPDATE',
        },
        order: [['created_at', 'DESC']],
      });
      expect(updateStagingRecord).to.exist;
      const updateStagedData = JSON.parse(updateStagingRecord.data);
      expect(updateStagedData[0].marketplace).to.be.null;
      expect(updateStagedData[0].marketplace_link).to.be.null;
      expect(updateStagedData[0].marketplace_identifier).to.be.null;
    });

    it('should reject empty string for marketplaceIdentifier', async function () {
      const unitData = {
        unitSerialId: 'UNIT-MARKETPLACE-004',
        unitStartBlock: 'BLK031',
        unitEndBlock: 'BLK040',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
        marketplace: 'Demo Marketplace',
        marketplaceIdentifier: '', // Empty string should be rejected
      };

      const res = await supertest(app)
        .post('/v2/unit')
        .send(unitData)
        .expect(400);

      expect(res.body.success).to.be.false;
    });
  });

  describe('marketplaceIdentifiers Query Parameter', function () {
    beforeEach(async function () {
      // Create units with different marketplace identifiers (directly in DB)
      const homeOrgId = await getV2HomeOrgId();
      await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'UNIT-MARKETPLACE-ID-001',
        unitStartBlock: 'BLK001',
        unitEndBlock: 'BLK010',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
        marketplaceIdentifier: 'AKFEE3',
        orgUid: homeOrgId,
      }));

      await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'UNIT-MARKETPLACE-ID-002',
        unitStartBlock: 'BLK011',
        unitEndBlock: 'BLK020',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
        marketplaceIdentifier: 'XYZ123',
        orgUid: homeOrgId,
      }));

      await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'UNIT-MARKETPLACE-ID-003',
        unitStartBlock: 'BLK021',
        unitEndBlock: 'BLK030',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
        marketplaceIdentifier: 'DEF456',
        orgUid: homeOrgId,
      }));
    });

    it('should filter units by single marketplace identifier', async function () {
      const res = await supertest(app)
        .get('/v2/unit?marketplaceIdentifiers=AKFEE3&page=1&limit=10')
        .expect(200);

      expect(res.body).to.have.property('data');
      expect(res.body.data).to.be.an('array');
      expect(res.body.data.length).to.be.at.least(1);
      expect(res.body.data.every(u => u.marketplaceIdentifier === 'AKFEE3')).to.be.true;
    });

    it('should filter units by multiple marketplace identifiers', async function () {
      const res = await supertest(app)
        .get('/v2/unit?marketplaceIdentifiers=AKFEE3,XYZ123&page=1&limit=10')
        .expect(200);

      expect(res.body).to.have.property('data');
      expect(res.body.data).to.be.an('array');
      expect(res.body.data.length).to.be.at.least(2);
      const identifiers = res.body.data.map(u => u.marketplaceIdentifier);
      expect(identifiers).to.include('AKFEE3');
      expect(identifiers).to.include('XYZ123');
    });

    it('should return empty result for non-existent marketplace identifier', async function () {
      const res = await supertest(app)
        .get('/v2/unit?marketplaceIdentifiers=NONEXISTENT&page=1&limit=10')
        .expect(200);

      expect(res.body).to.have.property('data');
      expect(res.body.data).to.be.an('array');
      expect(res.body.data.length).to.equal(0);
    });
  });

  describe('hasMarketplaceIdentifier Query Parameter', function () {
    beforeEach(async function () {
      // Create units with and without marketplace identifiers (directly in DB)
      const homeOrgId = await getV2HomeOrgId();
      await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'UNIT-HAS-MARKETPLACE-001',
        unitStartBlock: 'BLK001',
        unitEndBlock: 'BLK010',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
        marketplaceIdentifier: 'HAS001',
        orgUid: homeOrgId,
      }));

      await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'UNIT-NO-MARKETPLACE-001',
        unitStartBlock: 'BLK011',
        unitEndBlock: 'BLK020',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
        orgUid: homeOrgId,
      }));
    });

    it('should filter units WITH marketplace identifier', async function () {
      const res = await supertest(app)
        .get('/v2/unit?hasMarketplaceIdentifier=true&page=1&limit=10')
        .expect(200);

      expect(res.body).to.have.property('data');
      expect(res.body.data).to.be.an('array');
      expect(res.body.data.length).to.be.at.least(1);
      expect(res.body.data.every(u => u.marketplaceIdentifier != null && u.marketplaceIdentifier !== '')).to.be.true;
    });

    it('should filter units WITHOUT marketplace identifier', async function () {
      const res = await supertest(app)
        .get('/v2/unit?hasMarketplaceIdentifier=false&page=1&limit=10')
        .expect(200);

      expect(res.body).to.have.property('data');
      expect(res.body.data).to.be.an('array');
      expect(res.body.data.length).to.be.at.least(1);
      expect(res.body.data.every(u => u.marketplaceIdentifier == null || u.marketplaceIdentifier === '')).to.be.true;
    });
  });

  describe('onlyTokenizedUnits Query Parameter', function () {
    beforeEach(async function () {
      // Create units (directly in DB)
      const homeOrgId = await getV2HomeOrgId();
      // Create tokenized unit
      await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'UNIT-TOKENIZED-001',
        unitStartBlock: 'BLK001',
        unitEndBlock: 'BLK010',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
        marketplace: 'Tokenized on Chia',
        marketplaceIdentifier: 'CHIA-TOKEN-12345',
        orgUid: homeOrgId,
      }));

      // Create regular marketplace unit (not tokenized)
      await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'UNIT-REGULAR-MARKETPLACE-001',
        unitStartBlock: 'BLK011',
        unitEndBlock: 'BLK020',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
        marketplace: 'Demo Marketplace',
        marketplaceIdentifier: 'REGULAR-001',
        orgUid: homeOrgId,
      }));

      // Create unit with marketplaceIdentifier but wrong marketplace
      await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'UNIT-WRONG-MARKETPLACE-001',
        unitStartBlock: 'BLK021',
        unitEndBlock: 'BLK030',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
        marketplace: 'Other Marketplace',
        marketplaceIdentifier: 'OTHER-001',
        orgUid: homeOrgId,
      }));

      // Create unit without marketplace fields
      await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'UNIT-NO-MARKETPLACE-001',
        unitStartBlock: 'BLK031',
        unitEndBlock: 'BLK040',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
        orgUid: homeOrgId,
      }));
    });

    it('should filter only tokenized units (marketplace=Tokenized on Chia AND marketplaceIdentifier set)', async function () {
      const res = await supertest(app)
        .get('/v2/unit?onlyTokenizedUnits=true&page=1&limit=10')
        .expect(200);

      expect(res.body).to.have.property('data');
      expect(res.body.data).to.be.an('array');
      expect(res.body.data.length).to.be.at.least(1);
      expect(res.body.data.every(u =>
        u.marketplace === 'Tokenized on Chia' &&
        u.marketplaceIdentifier != null &&
        u.marketplaceIdentifier !== ''
      )).to.be.true;
    });

    it('should filter non-tokenized units (onlyTokenizedUnits=false)', async function () {
      const res = await supertest(app)
        .get('/v2/unit?onlyTokenizedUnits=false&page=1&limit=10')
        .expect(200);

      expect(res.body).to.have.property('data');
      expect(res.body.data).to.be.an('array');
      expect(res.body.data.length).to.be.at.least(1);
      // Non-tokenized units are those that don't have marketplace='Tokenized on Chia' AND marketplaceIdentifier
      expect(res.body.data.every(u =>
        !(u.marketplace === 'Tokenized on Chia' && u.marketplaceIdentifier != null && u.marketplaceIdentifier !== '')
      )).to.be.true;
    });
  });

  describe('FTS Integration with Marketplace Fields', function () {
    beforeEach(async function () {
      // Create unit with marketplace data (directly in DB)
      const homeOrgId = await getV2HomeOrgId();
      await UnitV2.create(addUuidIfNeeded('UnitV2', {
        unitSerialId: 'UNIT-FTS-MARKETPLACE-001',
        unitStartBlock: 'BLK001',
        unitEndBlock: 'BLK010',
        unitVintageYear: 2024,
        cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
        marketplace: 'Demo Marketplace',
        marketplaceIdentifier: 'FTS-TEST-001',
        orgUid: homeOrgId,
      }));
    });

    it('should search units by marketplace name', async function () {
      const res = await supertest(app)
        .get('/v2/unit?search=Demo Marketplace&page=1&limit=10')
        .expect(200);

      expect(res.body).to.have.property('data');
      expect(res.body.data).to.be.an('array');
      expect(res.body.data.length).to.be.at.least(1);
    });

    it('should search units by marketplace identifier', async function () {
      const res = await supertest(app)
        .get('/v2/unit?search=FTS-TEST-001&page=1&limit=10')
        .expect(200);

      expect(res.body).to.have.property('data');
      expect(res.body.data).to.be.an('array');
      expect(res.body.data.length).to.be.at.least(1);
    });
  });

  describe('Edge Cases', function () {
    it('should handle unit with marketplace but no marketplaceIdentifier', async function () {
      const res = await supertest(app)
        .post('/v2/unit')
        .send({
          unitSerialId: 'UNIT-EDGE-001',
          unitStartBlock: 'BLK001',
          unitEndBlock: 'BLK010',
          unitVintageYear: 2024,
          cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
          marketplace: 'Demo Marketplace',
          marketplaceIdentifier: null,
        })
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.message).to.equal('Unit staged successfully');
      // Verify marketplace fields in staged data
      const stagingRecord = await StagingV2.findOne({
        where: { uuid: res.body.uuid },
      });
      expect(stagingRecord).to.exist;
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].marketplace).to.equal('Demo Marketplace');
      expect(stagedData[0].marketplace_identifier).to.be.null;
    });

    it('should handle unit with marketplaceIdentifier but no marketplace', async function () {
      const res = await supertest(app)
        .post('/v2/unit')
        .send({
          unitSerialId: 'UNIT-EDGE-002',
          unitStartBlock: 'BLK011',
          unitEndBlock: 'BLK020',
          unitVintageYear: 2024,
          cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
          marketplace: null,
          marketplaceIdentifier: 'ID-ONLY-001',
        })
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.message).to.equal('Unit staged successfully');
      // Verify marketplace fields in staged data
      const stagingRecord = await StagingV2.findOne({
        where: { uuid: res.body.uuid },
      });
      expect(stagingRecord).to.exist;
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].marketplace).to.be.null;
      expect(stagedData[0].marketplace_identifier).to.equal('ID-ONLY-001');
    });

    it('should handle unit with marketplace=Tokenized on Chia but no marketplaceIdentifier', async function () {
      const res = await supertest(app)
        .post('/v2/unit')
        .send({
          unitSerialId: 'UNIT-EDGE-003',
          unitStartBlock: 'BLK021',
          unitEndBlock: 'BLK030',
          unitVintageYear: 2024,
          cadTrustIssuanceId: testIssuance.cadTrustIssuanceId,
          marketplace: 'Tokenized on Chia',
          marketplaceIdentifier: null,
        })
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.message).to.equal('Unit staged successfully');
      // Verify marketplace fields in staged data
      const stagingRecord = await StagingV2.findOne({
        where: { uuid: res.body.uuid },
      });
      expect(stagingRecord).to.exist;
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].marketplace).to.equal('Tokenized on Chia');
      expect(stagedData[0].marketplace_identifier).to.be.null;

      // Note: This unit is only staged, not committed, so it won't appear in query results
      // The test verifies that the staging works correctly with these field combinations
    });
  });
});

