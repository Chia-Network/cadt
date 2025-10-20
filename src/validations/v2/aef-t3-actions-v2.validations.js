import Joi from 'joi';
import { pickListValidation } from '../../utils/validation-utils.js';

export const aefT3ActionsV2Schema = Joi.object({
  cadTrustAefT3ActionsId: Joi.number().optional(),
  aefT3ActionsId: Joi.string().required(),
  aefT3ActionsType: Joi.string()
    .custom(pickListValidation('actionType'))
    .optional(),
  aefT3ActionsMetric: Joi.string()
    .custom(pickListValidation('unitMetric'))
    .optional(),
  aefT3ActionsMitigationType: Joi.string()
    .custom(pickListValidation('mitigationType'))
    .optional(),
});
