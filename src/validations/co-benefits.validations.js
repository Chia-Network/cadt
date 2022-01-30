import Joi from 'joi';

export const cobenefitSchema = Joi.object({
  // orgUid - derived upon creation
  // warehouseProjectId - derived upon creation
  id: Joi.string().optional(),
  cobenefit: Joi.string().required(),
  updatedAt: Joi.date().timestamp().optional(),
  createdAt: Joi.date().timestamp().optional(),
});
