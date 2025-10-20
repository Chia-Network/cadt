import Joi from 'joi';
import { pickListValidation } from '../../utils/validation-utils.js';

export const stakeholderV2Schema = Joi.object({
  cadTrustStakeholderId: Joi.number().optional(),
  stakeholderName: Joi.string().required(),
  stakeholderType: Joi.string()
    .custom(pickListValidation('stakeholderType'))
    .optional(),
  stakeholderLink: Joi.string().optional(),
});
