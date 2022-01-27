import Joi from 'joi';

export const relatedProjectSchema = Joi.object({
  // warehouseProjectId - derived upon creation
  id: Joi.string().optional(),
  relationshipType: Joi.string().optional(),
  registry: Joi.string().optional(),
});
