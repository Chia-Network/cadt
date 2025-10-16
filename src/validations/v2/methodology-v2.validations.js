import Joi from 'joi';
import { pickListValidation } from '../../utils/validation-utils.js';

export const methodologyV2Schema = Joi.object({
  cadTrustMethodologyId: Joi.number().optional(),
  methodologyCode: Joi.string().required(),
  methodologyName: Joi.string().required(),
  methodologyVersion: Joi.string().optional(),
  methodologyDate: Joi.date().optional(),
  methodologyLink: Joi.string().optional(),
  methodologyType: Joi.string()
    .custom(pickListValidation('methodologyType'))
    .optional(),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional(),
});
