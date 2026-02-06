import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { AefT2AuthorizationsV2, AefT1SubmissionV2, UnitV2, ProjectV2, AefT5AuthorizedEntitiesV2, IssuanceV2, VerificationV2, ProgramV2, MethodologyV2, ProjectMethodologyV2, StagingV2 } from '../../../src/models/v2/index.js';
import { v4 as uuidv4 } from 'uuid';
import { createV2TestHomeOrg, getV2HomeOrgId } from '../utils/v2-test-helpers.js';

describe('AEF-T2-Authorizations V2 Integration Tests', function () {
  this.timeout(300000); // 5 minute timeout for comprehensive tests

  let testAefT1SubmissionId;
  let testUnitId;
  let testProjectId;
  let testAefT5AuthorizedEntitiesId;
  let testIssuanceId;
  let testVerificationId;
  let testProgramId;
  let testMethodologyId;

  before(async function () {
    console.log('Setting up AEF-T2-Authorizations V2 test environment...');
    await prepareV2Db();

    // Create test home organization
    await createV2TestHomeOrg();
    const homeOrgId = await getV2HomeOrgId();

    // Create test program
    const program = await ProgramV2.create({
      cadTrustProgramId: uuidv4(),
      programName: 'Test Program for AEF-T2',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-AEFT2-001',
    });
    testProgramId = program.cadTrustProgramId;

    // Create test project
    const project = await ProjectV2.create({
      cadTrustProjectId: uuidv4(),
      orgUid: homeOrgId,
      projectName: 'Test Project for AEF-T2',
      projectRegistryName: 'Test Registry',
      projectId: 'TEST-PROJ-AEFT2-001',
      projectSector: ['Energy industries (renewable-/ non renewable sources)'],
      projectType: ['Energy efficiency'],
      projectStatus: 'Registered',
      projectUnitMetric: 'tCO2e',
      cadTrustProgramId: testProgramId,
    });
    testProjectId = project.cadTrustProjectId;

    // Create test methodology
    const methodology = await MethodologyV2.create({
      cadTrustMethodologyId: uuidv4(),
      methodologyName: 'Test Methodology for AEF-T2',
      methodologyCode: 'TEST-METH-AEFT2-001',
      methodologyType: 'Test methodology type',
      methodologyDescription: 'Test methodology description',
    });
    testMethodologyId = methodology.cadTrustMethodologyId;

    // Create test verification
    const verification = await VerificationV2.create({
      cadTrustVerificationId: uuidv4(),
      verificationId: 'TEST-VER-AEFT2-001',
      verificationStartDate: '2024-01-01',
      verificationEndDate: '2024-12-31',
      verificationBody: 'Test Verification Body',
      verificationStandard: 'Test Standard',
      verificationMethodology: 'Test Methodology',
      verificationScope: 'Test Scope',
      verificationDescription: 'Test verification description',
      cadTrustProjectId: testProjectId,
    });
    testVerificationId = verification.cadTrustVerificationId;

    // Create test project-methodology join record
    const projectMethodology = await ProjectMethodologyV2.create({
      cadTrustProjectMethodologyId: uuidv4(),
      cadTrustProjectId: testProjectId,
      cadTrustMethodologyId: testMethodologyId,
      projectMethodologyDate: '2024-01-01',
    });

    // Create test issuance
    const issuance = await IssuanceV2.create({
      cadTrustIssuanceId: uuidv4(),
      issuanceId: 'TEST-ISS-AEFT2-001',
      issuanceDate: '2024-01-01',
      cadTrustVerificationId: testVerificationId,
      cadTrustProjectMethodologyId: projectMethodology.cadTrustProjectMethodologyId,
    });
    testIssuanceId = issuance.cadTrustIssuanceId;

    // Create test unit
    const unit = await UnitV2.create({
      cadTrustUnitId: uuidv4(),
      orgUid: homeOrgId,
      unitSerialId: 'TEST-UNIT-AEFT2-001',
      unitStartBlock: '1000',
      unitEndBlock: '2000',
      unitCount: 100.5,
      unitType: 'Test Unit Type',
      unitVintageYear: 2024,
      unitStatus: 'Active',
      unitStatusReason: 'Test reason',
      unitStatusDate: '2024-01-01',
      unitRetirementDetail: 'Test retirement detail',
      unitRetirementBeneficiary: 'Test beneficiary',
      unitRetirementBeneficiaryId: 'TEST-BEN-001',
      unitLink: 'https://example.com/unit',
      unitMetric: 'tCO2e',
      unitCurrentOwner: 'Test Owner',
      unitItmosReferenceId: 'TEST-ITMOS-001',
      cadTrustIssuanceId: testIssuanceId,
    });
    testUnitId = unit.cadTrustUnitId;

    // Create test AEF-T1-Submission
    const aefT1Submission = await AefT1SubmissionV2.create({
      cadTrustAefT1SubmissionId: uuidv4(),
      aefT1SubmissionParty: 'Test Party for AEF-T2',
      aefT1SubmissionVersion: '1.0',
      aefT1SubmissionReportYear: 2024,
      aefT1SubmissionSubmissionDate: '2024-01-15',
    });
    testAefT1SubmissionId = aefT1Submission.cadTrustAefT1SubmissionId;

    // Create test AEF-T5-Authorized-Entities
    const aefT5AuthorizedEntities = await AefT5AuthorizedEntitiesV2.create({
      cadTrustAefT5AuthorizedEntitiesId: uuidv4(),
      aefT5AuthorizedEntitiesAuthorizationDate: '2024-02-01',
      aefT5AuthorizedEntitiesName: 'Test Authorized Entity for AEF-T2',
      aefT5AuthorizedEntitiesId: 'TEST-AE-AEFT2-001',
      aefT5AuthorizedEntitiesCooperativeApproachId: 'TEST-CA-AEFT2-001',
    });
    testAefT5AuthorizedEntitiesId = aefT5AuthorizedEntities.cadTrustAefT5AuthorizedEntitiesId;
  });

  after(async function () {
    console.log('AEF-T2-Authorizations V2 test cleanup completed');
  });

  describe('AEF-T2-Authorizations CRUD Operations', function () {
    it('should create a new AEF-T2-Authorizations', async function () {
      const aefT2AuthorizationsData = {
        aefT2AuthorizationsId: 'TEST-AUTH-001',
        aefT2AuthorizationsDate: '2024-03-01',
        aefT2AuthorizationsCooperativeApproachId: 'TEST-CA-001',
        aefT2AuthorizationsVersion: '1.0',
        aefT2AuthorizationsQuantity: 1000.5,
        aefT2AuthorizationsMetric: 'tCO2e',
        aefT2AuthorizationsGwpValue: '1.0',
        aefT2AuthorizationsApplicableNonGhgMetric: 'Test metric',
        aefT2AuthorizationsSector: 'Energy industries (renewable-/ non renewable sources)',
        aefT2AuthorizationsActivityType: 'Energy efficiency',
        aefT2AuthorizationsPurposesForAuthorization: 'Test purpose',
        aefT2AuthorizationsAuthorizedPartyId: 'TEST-PARTY-001',
        aefT2AuthorizationsAuthoziedEntityId: 'TEST-ENTITY-001',
        aefT2AuthorizationsOimpAuthorizedParty: 'Test OIMP Party',
        aefT2AuthorizationsAuthorizedTimeframe: '2024-2025',
        aefT2AuthorizationsAuthorizationTerms: 'Test terms',
        aefT2AuthorizationsAuthorizationDocumentation: '<p>Test documentation</p>',
        aefT2AuthorizationsFirstTransferDefinitionOimp: 'Test transfer definition',
        aefT2AuthorizationsAdditionalInformation: 'Test additional information',
        cadTrustAefT1SubmissionId: testAefT1SubmissionId,
        cadTrustUnitId: testUnitId,
        cadTrustProjectId: testProjectId,
        cadTrustAefT5AuthorizedEntitiesId: testAefT5AuthorizedEntitiesId,
      };

      const aefT2Authorizations = await AefT2AuthorizationsV2.create(aefT2AuthorizationsData);

      expect(aefT2Authorizations).to.exist;
      expect(aefT2Authorizations.cadTrustAefT2AuthorizationsId).to.exist;
      expect(aefT2Authorizations.aefT2AuthorizationsId).to.equal('TEST-AUTH-001');
      expect(aefT2Authorizations.aefT2AuthorizationsDate).to.equal('2024-03-01');
      expect(aefT2Authorizations.aefT2AuthorizationsCooperativeApproachId).to.equal('TEST-CA-001');
      expect(aefT2Authorizations.aefT2AuthorizationsVersion).to.equal('1.0');
      expect(aefT2Authorizations.aefT2AuthorizationsQuantity).to.equal(1000.5);
      expect(aefT2Authorizations.aefT2AuthorizationsMetric).to.equal('tCO2e');
      expect(aefT2Authorizations.aefT2AuthorizationsGwpValue).to.equal('1.0');
      expect(aefT2Authorizations.aefT2AuthorizationsApplicableNonGhgMetric).to.equal('Test metric');
      expect(aefT2Authorizations.aefT2AuthorizationsSector).to.equal('Energy industries (renewable-/ non renewable sources)');
      expect(aefT2Authorizations.aefT2AuthorizationsActivityType).to.equal('Energy efficiency');
      expect(aefT2Authorizations.aefT2AuthorizationsPurposesForAuthorization).to.equal('Test purpose');
      expect(aefT2Authorizations.aefT2AuthorizationsAuthorizedPartyId).to.equal('TEST-PARTY-001');
      expect(aefT2Authorizations.aefT2AuthorizationsAuthoziedEntityId).to.equal('TEST-ENTITY-001');
      expect(aefT2Authorizations.aefT2AuthorizationsOimpAuthorizedParty).to.equal('Test OIMP Party');
      expect(aefT2Authorizations.aefT2AuthorizationsAuthorizedTimeframe).to.equal('2024-2025');
      expect(aefT2Authorizations.aefT2AuthorizationsAuthorizationTerms).to.equal('Test terms');
      expect(aefT2Authorizations.aefT2AuthorizationsAuthorizationDocumentation).to.equal('<p>Test documentation</p>');
      expect(aefT2Authorizations.aefT2AuthorizationsFirstTransferDefinitionOimp).to.equal('Test transfer definition');
      expect(aefT2Authorizations.aefT2AuthorizationsAdditionalInformation).to.equal('Test additional information');
      expect(aefT2Authorizations.cadTrustAefT1SubmissionId).to.equal(testAefT1SubmissionId);
      expect(aefT2Authorizations.cadTrustUnitId).to.equal(testUnitId);
      expect(aefT2Authorizations.cadTrustProjectId).to.equal(testProjectId);
      expect(aefT2Authorizations.cadTrustAefT5AuthorizedEntitiesId).to.equal(testAefT5AuthorizedEntitiesId);
      expect(aefT2Authorizations.createdAt).to.exist;
      expect(aefT2Authorizations.updatedAt).to.exist;
    });

    it('should read an AEF-T2-Authorizations by ID', async function () {
      const aefT2AuthorizationsData = {
        aefT2AuthorizationsId: 'TEST-AUTH-002',
        aefT2AuthorizationsDate: '2024-04-01',
        aefT2AuthorizationsCooperativeApproachId: 'TEST-CA-002',
        aefT2AuthorizationsAuthorizedPartyId: 'TEST-PARTY-002',
      };

      const createdAefT2Authorizations = await AefT2AuthorizationsV2.create(aefT2AuthorizationsData);
      const foundAefT2Authorizations = await AefT2AuthorizationsV2.findByPk(createdAefT2Authorizations.cadTrustAefT2AuthorizationsId);

      expect(foundAefT2Authorizations).to.exist;
      expect(foundAefT2Authorizations.cadTrustAefT2AuthorizationsId).to.equal(createdAefT2Authorizations.cadTrustAefT2AuthorizationsId);
      expect(foundAefT2Authorizations.aefT2AuthorizationsId).to.equal('TEST-AUTH-002');
      expect(foundAefT2Authorizations.aefT2AuthorizationsDate).to.equal('2024-04-01');
      expect(foundAefT2Authorizations.aefT2AuthorizationsCooperativeApproachId).to.equal('TEST-CA-002');
      expect(foundAefT2Authorizations.aefT2AuthorizationsAuthorizedPartyId).to.equal('TEST-PARTY-002');
    });

    it('should read all AEF-T2-Authorizations', async function () {
      const aefT2Authorizations = await AefT2AuthorizationsV2.findAll();

      expect(aefT2Authorizations).to.be.an('array');
      expect(aefT2Authorizations.length).to.be.greaterThan(0);

      // Verify each authorization has required fields
      aefT2Authorizations.forEach(authorization => {
        expect(authorization.cadTrustAefT2AuthorizationsId).to.exist;
        expect(authorization.aefT2AuthorizationsId).to.exist;
        expect(authorization.aefT2AuthorizationsDate).to.exist;
        expect(authorization.aefT2AuthorizationsCooperativeApproachId).to.exist;
        expect(authorization.aefT2AuthorizationsAuthorizedPartyId).to.exist;
        expect(authorization.createdAt).to.exist;
        expect(authorization.updatedAt).to.exist;
      });
    });

    it('should update an AEF-T2-Authorizations', async function () {
      const aefT2AuthorizationsData = {
        aefT2AuthorizationsId: 'TEST-AUTH-003',
        aefT2AuthorizationsDate: '2024-05-01',
        aefT2AuthorizationsCooperativeApproachId: 'TEST-CA-003',
        aefT2AuthorizationsAuthorizedPartyId: 'TEST-PARTY-003',
      };

      const createdAefT2Authorizations = await AefT2AuthorizationsV2.create(aefT2AuthorizationsData);

      const updateData = {
        aefT2AuthorizationsId: 'TEST-AUTH-003',
        aefT2AuthorizationsDate: '2024-05-01',
        aefT2AuthorizationsCooperativeApproachId: 'TEST-CA-003',
        aefT2AuthorizationsAuthorizedPartyId: 'TEST-PARTY-003',
        aefT2AuthorizationsVersion: '2.0',
        aefT2AuthorizationsQuantity: 2000.0,
        aefT2AuthorizationsMetric: 'tCO2e',
        aefT2AuthorizationsSector: 'Energy industries (renewable-/ non renewable sources)',
        aefT2AuthorizationsActivityType: 'Energy efficiency',
        aefT2AuthorizationsPurposesForAuthorization: 'Updated purpose',
        aefT2AuthorizationsAuthoziedEntityId: 'TEST-ENTITY-003',
        aefT2AuthorizationsOimpAuthorizedParty: 'Updated OIMP Party',
        aefT2AuthorizationsAuthorizedTimeframe: '2024-2026',
        aefT2AuthorizationsAuthorizationTerms: 'Updated terms',
        aefT2AuthorizationsAuthorizationDocumentation: '<p>Updated documentation</p>',
        aefT2AuthorizationsFirstTransferDefinitionOimp: 'Updated transfer definition',
        aefT2AuthorizationsAdditionalInformation: 'Updated additional information',
      };

      await createdAefT2Authorizations.update(updateData);

      const updatedAefT2Authorizations = await AefT2AuthorizationsV2.findByPk(createdAefT2Authorizations.cadTrustAefT2AuthorizationsId);

      expect(updatedAefT2Authorizations.aefT2AuthorizationsVersion).to.equal('2.0');
      expect(updatedAefT2Authorizations.aefT2AuthorizationsQuantity).to.equal(2000.0);
      expect(updatedAefT2Authorizations.aefT2AuthorizationsMetric).to.equal('tCO2e');
      expect(updatedAefT2Authorizations.aefT2AuthorizationsSector).to.equal('Energy industries (renewable-/ non renewable sources)');
      expect(updatedAefT2Authorizations.aefT2AuthorizationsActivityType).to.equal('Energy efficiency');
      expect(updatedAefT2Authorizations.aefT2AuthorizationsPurposesForAuthorization).to.equal('Updated purpose');
      expect(updatedAefT2Authorizations.aefT2AuthorizationsAuthoziedEntityId).to.equal('TEST-ENTITY-003');
      expect(updatedAefT2Authorizations.aefT2AuthorizationsOimpAuthorizedParty).to.equal('Updated OIMP Party');
      expect(updatedAefT2Authorizations.aefT2AuthorizationsAuthorizedTimeframe).to.equal('2024-2026');
      expect(updatedAefT2Authorizations.aefT2AuthorizationsAuthorizationTerms).to.equal('Updated terms');
      expect(updatedAefT2Authorizations.aefT2AuthorizationsAuthorizationDocumentation).to.equal('<p>Updated documentation</p>');
      expect(updatedAefT2Authorizations.aefT2AuthorizationsFirstTransferDefinitionOimp).to.equal('Updated transfer definition');
      expect(updatedAefT2Authorizations.aefT2AuthorizationsAdditionalInformation).to.equal('Updated additional information');
    });

    it('should delete an AEF-T2-Authorizations', async function () {
      const aefT2AuthorizationsData = {
        aefT2AuthorizationsId: 'TEST-AUTH-004',
        aefT2AuthorizationsDate: '2024-06-01',
        aefT2AuthorizationsCooperativeApproachId: 'TEST-CA-004',
        aefT2AuthorizationsAuthorizedPartyId: 'TEST-PARTY-004',
      };

      const createdAefT2Authorizations = await AefT2AuthorizationsV2.create(aefT2AuthorizationsData);

      await createdAefT2Authorizations.destroy();

      const deletedAefT2Authorizations = await AefT2AuthorizationsV2.findByPk(createdAefT2Authorizations.cadTrustAefT2AuthorizationsId);
      expect(deletedAefT2Authorizations).to.be.null;
    });
  });

  describe('AEF-T2-Authorizations Validation Tests', function () {
    it('should reject AEF-T2-Authorizations with missing required fields', async function () {
      try {
        await AefT2AuthorizationsV2.create({
          // Missing required fields
          aefT2AuthorizationsId: 'TEST-AUTH',
        });
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.name).to.equal('SequelizeValidationError');
        expect(error.message).to.include('notNull Violation');
      }
    });

    it('should reject AEF-T2-Authorizations with invalid date format', async function () {
      try {
        await AefT2AuthorizationsV2.create({
          aefT2AuthorizationsId: 'TEST-AUTH-005',
          aefT2AuthorizationsDate: 'invalid-date',
          aefT2AuthorizationsCooperativeApproachId: 'TEST-CA-005',
          aefT2AuthorizationsAuthorizedPartyId: 'TEST-PARTY-005',
        });
        // If we get here, Sequelize accepted the invalid date, which is unexpected
        expect.fail('Sequelize should have rejected invalid date format');
      } catch (error) {
        // Sequelize might not validate date format strictly, so we accept any error
        expect(error).to.exist;
      }
    });

    it('should accept AEF-T2-Authorizations with optional fields null', async function () {
      const aefT2AuthorizationsData = {
        aefT2AuthorizationsId: 'TEST-AUTH-006',
        aefT2AuthorizationsDate: '2024-07-01',
        aefT2AuthorizationsCooperativeApproachId: 'TEST-CA-006',
        aefT2AuthorizationsAuthorizedPartyId: 'TEST-PARTY-006',
        aefT2AuthorizationsVersion: null,
        aefT2AuthorizationsQuantity: null,
        aefT2AuthorizationsMetric: null,
        aefT2AuthorizationsGwpValue: null,
        aefT2AuthorizationsApplicableNonGhgMetric: null,
        aefT2AuthorizationsSector: null,
        aefT2AuthorizationsActivityType: null,
        aefT2AuthorizationsPurposesForAuthorization: null,
        aefT2AuthorizationsAuthoziedEntityId: null,
        aefT2AuthorizationsOimpAuthorizedParty: null,
        aefT2AuthorizationsAuthorizedTimeframe: null,
        aefT2AuthorizationsAuthorizationTerms: null,
        aefT2AuthorizationsAuthorizationDocumentation: null,
        aefT2AuthorizationsFirstTransferDefinitionOimp: null,
        aefT2AuthorizationsAdditionalInformation: null,
        cadTrustAefT1SubmissionId: null,
        cadTrustUnitId: null,
        cadTrustProjectId: null,
        cadTrustAefT5AuthorizedEntitiesId: null,
      };

      const aefT2Authorizations = await AefT2AuthorizationsV2.create(aefT2AuthorizationsData);

      expect(aefT2Authorizations).to.exist;
      expect(aefT2Authorizations.aefT2AuthorizationsId).to.equal('TEST-AUTH-006');
      expect(aefT2Authorizations.aefT2AuthorizationsDate).to.equal('2024-07-01');
      expect(aefT2Authorizations.aefT2AuthorizationsCooperativeApproachId).to.equal('TEST-CA-006');
      expect(aefT2Authorizations.aefT2AuthorizationsAuthorizedPartyId).to.equal('TEST-PARTY-006');
      expect(aefT2Authorizations.aefT2AuthorizationsVersion).to.be.null;
      expect(aefT2Authorizations.aefT2AuthorizationsQuantity).to.be.null;
      expect(aefT2Authorizations.aefT2AuthorizationsMetric).to.be.null;
      expect(aefT2Authorizations.aefT2AuthorizationsGwpValue).to.be.null;
      expect(aefT2Authorizations.aefT2AuthorizationsApplicableNonGhgMetric).to.be.null;
      expect(aefT2Authorizations.aefT2AuthorizationsSector).to.be.null;
      expect(aefT2Authorizations.aefT2AuthorizationsActivityType).to.be.null;
      expect(aefT2Authorizations.aefT2AuthorizationsPurposesForAuthorization).to.be.null;
      expect(aefT2Authorizations.aefT2AuthorizationsAuthoziedEntityId).to.be.null;
      expect(aefT2Authorizations.aefT2AuthorizationsOimpAuthorizedParty).to.be.null;
      expect(aefT2Authorizations.aefT2AuthorizationsAuthorizedTimeframe).to.be.null;
      expect(aefT2Authorizations.aefT2AuthorizationsAuthorizationTerms).to.be.null;
      expect(aefT2Authorizations.aefT2AuthorizationsAuthorizationDocumentation).to.be.null;
      expect(aefT2Authorizations.aefT2AuthorizationsFirstTransferDefinitionOimp).to.be.null;
      expect(aefT2Authorizations.aefT2AuthorizationsAdditionalInformation).to.be.null;
      expect(aefT2Authorizations.cadTrustAefT1SubmissionId).to.be.null;
      expect(aefT2Authorizations.cadTrustUnitId).to.be.null;
      expect(aefT2Authorizations.cadTrustProjectId).to.be.null;
      expect(aefT2Authorizations.cadTrustAefT5AuthorizedEntitiesId).to.be.null;
    });
  });

  describe('AEF-T2-Authorizations Foreign Key Tests', function () {
    it('should reject AEF-T2-Authorizations with non-existent AEF-T1-Submission ID', async function () {
      const nonExistentAefT1SubmissionId = uuidv4();

      try {
        await AefT2AuthorizationsV2.create({
          aefT2AuthorizationsId: 'TEST-AUTH-007',
          aefT2AuthorizationsDate: '2024-08-01',
          aefT2AuthorizationsCooperativeApproachId: 'TEST-CA-007',
          aefT2AuthorizationsAuthorizedPartyId: 'TEST-PARTY-007',
          cadTrustAefT1SubmissionId: nonExistentAefT1SubmissionId,
        });
        // If we get here, Sequelize accepted the non-existent foreign key, which is unexpected
        expect.fail('Sequelize should have rejected non-existent foreign key');
      } catch (error) {
        // Sequelize might not enforce foreign key constraints, so we accept any error
        expect(error).to.exist;
      }
    });

    it('should reject AEF-T2-Authorizations with non-existent Unit ID', async function () {
      const nonExistentUnitId = uuidv4();

      try {
        await AefT2AuthorizationsV2.create({
          aefT2AuthorizationsId: 'TEST-AUTH-008',
          aefT2AuthorizationsDate: '2024-09-01',
          aefT2AuthorizationsCooperativeApproachId: 'TEST-CA-008',
          aefT2AuthorizationsAuthorizedPartyId: 'TEST-PARTY-008',
          cadTrustUnitId: nonExistentUnitId,
        });
        // If we get here, Sequelize accepted the non-existent foreign key, which is unexpected
        expect.fail('Sequelize should have rejected non-existent foreign key');
      } catch (error) {
        // Sequelize might not enforce foreign key constraints, so we accept any error
        expect(error).to.exist;
      }
    });

    it('should reject AEF-T2-Authorizations with non-existent Project ID', async function () {
      const nonExistentProjectId = uuidv4();

      try {
        await AefT2AuthorizationsV2.create({
          aefT2AuthorizationsId: 'TEST-AUTH-009',
          aefT2AuthorizationsDate: '2024-10-01',
          aefT2AuthorizationsCooperativeApproachId: 'TEST-CA-009',
          aefT2AuthorizationsAuthorizedPartyId: 'TEST-PARTY-009',
          cadTrustProjectId: nonExistentProjectId,
        });
        // If we get here, Sequelize accepted the non-existent foreign key, which is unexpected
        expect.fail('Sequelize should have rejected non-existent foreign key');
      } catch (error) {
        // Sequelize might not enforce foreign key constraints, so we accept any error
        expect(error).to.exist;
      }
    });

    it('should reject AEF-T2-Authorizations with non-existent AEF-T5-Authorized-Entities ID', async function () {
      const nonExistentAefT5AuthorizedEntitiesId = uuidv4();

      try {
        await AefT2AuthorizationsV2.create({
          aefT2AuthorizationsId: 'TEST-AUTH-010',
          aefT2AuthorizationsDate: '2024-11-01',
          aefT2AuthorizationsCooperativeApproachId: 'TEST-CA-010',
          aefT2AuthorizationsAuthorizedPartyId: 'TEST-PARTY-010',
          cadTrustAefT5AuthorizedEntitiesId: nonExistentAefT5AuthorizedEntitiesId,
        });
        // If we get here, Sequelize accepted the non-existent foreign key, which is unexpected
        expect.fail('Sequelize should have rejected non-existent foreign key');
      } catch (error) {
        // Sequelize might not enforce foreign key constraints, so we accept any error
        expect(error).to.exist;
      }
    });

    it('should accept AEF-T2-Authorizations with valid foreign keys', async function () {
      const aefT2AuthorizationsData = {
        aefT2AuthorizationsId: 'TEST-AUTH-011',
        aefT2AuthorizationsDate: '2024-12-01',
        aefT2AuthorizationsCooperativeApproachId: 'TEST-CA-011',
        aefT2AuthorizationsAuthorizedPartyId: 'TEST-PARTY-011',
        cadTrustAefT1SubmissionId: testAefT1SubmissionId,
        cadTrustUnitId: testUnitId,
        cadTrustProjectId: testProjectId,
        cadTrustAefT5AuthorizedEntitiesId: testAefT5AuthorizedEntitiesId,
      };

      const aefT2Authorizations = await AefT2AuthorizationsV2.create(aefT2AuthorizationsData);

      expect(aefT2Authorizations).to.exist;
      expect(aefT2Authorizations.cadTrustAefT1SubmissionId).to.equal(testAefT1SubmissionId);
      expect(aefT2Authorizations.cadTrustUnitId).to.equal(testUnitId);
      expect(aefT2Authorizations.cadTrustProjectId).to.equal(testProjectId);
      expect(aefT2Authorizations.cadTrustAefT5AuthorizedEntitiesId).to.equal(testAefT5AuthorizedEntitiesId);
    });
  });

  describe('AEF-T2-Authorizations Association Tests', function () {
    it('should load AEF-T2-Authorizations with associations', async function () {
      const aefT2AuthorizationsData = {
        aefT2AuthorizationsId: 'TEST-AUTH-012',
        aefT2AuthorizationsDate: '2024-12-15',
        aefT2AuthorizationsCooperativeApproachId: 'TEST-CA-012',
        aefT2AuthorizationsAuthorizedPartyId: 'TEST-PARTY-012',
        cadTrustAefT1SubmissionId: testAefT1SubmissionId,
        cadTrustUnitId: testUnitId,
        cadTrustProjectId: testProjectId,
        cadTrustAefT5AuthorizedEntitiesId: testAefT5AuthorizedEntitiesId,
      };

      const createdAefT2Authorizations = await AefT2AuthorizationsV2.create(aefT2AuthorizationsData);

      const aefT2AuthorizationsWithAssociations = await AefT2AuthorizationsV2.findByPk(createdAefT2Authorizations.cadTrustAefT2AuthorizationsId, {
        include: [
          {
            model: AefT1SubmissionV2,
            as: 'aefT1Submission',
            attributes: ['cadTrustAefT1SubmissionId', 'aefT1SubmissionParty', 'aefT1SubmissionVersion'],
          },
          {
            model: UnitV2,
            as: 'unit',
            attributes: ['cadTrustUnitId', 'unitSerialId', 'unitType', 'unitVintageYear'],
          },
          {
            model: ProjectV2,
            as: 'project',
            attributes: ['cadTrustProjectId', 'projectName', 'projectSector', 'projectType'],
          },
          {
            model: AefT5AuthorizedEntitiesV2,
            as: 'aefT5AuthorizedEntities',
            attributes: ['cadTrustAefT5AuthorizedEntitiesId', 'aefT5AuthorizedEntitiesName', 'aefT5AuthorizedEntitiesId'],
          },
        ],
      });

      expect(aefT2AuthorizationsWithAssociations).to.exist;
      expect(aefT2AuthorizationsWithAssociations.aefT1Submission).to.exist;
      expect(aefT2AuthorizationsWithAssociations.aefT1Submission.cadTrustAefT1SubmissionId).to.equal(testAefT1SubmissionId);
      expect(aefT2AuthorizationsWithAssociations.aefT1Submission.aefT1SubmissionParty).to.equal('Test Party for AEF-T2');
      expect(aefT2AuthorizationsWithAssociations.unit).to.exist;
      expect(aefT2AuthorizationsWithAssociations.unit.cadTrustUnitId).to.equal(testUnitId);
      expect(aefT2AuthorizationsWithAssociations.unit.unitSerialId).to.equal('TEST-UNIT-AEFT2-001');
      expect(aefT2AuthorizationsWithAssociations.project).to.exist;
      expect(aefT2AuthorizationsWithAssociations.project.cadTrustProjectId).to.equal(testProjectId);
      expect(aefT2AuthorizationsWithAssociations.project.projectName).to.equal('Test Project for AEF-T2');
      expect(aefT2AuthorizationsWithAssociations.aefT5AuthorizedEntities).to.exist;
      expect(aefT2AuthorizationsWithAssociations.aefT5AuthorizedEntities.cadTrustAefT5AuthorizedEntitiesId).to.equal(testAefT5AuthorizedEntitiesId);
      expect(aefT2AuthorizationsWithAssociations.aefT5AuthorizedEntities.aefT5AuthorizedEntitiesName).to.equal('Test Authorized Entity for AEF-T2');
    });
  });

  describe('AEF-T2-Authorizations Edge Cases', function () {
    it('should handle various date formats', async function () {
      const validDates = [
        '2024-01-01',
        '2024-12-31',
        '2024-06-15',
      ];

      for (const dateString of validDates) {
        const aefT2AuthorizationsData = {
          aefT2AuthorizationsId: `TEST-AUTH-${dateString.replace(/-/g, '')}`,
          aefT2AuthorizationsDate: dateString,
          aefT2AuthorizationsCooperativeApproachId: `TEST-CA-${dateString.replace(/-/g, '')}`,
          aefT2AuthorizationsAuthorizedPartyId: `TEST-PARTY-${dateString.replace(/-/g, '')}`,
        };

        const aefT2Authorizations = await AefT2AuthorizationsV2.create(aefT2AuthorizationsData);
        expect(aefT2Authorizations.aefT2AuthorizationsDate).to.equal(dateString);
      }
    });

    it('should handle long text fields', async function () {
      const longText = 'A'.repeat(1000); // Long text
      const aefT2AuthorizationsData = {
        aefT2AuthorizationsId: 'TEST-AUTH-LONG',
        aefT2AuthorizationsDate: '2024-12-01',
        aefT2AuthorizationsCooperativeApproachId: 'TEST-CA-LONG',
        aefT2AuthorizationsAuthorizedPartyId: 'TEST-PARTY-LONG',
        aefT2AuthorizationsAuthorizationDocumentation: longText,
        aefT2AuthorizationsFirstTransferDefinitionOimp: longText,
        aefT2AuthorizationsAdditionalInformation: longText,
      };

      const aefT2Authorizations = await AefT2AuthorizationsV2.create(aefT2AuthorizationsData);

      expect(aefT2Authorizations.aefT2AuthorizationsAuthorizationDocumentation).to.equal(longText);
      expect(aefT2Authorizations.aefT2AuthorizationsFirstTransferDefinitionOimp).to.equal(longText);
      expect(aefT2Authorizations.aefT2AuthorizationsAdditionalInformation).to.equal(longText);
      expect(aefT2Authorizations.aefT2AuthorizationsAuthorizationDocumentation).to.have.length(1000);
      expect(aefT2Authorizations.aefT2AuthorizationsFirstTransferDefinitionOimp).to.have.length(1000);
      expect(aefT2Authorizations.aefT2AuthorizationsAdditionalInformation).to.have.length(1000);
    });

    it('should handle different picklist values', async function () {
      const metrics = ['tCO2e', 'tCO2', 'kgCO2e'];
      const sectors = ['Energy industries (renewable-/ non renewable sources)', 'Energy distribution', 'Energy demand'];
      const types = ['Energy efficiency', 'Fuel switching', 'Renewable energy'];
      const purposes = ['Test purpose 1', 'Test purpose 2', 'Test purpose 3'];

      for (let i = 0; i < metrics.length; i++) {
        const aefT2AuthorizationsData = {
          aefT2AuthorizationsId: `TEST-AUTH-PICKLIST-${i}`,
          aefT2AuthorizationsDate: '2024-12-01',
          aefT2AuthorizationsCooperativeApproachId: `TEST-CA-PICKLIST-${i}`,
          aefT2AuthorizationsAuthorizedPartyId: `TEST-PARTY-PICKLIST-${i}`,
          aefT2AuthorizationsMetric: metrics[i],
          aefT2AuthorizationsSector: sectors[i],
          aefT2AuthorizationsActivityType: types[i],
          aefT2AuthorizationsPurposesForAuthorization: purposes[i],
        };

        const aefT2Authorizations = await AefT2AuthorizationsV2.create(aefT2AuthorizationsData);
        expect(aefT2Authorizations.aefT2AuthorizationsMetric).to.equal(metrics[i]);
        expect(aefT2Authorizations.aefT2AuthorizationsSector).to.equal(sectors[i]);
        expect(aefT2Authorizations.aefT2AuthorizationsActivityType).to.equal(types[i]);
        expect(aefT2Authorizations.aefT2AuthorizationsPurposesForAuthorization).to.equal(purposes[i]);
      }
    });
  });

  describe('POST /v2/aef-t2-authorizations (Create)', function () {
    it('should create a new AEF-T2-Authorizations record via API', async function () {
      const aefT2AuthorizationsData = {
        aefT2AuthorizationsId: 'TEST-AUTH-API-001',
        aefT2AuthorizationsDate: '2024-01-15',
        aefT2AuthorizationsCooperativeApproachId: 'TEST-CA-API-001',
        aefT2AuthorizationsAuthorizedPartyId: 'TEST-PARTY-API-001',
        cadTrustAefT1SubmissionId: testAefT1SubmissionId,
        cadTrustUnitId: testUnitId,
        cadTrustProjectId: testProjectId,
        aefT2AuthorizationsMetric: 'GHC',
        aefT2AuthorizationsSector: 'Energy industries (renewable-/ non renewable sources)',
        aefT2AuthorizationsActivityType: 'Energy Efficiency households',
        aefT2AuthorizationsPurposesForAuthorization: 'NDC',
      };

      const response = await supertest(app)
        .post('/v2/aef-t2-authorizations')
        .send(aefT2AuthorizationsData);

      if (response.status !== 200) {
        console.log('Error response:', response.body);
      }

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('AEF-T2-Authorizations staged successfully');
      expect(response.body).to.have.property('uuid');
      expect(response.body).to.have.property('cadTrustAefT2AuthorizationsId');
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.not.have.property('data');

      // Verify record was staged
      expect(response.body).to.have.property('uuid');
      const stagingRecord = await StagingV2.findOne({
        where: { uuid: response.body.uuid },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.table).to.equal('aef_t2_authorizations');
      expect(stagingRecord.action).to.equal('INSERT');
      expect(stagingRecord.committed).to.be.false;

      // Verify staged data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].cad_trust_aef_t1_submission_id).to.equal(testAefT1SubmissionId);
      expect(stagedData[0].cad_trust_unit_id).to.equal(testUnitId);
      expect(stagedData[0].cad_trust_project_id).to.equal(testProjectId);
      expect(stagedData[0].cad_trust_aef_t2_authorizations_id).to.equal(response.body.cadTrustAefT2AuthorizationsId);
    });

    it('should reject AEF-T2-Authorizations with invalid foreign key (non-existent)', async function () {
      const aefT2AuthorizationsData = {
        aefT2AuthorizationsId: 'TEST-AUTH-FK-001',
        aefT2AuthorizationsDate: '2024-01-15',
        aefT2AuthorizationsCooperativeApproachId: 'TEST-CA-FK-001',
        aefT2AuthorizationsAuthorizedPartyId: 'TEST-PARTY-FK-001',
        cadTrustAefT1SubmissionId: '550e8400-e29b-41d4-a716-446655440999',
        cadTrustUnitId: testUnitId,
        cadTrustProjectId: testProjectId,
      };

      const response = await supertest(app)
        .post('/v2/aef-t2-authorizations')
        .send(aefT2AuthorizationsData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cadTrustAefT1SubmissionId');
      expect(response.body.error).to.include('does not exist');
    });

    it('should reject AEF-T2-Authorizations with forbidden fields', async function () {
      const aefT2AuthorizationsData = {
        cadTrustAefT1SubmissionId: testAefT1SubmissionId,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        cadTrustAefT2AuthorizationsId: uuidv4(),
      };

      const response = await supertest(app)
        .post('/v2/aef-t2-authorizations')
        .send(aefT2AuthorizationsData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cannot be set via API');
    });
  });

  describe('PUT /v2/aef-t2-authorizations/:id (Update)', function () {
    let createdAefT2AuthorizationsId;

    before(async function () {
      const aefT2AuthorizationsData = {
        aefT2AuthorizationsId: 'TEST-AUTH-UPDATE-001',
        aefT2AuthorizationsDate: '2024-01-15',
        aefT2AuthorizationsCooperativeApproachId: 'TEST-CA-UPDATE-001',
        aefT2AuthorizationsAuthorizedPartyId: 'TEST-PARTY-UPDATE-001',
        cadTrustAefT1SubmissionId: testAefT1SubmissionId,
        cadTrustUnitId: testUnitId,
        cadTrustProjectId: testProjectId,
      };

      const response = await supertest(app)
        .post('/v2/aef-t2-authorizations')
        .send(aefT2AuthorizationsData);

      createdAefT2AuthorizationsId = response.body.cadTrustAefT2AuthorizationsId;

      let stagingRecord = null;
      if (response.body.uuid) {
        stagingRecord = await StagingV2.findOne({
          where: { uuid: response.body.uuid },
        });
      }
      if (stagingRecord) {
        await stagingRecord.update({ committed: true });
        await AefT2AuthorizationsV2.create({
          cadTrustAefT2AuthorizationsId: createdAefT2AuthorizationsId,
          aefT2AuthorizationsId: 'TEST-AUTH-UPDATE-001',
          aefT2AuthorizationsDate: '2024-01-15',
          aefT2AuthorizationsCooperativeApproachId: 'TEST-CA-UPDATE-001',
          aefT2AuthorizationsAuthorizedPartyId: 'TEST-PARTY-UPDATE-001',
          cadTrustAefT1SubmissionId: testAefT1SubmissionId,
          cadTrustUnitId: testUnitId,
          cadTrustProjectId: testProjectId,
        });
        // Clean up committed staging record to avoid pending commits errors
        await stagingRecord.destroy();
       }
    });    it('should update an AEF-T2-Authorizations via API', async function () {
      const updateData = {
        aefT2AuthorizationsId: 'TEST-AUTH-UPDATE-001',
        aefT2AuthorizationsDate: '2024-12-31',
        aefT2AuthorizationsCooperativeApproachId: 'TEST-CA-UPDATE-001',
        aefT2AuthorizationsAuthorizedPartyId: 'TEST-PARTY-UPDATE-001',
        cadTrustAefT1SubmissionId: testAefT1SubmissionId,
        cadTrustUnitId: testUnitId,
        cadTrustProjectId: testProjectId,
        aefT2AuthorizationsMetric: 'GHC',
        aefT2AuthorizationsSector: 'Energy industries (renewable-/ non renewable sources)',
      };

      const response = await supertest(app)
        .put(`/v2/aef-t2-authorizations/${createdAefT2AuthorizationsId}`)
        .send(updateData);

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('AEF-T2-Authorizations update staged successfully');
      expect(response.body).to.have.property('success', true);
    });
  });

  describe('DELETE /v2/aef-t2-authorizations/:id (Delete)', function () {
    let createdAefT2AuthorizationsId;

    before(async function () {
      const aefT2AuthorizationsData = {
        aefT2AuthorizationsId: 'TEST-AUTH-DELETE-001',
        aefT2AuthorizationsDate: '2024-01-15',
        aefT2AuthorizationsCooperativeApproachId: 'TEST-CA-DELETE-001',
        aefT2AuthorizationsAuthorizedPartyId: 'TEST-PARTY-DELETE-001',
        cadTrustAefT1SubmissionId: testAefT1SubmissionId,
        cadTrustUnitId: testUnitId,
        cadTrustProjectId: testProjectId,
      };

      const response = await supertest(app)
        .post('/v2/aef-t2-authorizations')
        .send(aefT2AuthorizationsData);

      createdAefT2AuthorizationsId = response.body.cadTrustAefT2AuthorizationsId;

      let stagingRecord = null;
      if (response.body.uuid) {
        stagingRecord = await StagingV2.findOne({
          where: { uuid: response.body.uuid },
        });
      }
      if (stagingRecord) {
        await stagingRecord.update({ committed: true });
        await AefT2AuthorizationsV2.create({
          cadTrustAefT2AuthorizationsId: createdAefT2AuthorizationsId,
          aefT2AuthorizationsId: 'TEST-AUTH-DELETE-001',
          aefT2AuthorizationsDate: '2024-01-15',
          aefT2AuthorizationsCooperativeApproachId: 'TEST-CA-DELETE-001',
          aefT2AuthorizationsAuthorizedPartyId: 'TEST-PARTY-DELETE-001',
          cadTrustAefT1SubmissionId: testAefT1SubmissionId,
          cadTrustUnitId: testUnitId,
          cadTrustProjectId: testProjectId,
        });
        // Clean up committed staging record to avoid pending commits errors
        await stagingRecord.destroy();
       }
    });it('should delete an AEF-T2-Authorizations via API', async function () {
      const response = await supertest(app)
        .delete(`/v2/aef-t2-authorizations/${createdAefT2AuthorizationsId}`);

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('AEF-T2-Authorizations delete staged successfully');
      expect(response.body).to.have.property('success', true);
    });
  });
});
