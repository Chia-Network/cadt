import Joi from 'joi';
import { pickListValidation } from '../../utils/validation-utils.js';

export const coBenefitV2Schema = Joi.object({
  cadTrustCoBenefitId: Joi.number().optional(),
  coBenefitId: Joi.string()
    .custom(pickListValidation('coBenefits', 'coBenefitId'))
    .required(),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional(),
  cadTrustProjectId: Joi.number().required(),
});
