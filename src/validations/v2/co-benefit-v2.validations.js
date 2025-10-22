import Joi from 'joi';
import { pickListValidation } from '../../utils/validation-utils.js';

export const coBenefitV2Schema = Joi.object({
  cadTrustCoBenefitId: Joi.string().optional(),
  coBenefitId: Joi.string()
    .custom(pickListValidation('coBenefits', 'coBenefitId'))
    .required(),
  cadTrustProjectId: Joi.string().required(),
});
