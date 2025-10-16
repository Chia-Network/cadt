import Joi from 'joi';
import { pickListValidation } from '../../utils/validation-utils.js';

export const aefT4HoldingsV2Schema = Joi.object({
  cadTrustAefT4HoldingsId: Joi.number().optional(),
  aefT4HoldingsId: Joi.string().required(),
  aefT4HoldingsMetric: Joi.string()
    .custom(pickListValidation('unitMetric'))
    .optional(),
  aefT4HoldingsMitigationType: Joi.string()
    .custom(pickListValidation('mitigationType'))
    .optional(),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional(),
});
