import Joi from 'joi';
import { pickListValidation } from '../../utils/validation-utils.js';

export const verificationV2Schema = Joi.object({
  cadTrustVerificationId: Joi.number().optional(),
  verificationId: Joi.string().required(),
  verificationStartDate: Joi.date().optional(),
  verificationEndDate: Joi.date().optional(),
  verificationBody: Joi.string()
    .custom(pickListValidation('verificationBody'))
    .optional(),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional(),
  cadTrustProjectId: Joi.number().required(),
  cadTrustValidationId: Joi.number().optional(),
});
