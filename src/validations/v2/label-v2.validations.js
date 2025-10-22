import Joi from 'joi';
import { pickListValidation } from '../../utils/validation-utils.js';

export const labelV2Schema = Joi.object({
  cadTrustLabelId: Joi.string().optional(),
  labelName: Joi.string().required(),
  labelType: Joi.string()
    .custom(pickListValidation('labelType'))
    .optional(),
  labelLink: Joi.string().optional(),
  labelDate: Joi.date().optional(),
});
