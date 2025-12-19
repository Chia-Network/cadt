import { expect } from 'chai';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import {
  ModelKeysV2,
  getV2PrimaryKeyField,
} from '../../../src/utils/v2-model-utils.js';
import {
  ProgramV2,
  MethodologyV2,
  ProjectV2,
  ValidationV2,
  VerificationV2,
  IssuanceV2,
  UnitV2,
  LocationV2,
  EstimationV2,
  RatingV2,
  CoBenefitV2,
  ProjectMethodologyV2,
  StakeholderV2,
  StakeholderProjectV2,
  LabelV2,
  UnitLabelV2,
  AefT1SubmissionV2,
  AefT5AuthorizedEntitiesV2,
  AefT2AuthorizationsV2,
  AefT3ActionsV2,
  AefT4HoldingsV2,
} from '../../../src/models/v2/index.js';

/**
 * Phase 27.1: ModelKeysV2 Utility Tests
 *
 * Tests for ModelKeysV2 mapping and getV2PrimaryKeyField helper function
 */
describe('Phase 27.1: ModelKeysV2 Utility Tests', function () {
  this.timeout(10000);

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();
  });

  describe('ModelKeysV2 Mapping', function () {
    it('should export ModelKeysV2 object', function () {
      expect(ModelKeysV2).to.exist;
      expect(ModelKeysV2).to.be.an('object');
    });

    it('should map all 21 V2 data models correctly', function () {
      const expectedKeys = [
        'program',
        'methodology',
        'project',
        'validation',
        'verification',
        'issuance',
        'unit',
        'location',
        'estimation',
        'rating',
        'co_benefit',
        'project_methodology',
        'stakeholder',
        'stakeholder_projects',
        'label',
        'unit_label',
        'aef_t1_submission',
        'aef_t5_authorized_entities',
        'aef_t2_authorizations',
        'aef_t3_actions',
        'aef_t4_holdings',
      ];

      const actualKeys = Object.keys(ModelKeysV2);
      expect(actualKeys.length).to.equal(21);
      expectedKeys.forEach((key) => {
        expect(ModelKeysV2).to.have.property(key);
      });
    });

    it('should map program to ProgramV2', function () {
      expect(ModelKeysV2.program).to.equal(ProgramV2);
    });

    it('should map project to ProjectV2', function () {
      expect(ModelKeysV2.project).to.equal(ProjectV2);
    });

    it('should map unit to UnitV2', function () {
      expect(ModelKeysV2.unit).to.equal(UnitV2);
    });

    it('should map all models to correct V2 model classes', function () {
      expect(ModelKeysV2.program).to.equal(ProgramV2);
      expect(ModelKeysV2.methodology).to.equal(MethodologyV2);
      expect(ModelKeysV2.project).to.equal(ProjectV2);
      expect(ModelKeysV2.validation).to.equal(ValidationV2);
      expect(ModelKeysV2.verification).to.equal(VerificationV2);
      expect(ModelKeysV2.issuance).to.equal(IssuanceV2);
      expect(ModelKeysV2.unit).to.equal(UnitV2);
      expect(ModelKeysV2.location).to.equal(LocationV2);
      expect(ModelKeysV2.estimation).to.equal(EstimationV2);
      expect(ModelKeysV2.rating).to.equal(RatingV2);
      expect(ModelKeysV2.co_benefit).to.equal(CoBenefitV2);
      expect(ModelKeysV2.project_methodology).to.equal(ProjectMethodologyV2);
      expect(ModelKeysV2.stakeholder).to.equal(StakeholderV2);
      expect(ModelKeysV2.stakeholder_projects).to.equal(StakeholderProjectV2);
      expect(ModelKeysV2.label).to.equal(LabelV2);
      expect(ModelKeysV2.unit_label).to.equal(UnitLabelV2);
      expect(ModelKeysV2.aef_t1_submission).to.equal(AefT1SubmissionV2);
      expect(ModelKeysV2.aef_t5_authorized_entities).to.equal(
        AefT5AuthorizedEntitiesV2,
      );
      expect(ModelKeysV2.aef_t2_authorizations).to.equal(AefT2AuthorizationsV2);
      expect(ModelKeysV2.aef_t3_actions).to.equal(AefT3ActionsV2);
      expect(ModelKeysV2.aef_t4_holdings).to.equal(AefT4HoldingsV2);
    });
  });

  describe('getV2PrimaryKeyField', function () {
    it('should export getV2PrimaryKeyField function', function () {
      expect(getV2PrimaryKeyField).to.exist;
      expect(getV2PrimaryKeyField).to.be.a('function');
    });

    it('should return correct primary key field for program', function () {
      expect(getV2PrimaryKeyField('program')).to.equal(
        'cad_trust_program_id',
      );
    });

    it('should return correct primary key field for project', function () {
      expect(getV2PrimaryKeyField('project')).to.equal(
        'cad_trust_project_id',
      );
    });

    it('should return correct primary key field for unit', function () {
      expect(getV2PrimaryKeyField('unit')).to.equal('cad_trust_unit_id');
    });

    it('should return UUID field names for join tables', function () {
      expect(getV2PrimaryKeyField('project_methodology')).to.equal('cad_trust_project_methodology_id');
      expect(getV2PrimaryKeyField('stakeholder_projects')).to.equal('cad_trust_stakeholder_project_id');
      expect(getV2PrimaryKeyField('unit_label')).to.equal('cad_trust_unit_label_id');
    });

    it('should return correct primary key for all models', function () {
      expect(getV2PrimaryKeyField('methodology')).to.equal(
        'cad_trust_methodology_id',
      );
      expect(getV2PrimaryKeyField('validation')).to.equal(
        'cad_trust_validation_id',
      );
      expect(getV2PrimaryKeyField('verification')).to.equal(
        'cad_trust_verification_id',
      );
      expect(getV2PrimaryKeyField('issuance')).to.equal(
        'cad_trust_issuance_id',
      );
      expect(getV2PrimaryKeyField('location')).to.equal(
        'cad_trust_location_id',
      );
      expect(getV2PrimaryKeyField('estimation')).to.equal(
        'cad_trust_estimation_id',
      );
      expect(getV2PrimaryKeyField('rating')).to.equal('cad_trust_rating_id');
      expect(getV2PrimaryKeyField('co_benefit')).to.equal(
        'cad_trust_co_benefit_id',
      );
      expect(getV2PrimaryKeyField('stakeholder')).to.equal(
        'cad_trust_stakeholder_id',
      );
      expect(getV2PrimaryKeyField('label')).to.equal('cad_trust_label_id');
      expect(getV2PrimaryKeyField('aef_t1_submission')).to.equal(
        'cad_trust_aef_t1_submission_id',
      );
      expect(getV2PrimaryKeyField('aef_t5_authorized_entities')).to.equal(
        'cad_trust_aef_t5_authorized_entities_id',
      );
      expect(getV2PrimaryKeyField('aef_t2_authorizations')).to.equal(
        'cad_trust_aef_t2_authorizations_id',
      );
      expect(getV2PrimaryKeyField('aef_t3_actions')).to.equal(
        'cad_trust_aef_t3_actions_id',
      );
      expect(getV2PrimaryKeyField('aef_t4_holdings')).to.equal(
        'cad_trust_aef_t4_holdings_id',
      );
    });

    it('should return null for unknown model key', function () {
      expect(getV2PrimaryKeyField('unknown_model')).to.be.null;
      expect(getV2PrimaryKeyField('')).to.be.null;
    });
  });

  describe('Integration: ModelKeysV2 with getV2PrimaryKeyField', function () {
    it('should work together to identify model and primary key', function () {
      const modelKey = 'project';
      const ModelClass = ModelKeysV2[modelKey];
      const primaryKeyField = getV2PrimaryKeyField(modelKey);

      expect(ModelClass).to.equal(ProjectV2);
      expect(primaryKeyField).to.equal('cad_trust_project_id');
    });

    it('should handle join tables correctly', function () {
      const modelKey = 'project_methodology';
      const ModelClass = ModelKeysV2[modelKey];
      const primaryKeyField = getV2PrimaryKeyField(modelKey);

      expect(ModelClass).to.equal(ProjectMethodologyV2);
      expect(primaryKeyField).to.equal('cad_trust_project_methodology_id');
    });
  });
});

