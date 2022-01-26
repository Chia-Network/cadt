import Joi from 'joi';

export const newRelatedProjectScheme = Joi.object({
  // warehouseProjectId - derived upon creation
  relationshipType: Joi.string().optional(),
  registry: Joi.string().optional(),
});

export const existingRelatedProjectSchema = Joi.object({
  relatedProjectId: Joi.string().required(),
});
