import { createResourceController } from '../generic/resource.controller.js';
import * as V2Models from '../../models/v2/index.js';
import * as V2Validations from '../../validations/v2/index.js';
import { assertRecordExistance } from '../../utils/data-assertions.js';
import { assertRecordExistanceOrStaged } from '../../utils/v2-data-assertions.js';
import { OrganizationsV2Controller } from './organizations-v2.controller.js';
import { GovernanceV2Controller } from './governance-v2.controller.js';

// Project Controller
export const ProjectV2Controller = createResourceController({
  Model: V2Models.ProjectV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.projectV2Schema,
  primaryKey: 'cadTrustProjectId',
  tableName: 'project',
  assertRecordExistance: assertRecordExistanceOrStaged,
});

// Validation Controller
export const ValidationV2Controller = createResourceController({
  Model: V2Models.ValidationV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.validationV2Schema,
  primaryKey: 'cadTrustValidationId',
  tableName: 'validation',
  assertRecordExistance: assertRecordExistanceOrStaged,
});

// Verification Controller
export const VerificationV2Controller = createResourceController({
  Model: V2Models.VerificationV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.verificationV2Schema,
  primaryKey: 'cadTrustVerificationId',
  tableName: 'verification',
  assertRecordExistance: assertRecordExistanceOrStaged,
});

// Methodology Controller
export const MethodologyV2Controller = createResourceController({
  Model: V2Models.MethodologyV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.methodologyV2Schema,
  primaryKey: 'cadTrustMethodologyId',
  tableName: 'methodology',
  assertRecordExistance: assertRecordExistanceOrStaged,
});

// Location Controller
export const LocationV2Controller = createResourceController({
  Model: V2Models.LocationV2,
  StagingModel: V2Models.StagingV2,
  validationSchema: V2Validations.locationV2Schema,
  primaryKey: 'cadTrustLocationId',
  tableName: 'location',
  assertRecordExistance: assertRecordExistanceOrStaged,
});

// Organizations Controller (special handling)
export { OrganizationsV2Controller };

// Governance Controller (special handling)
export { GovernanceV2Controller };

// Note: More controllers will be added as we create the remaining models and validations
