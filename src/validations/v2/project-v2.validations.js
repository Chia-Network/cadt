import Joi from 'joi';
import { pickListValidation } from '../../utils/validation-utils.js';

export const projectV2Schema = Joi.object({
  cadTrustProjectId: Joi.string().optional(),
  projectRegistryName: Joi.string().required(),
  projectId: Joi.string().required(),
  projectCreditingProgram: Joi.string().optional(),
  projectName: Joi.string().required(),
  projectSector: Joi.string()
    .custom(pickListValidation('projectSector'))
    .optional(),
  projectType: Joi.string()
    .custom(pickListValidation('projectType'))
    .optional(),
  projectStatus: Joi.string()
    .custom(pickListValidation('projectStatusValues', 'projectStatus'))
    .optional(),
  projectDescription: Joi.string().optional(),
  projectAdditionalInfo: Joi.string().optional(),
  projectDeveloper: Joi.string().optional(),
  projectValidator: Joi.string().optional(),
  projectVerifier: Joi.string().optional(),
  projectCountry: Joi.string().optional(),
  projectStartDate: Joi.date().optional(),
  projectCreditingPeriodStart: Joi.date().optional(),
  projectCreditingPeriodEnd: Joi.date().optional(),
  projectUnitMetric: Joi.string()
    .custom(pickListValidation('unitMetric'))
    .optional(),
  projectVintage: Joi.string().optional(),
  projectQuantity: Joi.number().optional(),
  projectQuantityUnit: Joi.string().optional(),
  projectQuantityUnitOther: Joi.string().optional(),
  orgUid: Joi.string().required(),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional(),
  projectRegistryId: Joi.string().optional(),
  projectRegistryUrl: Joi.string().optional(),
  projectQuantityIssued: Joi.number().optional(),
});



