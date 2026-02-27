import Joi from 'joi';
import { pickListValidationV2, pickListArrayValidationV2 } from '../../utils/v2-validation-utils.js';

// Validation schema for project - same for both create and update
// V2 follows V1 pattern: update requests include ALL fields, not just changed ones
export const projectV2Schema = Joi.object({
  projectRegistryName: Joi.string().max(255).required(),
  projectId: Joi.string().max(255).required(),
  projectCreditingProgram: Joi.string().max(255).allow(null).optional(),
  projectName: Joi.string().max(500).required(),
  projectLink: Joi.string()
    .uri()
    .max(500)
    .required(),
  projectDescription: Joi.string().max(2000).allow(null).optional(),
  // projectSector is an array of strings, each validated against the projectSector picklist
  projectSector: Joi.array()
    .items(Joi.string().max(255))
    .custom(pickListArrayValidationV2('projectSector'))
    .required(),
  // projectType is an array of strings, each validated against the projectType picklist
  projectType: Joi.array()
    .items(Joi.string().max(255))
    .custom(pickListArrayValidationV2('projectType'))
    .required(),
  projectSubtype: Joi.string().max(255).allow(null).optional(),
  // projectStatus is a single string validated against the projectStatus picklist
  projectStatus: Joi.string()
    .max(255)
    .custom(pickListValidationV2('projectStatus'))
    .required(),
  projectStatusDate: Joi.date().required(),
  projectUnitMetric: Joi.string()
    .max(255)
    .custom(pickListValidationV2('projectUnitMetric'))
    .required(),
  cadTrustReferenceProjectId: Joi.string().max(255).allow(null).optional(),
  cadTrustProgramId: Joi.string().uuid().allow(null).optional(),
  // Note: createdAt and updatedAt are automatically managed by Sequelize
  // Note: cadTrustProjectId is auto-generated UUID
  // Note: orgUid is automatically set from home organization and cannot be provided via API
  orgUid: Joi.forbidden().messages({
    'any.unknown': 'orgUid is automatically set from home organization and cannot be provided via API',
  }),
});
