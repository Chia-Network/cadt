import Joi from 'joi';
import { pickListValidation } from '../../utils/validation-utils.js';

export const validationV2Schema = Joi.object({
  cadTrustValidationId: Joi.number().optional(),
  validationId: Joi.string().required(),
  validationType: Joi.string()
    .custom(pickListValidation('validationType'))
    .optional(),
  validationBody: Joi.string()
    .custom(pickListValidation('validationBody'))
    .optional(),
  validationDate: Joi.date().optional(),
  validationCreditPeriodStartDate: Joi.date().optional(),
  validationCreditPeriodEndDate: Joi.date().optional(),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional(),
  cadTrustProjectId: Joi.number().required(),
});
