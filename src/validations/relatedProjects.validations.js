import Joi from 'joi';

export const relatedProjectSchema = Joi.object({
  // orgUid - derived upon creation
  // warehouseProjectId - derived upon creation
  id: Joi.string().optional(),
  relatedProjectId: Joi.string().optional(),
  relationshipType: Joi.string().optional(),
  registry: Joi.string().optional(),
  updatedAt: Joi.date().optional(),
  createdAt: Joi.date().optional(),
});
