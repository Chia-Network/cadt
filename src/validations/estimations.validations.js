import Joi from 'joi';

export const estimationSchema = Joi.object({
  // orgUid - derived upon creation
  // warehouseProjectId - derived upon creation
  id: Joi.string().optional(),
  creditingPeriodStart: Joi.date().required(),
  creditingPeriodEnd: Joi.date()
    .min(Joi.ref('creditingPeriodStart'))
    .required(),
  unitCount: Joi.number().integer().required(),
  timeStaged: Joi.date().timestamp().optional(),
  updatedAt: Joi.date().optional(),
  createdAt: Joi.date().optional(),
});
