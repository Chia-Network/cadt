import Joi from 'joi';

export const labelUnitSchema = Joi.object({
  // orgUid - derived upon creation
  // warehouseProjectId - derived upon creation
  id: Joi.string().optional(),
  orgUid: Joi.string(),
  warehouseUnitId: Joi.string(),
  labelId: Joi.string(),
  timeStaged: Joi.date().timestamp().optional(),
  updatedAt: Joi.date().optional(),
  createdAt: Joi.date().optional(),
});
