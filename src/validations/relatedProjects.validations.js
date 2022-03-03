import Joi from 'joi';

export const relatedProjectSchema = Joi.object({
  // orgUid - derived upon creation
  // warehouseProjectId - derived upon creation
  id: Joi.string().optional(),
  relatedProjectId: Joi.string().required(),
  relationshipType: Joi.string().optional(),
  registry: Joi.string().optional(),
  timeStaged: Joi.date().timestamp().optional(),
  updatedAt: Joi.date().optional(),
  createdAt: Joi.date().optional(),
});
