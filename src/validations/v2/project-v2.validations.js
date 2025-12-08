import Joi from 'joi';
import { pickListValidationV2 } from '../../utils/v2-validation-utils.js';

// Validation schema for project - same for both create and update
// V2 follows V1 pattern: update requests include ALL fields, not just changed ones
export const projectV2Schema = Joi.object({
  projectRegistryName: Joi.string().required(),
  projectId: Joi.string().required(),
  projectCreditingProgram: Joi.string().optional(),
  projectName: Joi.string().required(),
  projectLink: Joi.string().uri().optional(),
  projectDescription: Joi.string().optional(),
  projectSector: Joi.string()
    .custom(pickListValidationV2('projectSector'))
    .optional(),
  projectType: Joi.string()
    .custom(pickListValidationV2('projectType'))
    .optional(),
  projectSubtype: Joi.string().optional(),
  projectStatus: Joi.string()
    .custom(pickListValidationV2('projectStatus'))
    .optional(),
  projectStatusDate: Joi.date().optional(),
  projectUnitMetric: Joi.string()
    .custom(pickListValidationV2('projectUnitMetric'))
    .optional(),
  cadTrustReferenceProjectId: Joi.string().optional(),
  cadTrustProgramId: Joi.string().uuid().optional(),
  // Note: createdAt and updatedAt are automatically managed by Sequelize
  // Note: cadTrustProjectId is auto-generated UUID
  // Note: orgUid is automatically set from home organization and cannot be provided via API
  orgUid: Joi.forbidden().messages({
    'any.unknown': 'orgUid is automatically set from home organization and cannot be provided via API',
  }),
});
