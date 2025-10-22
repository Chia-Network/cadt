import { createResourceController } from '../generic/resource.controller.js';
import * as V2Models from '../../models/v2/index.js';
import * as V2Validations from '../../validations/v2/index.js';
import { assertRecordExistance } from '../../utils/data-assertions.js';
import { assertRecordExistanceOrStaged, assertV2HomeOrgExists } from '../../utils/v2-data-assertions.js';
import { OrganizationsV2Controller } from './organizations-v2.controller.js';
import { GovernanceV2Controller } from './governance-v2.controller.js';
import { StagingV2Controller } from './staging-v2.controller.js';
import { AuditV2Controller } from './audit-v2.controller.js';

// Project Controller
export const ProjectV2Controller = createResourceController({
  Model: V2Models.ProjectV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.projectV2Schema,
  primaryKey: 'cadTrustProjectId',
  tableName: 'project',
  assertRecordExistance: assertRecordExistanceOrStaged,
  assertHomeOrgExists: assertV2HomeOrgExists,
});

// Validation Controller
export const ValidationV2Controller = createResourceController({
  Model: V2Models.ValidationV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.validationV2Schema,
  primaryKey: 'cadTrustValidationId',
  tableName: 'validation',
  assertRecordExistance: assertRecordExistanceOrStaged,
  assertHomeOrgExists: assertV2HomeOrgExists,
});

// Verification Controller
export const VerificationV2Controller = createResourceController({
  Model: V2Models.VerificationV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.verificationV2Schema,
  primaryKey: 'cadTrustVerificationId',
  tableName: 'verification',
  assertRecordExistance: assertRecordExistanceOrStaged,
  assertHomeOrgExists: assertV2HomeOrgExists,
});

// Methodology Controller
export const MethodologyV2Controller = createResourceController({
  Model: V2Models.MethodologyV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.methodologyV2Schema,
  primaryKey: 'cadTrustMethodologyId',
  tableName: 'methodology',
  assertRecordExistance: assertRecordExistanceOrStaged,
  assertHomeOrgExists: assertV2HomeOrgExists,
});

// Location Controller
export const LocationV2Controller = createResourceController({
  Model: V2Models.LocationV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.locationV2Schema,
  primaryKey: 'cadTrustLocationId',
  tableName: 'location',
  assertRecordExistance: assertRecordExistanceOrStaged,
  assertHomeOrgExists: assertV2HomeOrgExists,
});

// Issuance Controller
export const IssuanceV2Controller = createResourceController({
  Model: V2Models.IssuanceV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.issuanceV2Schema,
  primaryKey: 'cadTrustIssuanceId',
  tableName: 'issuance',
  assertRecordExistance: assertRecordExistanceOrStaged,
  assertHomeOrgExists: assertV2HomeOrgExists,
});

// Unit Controller
export const UnitV2Controller = createResourceController({
  Model: V2Models.UnitV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.unitV2Schema,
  primaryKey: 'cadTrustUnitId',
  tableName: 'unit',
  assertRecordExistance: assertRecordExistanceOrStaged,
  assertHomeOrgExists: assertV2HomeOrgExists,
});

// Project-Methodology Controller
export const ProjectMethodologyV2Controller = createResourceController({
  Model: V2Models.ProjectMethodologyV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.projectMethodologyV2Schema,
  primaryKey: 'id',
  tableName: 'project_methodology',
  assertRecordExistance: assertRecordExistanceOrStaged,
  assertHomeOrgExists: assertV2HomeOrgExists,
});

// Stakeholder Controller
export const StakeholderV2Controller = createResourceController({
  Model: V2Models.StakeholderV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.stakeholderV2Schema,
  primaryKey: 'cadTrustStakeholderId',
  tableName: 'stakeholder',
  assertRecordExistance: assertRecordExistanceOrStaged,
  assertHomeOrgExists: assertV2HomeOrgExists,
});

// Stakeholder-Projects Controller
export const StakeholderProjectsV2Controller = createResourceController({
  Model: V2Models.StakeholderProjectsV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.stakeholderProjectsV2Schema,
  primaryKey: 'cadTrustStakeholderProjectId',
  tableName: 'stakeholder_projects',
  assertRecordExistance: assertRecordExistanceOrStaged,
  assertHomeOrgExists: assertV2HomeOrgExists,
});

// Label Controller
export const LabelV2Controller = createResourceController({
  Model: V2Models.LabelV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.labelV2Schema,
  primaryKey: 'cadTrustLabelId',
  tableName: 'label',
  assertRecordExistance: assertRecordExistanceOrStaged,
  assertHomeOrgExists: assertV2HomeOrgExists,
});

// Unit-Label Controller
export const UnitLabelV2Controller = createResourceController({
  Model: V2Models.UnitLabelV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.unitLabelV2Schema,
  primaryKey: 'id',
  tableName: 'unit_label',
  assertRecordExistance: assertRecordExistanceOrStaged,
  assertHomeOrgExists: assertV2HomeOrgExists,
});

// Co-Benefit Controller
export const CoBenefitV2Controller = createResourceController({
  Model: V2Models.CoBenefitV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.coBenefitV2Schema,
  primaryKey: 'cadTrustCoBenefitId',
  tableName: 'co_benefit',
  assertRecordExistance: assertRecordExistanceOrStaged,
  assertHomeOrgExists: assertV2HomeOrgExists,
});

// Estimation Controller
export const EstimationV2Controller = createResourceController({
  Model: V2Models.EstimationV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.estimationV2Schema,
  primaryKey: 'cadTrustEstimationId',
  tableName: 'estimation',
  assertRecordExistance: assertRecordExistanceOrStaged,
  assertHomeOrgExists: assertV2HomeOrgExists,
});

// Rating Controller
export const RatingV2Controller = createResourceController({
  Model: V2Models.RatingV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.ratingV2Schema,
  primaryKey: 'cadTrustRatingId',
  tableName: 'rating',
  assertRecordExistance: assertRecordExistanceOrStaged,
  assertHomeOrgExists: assertV2HomeOrgExists,
});

// Program Controller
export const ProgramV2Controller = createResourceController({
  Model: V2Models.ProgramV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.programV2Schema,
  primaryKey: 'cadTrustProgramId',
  tableName: 'program',
  assertRecordExistance: assertRecordExistanceOrStaged,
  assertHomeOrgExists: assertV2HomeOrgExists,
});

// AEF T1 Submission Controller
export const AefT1SubmissionV2Controller = createResourceController({
  Model: V2Models.AefT1SubmissionV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.aefT1SubmissionV2Schema,
  primaryKey: 'cadTrustAefT1SubmissionId',
  tableName: 'aef_t1_submission',
  assertRecordExistance: assertRecordExistanceOrStaged,
  assertHomeOrgExists: assertV2HomeOrgExists,
});

// AEF T2 Authorizations Controller
export const AefT2AuthorizationsV2Controller = createResourceController({
  Model: V2Models.AefT2AuthorizationsV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.aefT2AuthorizationsV2Schema,
  primaryKey: 'cadTrustAefT2AuthorizationsId',
  tableName: 'aef_t2_authorizations',
  assertRecordExistance: assertRecordExistanceOrStaged,
  assertHomeOrgExists: assertV2HomeOrgExists,
});

// AEF T3 Actions Controller
export const AefT3ActionsV2Controller = createResourceController({
  Model: V2Models.AefT3ActionsV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.aefT3ActionsV2Schema,
  primaryKey: 'cadTrustAefT3ActionsId',
  tableName: 'aef_t3_actions',
  assertRecordExistance: assertRecordExistanceOrStaged,
  assertHomeOrgExists: assertV2HomeOrgExists,
});

// AEF T4 Holdings Controller
export const AefT4HoldingsV2Controller = createResourceController({
  Model: V2Models.AefT4HoldingsV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.aefT4HoldingsV2Schema,
  primaryKey: 'cadTrustAefT4HoldingsId',
  tableName: 'aef_t4_holdings',
  assertRecordExistance: assertRecordExistanceOrStaged,
  assertHomeOrgExists: assertV2HomeOrgExists,
});

// AEF T5 Authorized Entities Controller
export const AefT5AuthorizedEntitiesV2Controller = createResourceController({
  Model: V2Models.AefT5AuthorizedEntitiesV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.aefT5AuthorizedEntitiesV2Schema,
  primaryKey: 'cadTrustAefT5AuthorizedEntitiesId',
  tableName: 'aef_t5_authorized_entities',
  assertRecordExistance: assertRecordExistanceOrStaged,
  assertHomeOrgExists: assertV2HomeOrgExists,
});

// Organizations Controller (special handling)
export { OrganizationsV2Controller };

// Governance Controller (special handling)
export { GovernanceV2Controller };

// Staging Controller (special handling)
export { StagingV2Controller };

// Audit Controller (special handling)
export { AuditV2Controller };

// Note: More controllers will be added as we create the remaining models and validations
