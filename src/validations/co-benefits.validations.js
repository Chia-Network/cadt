import Joi from 'joi';

export const cobenefitSchema = Joi.object({
  // orgUid - derived upon creation
  // warehouseProjectId - derived upon creation
  id: Joi.string().optional(),
  cobenefit: Joi.string().required(),
  timeStaged: Joi.date().timestamp().optional(),
  updatedAt: Joi.date().optional(),
  createdAt: Joi.date().optional(),
});
