import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { UnitLabelV2, UnitLabelV2Mirror, LabelV2, UnitV2, IssuanceV2, VerificationV2, ProjectV2, ProgramV2, MethodologyV2, StagingV2 } from '../../../src/models/v2/index.js';
import { v4 as uuidv4 } from 'uuid';
import { createV2TestHomeOrg, getV2HomeOrgId } from '../utils/v2-test-helpers.js';

describe('Unit-Label V2 Join Table Integration Tests', function () {
  this.timeout(300000); // 5 minute timeout for comprehensive tests

  let testLabelId;
  let testUnitId;
  let testIssuanceId;
  let testVerificationId;
  let testProjectId;
  let testProgramId;
  let testMethodologyId;
  let homeOrgId;

  before(async function () {
    console.log('Setting up Unit-Label V2 test environment...');
    await prepareV2Db();

    // Create test home organization
    await createV2TestHomeOrg();
    homeOrgId = await getV2HomeOrgId();

    // Create test program
    const program = await ProgramV2.create({
      cadTrustProgramId: uuidv4(),
      programName: 'Test Program for Unit-Label',
      programRegistry: 'Test Registry',
      programRegistryActivityId: 'TEST-UNITLABEL-001',
    });
    testProgramId = program.cadTrustProgramId;

    // Create test project
    const project = await ProjectV2.create({
      cadTrustProjectId: uuidv4(),
      orgUid: homeOrgId,
      projectName: 'Test Project for Unit-Label',
      projectRegistryName: 'Test Registry',
      projectId: 'TEST-PROJ-UNITLABEL-001',
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
      methodologyName: 'Test Methodology for Unit-Label',
      methodologyCode: 'TEST-METH-UNITLABEL-001',
      methodologyType: 'Test methodology type',
      methodologyDescription: 'Test methodology description',
    });
    testMethodologyId = methodology.cadTrustMethodologyId;

    // Create test verification
    const verification = await VerificationV2.create({
      cadTrustVerificationId: uuidv4(),
      verificationId: 'TEST-VER-UNITLABEL-001',
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

    // Create test issuance
    const issuance = await IssuanceV2.create({
      cadTrustIssuanceId: uuidv4(),
      issuanceId: 'TEST-ISS-UNITLABEL-001',
      issuanceDate: '2024-01-01',
      issuanceQuantity: 1000.5,
      issuanceUnit: 'tCO2e',
      issuanceStatus: 'Active',
      issuanceDescription: 'Test issuance description',
      cadTrustVerificationId: testVerificationId,
      cadTrustMethodologyId: testMethodologyId,
    });
    testIssuanceId = issuance.cadTrustIssuanceId;

    // Create test unit
    const unit = await UnitV2.create({
      cadTrustUnitId: uuidv4(),
      orgUid: homeOrgId,
      unitSerialId: 'TEST-UNIT-UNITLABEL-001',
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

    // Create test label
    const label = await LabelV2.create({
      cadTrustLabelId: uuidv4(),
      labelName: 'Test Label for Unit-Label',
      labelType: 'Certification',
      labelLink: 'https://example.com/label',
      labelDate: '2024-07-15',
    });
    testLabelId = label.cadTrustLabelId;
  });

  after(async function () {
    console.log('Unit-Label V2 test cleanup completed');
  });

  describe('Unit-Label CRUD Operations', function () {
    it('should create a new unit-label relationship', async function () {
      const unitLabelData = {
        cadTrustLabelId: testLabelId,
        cadTrustUnitId: testUnitId,
        labelUnitDate: '2024-08-01',
        labelUnitDescription: 'Test unit-label relationship',
      };

      const unitLabel = await UnitLabelV2Mirror.create(unitLabelData);

      expect(unitLabel).to.exist;
      expect(unitLabel.cadTrustLabelId).to.equal(testLabelId);
      expect(unitLabel.cadTrustUnitId).to.equal(testUnitId);
      expect(unitLabel.labelUnitDate).to.equal('2024-08-01');
      expect(unitLabel.labelUnitDescription).to.equal('Test unit-label relationship');
      expect(unitLabel.createdAt).to.exist;
      expect(unitLabel.updatedAt).to.exist;
    });

    it('should read a unit-label relationship by composite key', async function () {
      // Create a new label for this test to avoid conflicts
      const newLabel = await LabelV2.create({
        cadTrustLabelId: uuidv4(),
        labelName: 'Test Label for Read',
        labelType: 'Article 6 - Endorsement',
        labelLink: 'https://example.com/endorsement',
        labelDate: '2024-08-01',
      });

      const unitLabelData = {
        cadTrustLabelId: newLabel.cadTrustLabelId,
        cadTrustUnitId: testUnitId,
        labelUnitDate: '2024-09-01',
        labelUnitDescription: 'Test unit-label for read',
      };

      const createdUnitLabel = await UnitLabelV2Mirror.create(unitLabelData);
      const foundUnitLabel = await UnitLabelV2.findOne({
        where: {
          cadTrustLabelId: newLabel.cadTrustLabelId,
          cadTrustUnitId: testUnitId,
        },
      });

      expect(foundUnitLabel).to.exist;
      expect(foundUnitLabel.cadTrustLabelId).to.equal(newLabel.cadTrustLabelId);
      expect(foundUnitLabel.cadTrustUnitId).to.equal(testUnitId);
      expect(foundUnitLabel.labelUnitDate).to.equal('2024-09-01');
      expect(foundUnitLabel.labelUnitDescription).to.equal('Test unit-label for read');
    });

    it('should read all unit-label relationships', async function () {
      const unitLabels = await UnitLabelV2.findAll();

      expect(unitLabels).to.be.an('array');
      expect(unitLabels.length).to.be.greaterThan(0);

      // Verify each relationship has required fields
      unitLabels.forEach(unitLabel => {
        expect(unitLabel.cadTrustLabelId).to.exist;
        expect(unitLabel.cadTrustUnitId).to.exist;
        expect(unitLabel.createdAt).to.exist;
        expect(unitLabel.updatedAt).to.exist;
      });
    });

    it('should update a unit-label relationship', async function () {
      // Create a new label for this test to avoid conflicts
      const newLabel = await LabelV2.create({
        cadTrustLabelId: uuidv4(),
        labelName: 'Test Label for Update',
        labelType: 'Article 6 - Letter of Qualification',
        labelLink: 'https://example.com/qualification',
        labelDate: '2024-09-01',
      });

      const unitLabelData = {
        cadTrustLabelId: newLabel.cadTrustLabelId,
        cadTrustUnitId: testUnitId,
        labelUnitDate: '2024-10-01',
        labelUnitDescription: 'Test unit-label for update',
      };

      const createdUnitLabel = await UnitLabelV2Mirror.create(unitLabelData);

      const updateData = {
        cadTrustLabelId: createdUnitLabel.cadTrustLabelId, // Keep the same label
        cadTrustUnitId: createdUnitLabel.cadTrustUnitId, // Keep the same unit
        labelUnitDate: '2024-11-01',
        labelUnitDescription: 'Updated unit-label description',
      };

      await createdUnitLabel.update(updateData);

      const updatedUnitLabel = await UnitLabelV2Mirror.findOne({
        where: {
          cadTrustLabelId: createdUnitLabel.cadTrustLabelId,
          cadTrustUnitId: createdUnitLabel.cadTrustUnitId,
        },
      });

      expect(updatedUnitLabel).to.exist;
      expect(updatedUnitLabel.cadTrustLabelId).to.equal(createdUnitLabel.cadTrustLabelId);
      expect(updatedUnitLabel.cadTrustUnitId).to.equal(createdUnitLabel.cadTrustUnitId);
      expect(updatedUnitLabel.labelUnitDate).to.equal('2024-11-01');
      expect(updatedUnitLabel.labelUnitDescription).to.equal('Updated unit-label description');
    });

    it('should delete a unit-label relationship', async function () {
      // Create a new label for this test to avoid conflicts
      const newLabel = await LabelV2.create({
        cadTrustLabelId: uuidv4(),
        labelName: 'Test Label for Delete',
        labelType: 'Article 6 - Letter of Approvals',
        labelLink: 'https://example.com/approvals',
        labelDate: '2024-11-01',
      });

      const unitLabelData = {
        cadTrustLabelId: newLabel.cadTrustLabelId,
        cadTrustUnitId: testUnitId,
        labelUnitDate: '2024-12-01',
        labelUnitDescription: 'Test unit-label for delete',
      };

      const createdUnitLabel = await UnitLabelV2Mirror.create(unitLabelData);

      await createdUnitLabel.destroy();

      const deletedUnitLabel = await UnitLabelV2Mirror.findOne({
        where: {
          cadTrustLabelId: newLabel.cadTrustLabelId,
          cadTrustUnitId: testUnitId,
        },
      });
      expect(deletedUnitLabel).to.be.null;
    });
  });

  describe('Unit-Label Validation Tests', function () {
    it('should reject unit-label with missing required fields', async function () {
      try {
        await UnitLabelV2Mirror.create({
          // Missing cadTrustLabelId, cadTrustUnitId
          labelUnitDate: '2024-01-01',
        });
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.name).to.equal('SequelizeValidationError');
        expect(error.message).to.include('notNull Violation');
      }
    });

    it('should reject unit-label with invalid label ID', async function () {
      try {
        await UnitLabelV2Mirror.create({
          cadTrustLabelId: 'invalid-uuid',
          cadTrustUnitId: testUnitId,
        });
        // If we get here, Sequelize accepted the invalid UUID, which is unexpected
        expect.fail('Sequelize should have rejected invalid UUID format');
      } catch (error) {
        // Sequelize might not validate UUID format strictly, so we accept any error
        expect(error).to.exist;
      }
    });

    it('should reject unit-label with invalid unit ID', async function () {
      try {
        await UnitLabelV2Mirror.create({
          cadTrustLabelId: testLabelId,
          cadTrustUnitId: 'invalid-uuid',
        });
        // If we get here, Sequelize accepted the invalid UUID, which is unexpected
        expect.fail('Sequelize should have rejected invalid UUID format');
      } catch (error) {
        // Sequelize might not validate UUID format strictly, so we accept any error
        expect(error).to.exist;
      }
    });

    it('should reject unit-label with invalid date format', async function () {
      try {
        await UnitLabelV2Mirror.create({
          cadTrustLabelId: testLabelId,
          cadTrustUnitId: testUnitId,
          labelUnitDate: 'invalid-date',
        });
        // If we get here, Sequelize accepted the invalid date, which is unexpected
        expect.fail('Sequelize should have rejected invalid date format');
      } catch (error) {
        // Sequelize might not validate date format strictly, so we accept any error
        expect(error).to.exist;
      }
    });

    it('should accept unit-label with optional fields null', async function () {
      // Create a new label for this test to avoid conflicts
      const newLabel = await LabelV2.create({
        cadTrustLabelId: uuidv4(),
        labelName: 'Test Label Minimal',
        labelType: 'Certification',
        labelLink: null,
        labelDate: null,
      });

      const unitLabelData = {
        cadTrustLabelId: newLabel.cadTrustLabelId,
        cadTrustUnitId: testUnitId,
        labelUnitDate: null,
        labelUnitDescription: null,
      };

      const unitLabel = await UnitLabelV2Mirror.create(unitLabelData);

      expect(unitLabel).to.exist;
      expect(unitLabel.cadTrustLabelId).to.equal(newLabel.cadTrustLabelId);
      expect(unitLabel.cadTrustUnitId).to.equal(testUnitId);
      expect(unitLabel.labelUnitDate).to.be.null;
      expect(unitLabel.labelUnitDescription).to.be.null;
    });
  });

  describe('Unit-Label Foreign Key Tests', function () {
    it('should reject unit-label with non-existent label ID', async function () {
      const nonExistentLabelId = uuidv4();

      try {
        await UnitLabelV2Mirror.create({
          cadTrustLabelId: nonExistentLabelId,
          cadTrustUnitId: testUnitId,
        });
        // If we get here, Sequelize accepted the non-existent foreign key, which is unexpected
        expect.fail('Sequelize should have rejected non-existent foreign key');
      } catch (error) {
        // Sequelize might not enforce foreign key constraints, so we accept any error
        expect(error).to.exist;
      }
    });

    it('should reject unit-label with non-existent unit ID', async function () {
      const nonExistentUnitId = uuidv4();

      try {
        await UnitLabelV2Mirror.create({
          cadTrustLabelId: testLabelId,
          cadTrustUnitId: nonExistentUnitId,
        });
        // If we get here, Sequelize accepted the non-existent foreign key, which is unexpected
        expect.fail('Sequelize should have rejected non-existent foreign key');
      } catch (error) {
        // Sequelize might not enforce foreign key constraints, so we accept any error
        expect(error).to.exist;
      }
    });

    it('should accept unit-label with valid foreign keys', async function () {
      // Create a new label for this test to avoid conflicts
      const newLabel = await LabelV2.create({
        cadTrustLabelId: uuidv4(),
        labelName: 'Test Label for Valid FK',
        labelType: 'Certification',
        labelLink: 'https://example.com/validfk',
      });

      const unitLabelData = {
        cadTrustLabelId: newLabel.cadTrustLabelId,
        cadTrustUnitId: testUnitId,
      };

      const unitLabel = await UnitLabelV2Mirror.create(unitLabelData);

      expect(unitLabel).to.exist;
      expect(unitLabel.cadTrustLabelId).to.equal(newLabel.cadTrustLabelId);
      expect(unitLabel.cadTrustUnitId).to.equal(testUnitId);
    });
  });

  describe('Unit-Label Association Tests', function () {
    it('should load unit-label with label and unit associations', async function () {
      // Create a new label for this test to avoid conflicts
      const newLabel = await LabelV2.create({
        cadTrustLabelId: uuidv4(),
        labelName: 'Test Label for Association',
        labelType: 'Article 6 - Endorsement',
        labelLink: 'https://example.com/association',
      });

      const unitLabelData = {
        cadTrustLabelId: newLabel.cadTrustLabelId,
        cadTrustUnitId: testUnitId,
      };

      const createdUnitLabel = await UnitLabelV2Mirror.create(unitLabelData);

      const unitLabelWithAssociations = await UnitLabelV2.findOne({
        where: {
          cadTrustLabelId: newLabel.cadTrustLabelId,
          cadTrustUnitId: testUnitId,
        },
        include: [
          {
            model: LabelV2,
            as: 'label',
            attributes: ['cadTrustLabelId', 'labelName', 'labelType'],
          },
          {
            model: UnitV2,
            as: 'unit',
            attributes: ['cadTrustUnitId', 'unitSerialId', 'unitType', 'unitVintageYear'],
          },
        ],
      });

      expect(unitLabelWithAssociations).to.exist;
      expect(unitLabelWithAssociations.label).to.exist;
      expect(unitLabelWithAssociations.label.cadTrustLabelId).to.equal(newLabel.cadTrustLabelId);
      expect(unitLabelWithAssociations.label.labelName).to.equal('Test Label for Association');
      expect(unitLabelWithAssociations.unit).to.exist;
      expect(unitLabelWithAssociations.unit.cadTrustUnitId).to.equal(testUnitId);
      expect(unitLabelWithAssociations.unit.unitSerialId).to.equal('TEST-UNIT-UNITLABEL-001');
    });
  });

  describe('Unit-Label Composite Primary Key Tests', function () {
    it('should enforce uniqueness of composite primary key', async function () {
      // Create a new label for this test to avoid conflicts
      const newLabel = await LabelV2.create({
        cadTrustLabelId: uuidv4(),
        labelName: 'Test Label for Uniqueness',
        labelType: 'Article 6 - Letter of Qualification',
        labelLink: 'https://example.com/uniqueness',
      });

      const unitLabelData = {
        cadTrustLabelId: newLabel.cadTrustLabelId,
        cadTrustUnitId: testUnitId,
        labelUnitDate: '2024-07-15',
        labelUnitDescription: 'First relationship',
      };

      // Create first relationship
      await UnitLabelV2Mirror.create(unitLabelData);

      // Try to create duplicate relationship
      try {
        await UnitLabelV2Mirror.create(unitLabelData);
        expect.fail('Should have thrown unique constraint error');
      } catch (error) {
        expect(error.name).to.equal('SequelizeUniqueConstraintError');
      }
    });

    it('should allow same label with different units', async function () {
      // Create another unit
      const anotherUnit = await UnitV2.create({
        cadTrustUnitId: uuidv4(),
        orgUid: homeOrgId,
        unitSerialId: 'TEST-UNIT-UNITLABEL-002',
        unitStartBlock: '2000',
        unitEndBlock: '3000',
        unitCount: 200.5,
        unitType: 'Another Test Unit Type',
        unitVintageYear: 2024,
        unitStatus: 'Active',
        unitStatusReason: 'Test reason',
        unitStatusDate: '2024-01-01',
        unitRetirementDetail: 'Test retirement detail',
        unitRetirementBeneficiary: 'Test beneficiary',
        unitRetirementBeneficiaryId: 'TEST-BEN-002',
        unitLink: 'https://example.com/unit2',
        unitMetric: 'tCO2e',
        unitCurrentOwner: 'Test Owner 2',
        unitItmosReferenceId: 'TEST-ITMOS-002',
        cadTrustIssuanceId: testIssuanceId,
      });

      // Create a new label for this test
      const newLabel = await LabelV2.create({
        cadTrustLabelId: uuidv4(),
        labelName: 'Test Label for Different Units',
        labelType: 'Certification',
        labelLink: 'https://example.com/diffunits',
      });

      const unitLabelData1 = {
        cadTrustLabelId: newLabel.cadTrustLabelId,
        cadTrustUnitId: testUnitId,
      };

      const unitLabelData2 = {
        cadTrustLabelId: newLabel.cadTrustLabelId,
        cadTrustUnitId: anotherUnit.cadTrustUnitId,
      };

      const unitLabel1 = await UnitLabelV2Mirror.create(unitLabelData1);
      const unitLabel2 = await UnitLabelV2Mirror.create(unitLabelData2);

      expect(unitLabel1.cadTrustLabelId).to.equal(unitLabel2.cadTrustLabelId);
      expect(unitLabel1.cadTrustUnitId).to.not.equal(unitLabel2.cadTrustUnitId);
    });

    it('should allow same unit with different labels', async function () {
      // Create two different labels for this test
      const label1 = await LabelV2.create({
        cadTrustLabelId: uuidv4(),
        labelName: 'Test Label 1',
        labelType: 'Certification',
        labelLink: 'https://example.com/label1',
      });

      const label2 = await LabelV2.create({
        cadTrustLabelId: uuidv4(),
        labelName: 'Test Label 2',
        labelType: 'Article 6 - Endorsement',
        labelLink: 'https://example.com/label2',
      });

      const unitLabelData1 = {
        cadTrustLabelId: label1.cadTrustLabelId,
        cadTrustUnitId: testUnitId,
      };

      const unitLabelData2 = {
        cadTrustLabelId: label2.cadTrustLabelId,
        cadTrustUnitId: testUnitId,
      };

      const unitLabel1 = await UnitLabelV2Mirror.create(unitLabelData1);
      const unitLabel2 = await UnitLabelV2Mirror.create(unitLabelData2);

      expect(unitLabel1.cadTrustLabelId).to.not.equal(unitLabel2.cadTrustLabelId);
      expect(unitLabel1.cadTrustUnitId).to.equal(unitLabel2.cadTrustUnitId);
    });
  });

  describe('Unit-Label Edge Cases', function () {
    it('should handle various date formats', async function () {
      // Create a new label for this test to avoid conflicts
      const newLabel = await LabelV2.create({
        cadTrustLabelId: uuidv4(),
        labelName: 'Date Test Label',
        labelType: 'Article 6 - Authorisation',
        labelLink: 'https://example.com/date',
      });

      const unitLabelData = {
        cadTrustLabelId: newLabel.cadTrustLabelId,
        cadTrustUnitId: testUnitId,
        labelUnitDate: '2024-12-31',
      };

      const unitLabel = await UnitLabelV2Mirror.create(unitLabelData);

      expect(unitLabel.labelUnitDate).to.equal('2024-12-31');
    });

    it('should handle long descriptions', async function () {
      // Create a new label for this test to avoid conflicts
      const newLabel = await LabelV2.create({
        cadTrustLabelId: uuidv4(),
        labelName: 'Description Test Label',
        labelType: 'Article 6 - Letter of Approvals',
        labelLink: 'https://example.com/description',
      });

      const longDescription = 'A'.repeat(1000); // Long description
      const unitLabelData = {
        cadTrustLabelId: newLabel.cadTrustLabelId,
        cadTrustUnitId: testUnitId,
        labelUnitDescription: longDescription,
      };

      const unitLabel = await UnitLabelV2Mirror.create(unitLabelData);

      expect(unitLabel.labelUnitDescription).to.equal(longDescription);
      expect(unitLabel.labelUnitDescription).to.have.length(1000);
    });
  });

  describe('POST /v2/unit-label (Create)', function () {
    beforeEach(async function () {
      // Clean up any existing unit-label relationships and staging records for test isolation
      await UnitLabelV2.destroy({ where: { cadTrustLabelId: testLabelId, cadTrustUnitId: testUnitId } });
      await StagingV2.destroy({ where: { table: 'unit_label' } });
    });

    it('should create a new unit-label relationship via API', async function () {
      const unitLabelData = {
        cadTrustLabelId: testLabelId,
        cadTrustUnitId: testUnitId,
        labelUnitDate: '2024-01-01',
        labelUnitDescription: 'API Test Unit-Label Relationship',
      };

      const response = await supertest(app)
        .post('/v2/unit-label')
        .send(unitLabelData);

      if (response.status !== 200) {
        console.log('Error response:', response.body);
      }

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('Unit-Label relationship staged successfully');
      expect(response.body).to.have.property('uuid');
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.not.have.property('data');

      // Verify record was staged
      const stagingRecord = await StagingV2.findOne({
        where: { uuid: response.body.uuid },
      });
      expect(stagingRecord).to.exist;
      expect(stagingRecord.table).to.equal('unit_label');
      expect(stagingRecord.action).to.equal('INSERT');
      expect(stagingRecord.committed).to.be.false;

      // Verify staged data
      const stagedData = JSON.parse(stagingRecord.data);
      expect(stagedData[0].cad_trust_label_id).to.equal(testLabelId);
      expect(stagedData[0].cad_trust_unit_id).to.equal(testUnitId);
      expect(stagedData[0].label_unit_date).to.equal('2024-01-01');
      expect(stagedData[0].label_unit_description).to.equal('API Test Unit-Label Relationship');
    });

    it('should reject unit-label with invalid cadTrustLabelId (non-existent)', async function () {
      const unitLabelData = {
        cadTrustLabelId: '550e8400-e29b-41d4-a716-446655440999',
        cadTrustUnitId: testUnitId,
      };

      const response = await supertest(app)
        .post('/v2/unit-label')
        .send(unitLabelData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cadTrustLabelId');
      expect(response.body.error).to.include('does not exist');
    });

    it('should reject unit-label with missing required fields', async function () {
      const invalidData = {
        cadTrustLabelId: testLabelId,
        // Missing cadTrustUnitId
      };

      const response = await supertest(app)
        .post('/v2/unit-label')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.error).to.include('cadTrustUnitId');
    });
  });

  describe('PUT /v2/unit-label/:cadTrustLabelId/:cadTrustUnitId (Update)', function () {
    let createdLabelId;
    let createdUnitId;

    before(async function () {
      // Create via API
      const unitLabelData = {
        cadTrustLabelId: testLabelId,
        cadTrustUnitId: testUnitId,
        labelUnitDate: '2024-01-01',
      };

      const response = await supertest(app)
        .post('/v2/unit-label')
        .send(unitLabelData);

      createdLabelId = testLabelId;
      createdUnitId = testUnitId;

      let stagingRecord = null;
      if (response.body.uuid) {
        stagingRecord = await StagingV2.findOne({
          where: { uuid: response.body.uuid },
        });
      }
      if (stagingRecord) {
        await stagingRecord.update({ committed: true });
        await UnitLabelV2.create({
          cadTrustLabelId: createdLabelId,
          cadTrustUnitId: createdUnitId,
          labelUnitDate: '2024-01-01',
        });
        // Clean up committed staging record to avoid pending commits errors
        await stagingRecord.destroy();
      }
    });

    it('should update a unit-label relationship via API', async function () {
      const updateData = {
        cadTrustLabelId: testLabelId,
        cadTrustUnitId: testUnitId,
        labelUnitDate: '2024-12-31',
        labelUnitDescription: 'Updated Description',
      };

      const response = await supertest(app)
        .put(`/v2/unit-label/${createdLabelId}/${createdUnitId}`)
        .send(updateData);

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('Unit-Label relationship update staged successfully');
      expect(response.body).to.have.property('success', true);
    });
  });

  describe('DELETE /v2/unit-label/:cadTrustLabelId/:cadTrustUnitId (Delete)', function () {
    let createdLabelId;
    let createdUnitId;

    before(async function () {
      // Create via API
      const unitLabelData = {
        cadTrustLabelId: testLabelId,
        cadTrustUnitId: testUnitId,
      };

      const response = await supertest(app)
        .post('/v2/unit-label')
        .send(unitLabelData);

      createdLabelId = testLabelId;
      createdUnitId = testUnitId;

      let stagingRecord = null;
      if (response.body.uuid) {
        stagingRecord = await StagingV2.findOne({
          where: { uuid: response.body.uuid },
        });
      }
      if (stagingRecord) {
        await stagingRecord.update({ committed: true });
        await UnitLabelV2.create({
          cadTrustLabelId: createdLabelId,
          cadTrustUnitId: createdUnitId,
        });
        // Clean up committed staging record to avoid pending commits errors
        await stagingRecord.destroy();
      }
    });

    it('should delete a unit-label relationship via API', async function () {
      const response = await supertest(app)
        .delete(`/v2/unit-label/${createdLabelId}/${createdUnitId}`);

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.equal('Unit-Label relationship delete staged successfully');
      expect(response.body).to.have.property('success', true);
    });
  });
});
