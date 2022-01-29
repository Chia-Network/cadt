import Joi from 'joi';

export const estimationSchema = Joi.object({
  // orgUid - derived upon creation
  // warehouseProjectId - derived upon creation
  creditingPeriodStart: Joi.date().required(),
  creditingPeriodEnd: Joi.date()
    .timestamp()
    .min(Joi.ref('startDate'))
    .required(),
  unitCount: Joi.number().integer().required(),
});
