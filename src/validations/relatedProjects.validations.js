import Joi from 'joi';

const baseSchema = {
  // warehouseProjectId - derived upon creation
  relationshipType: Joi.string().optional(),
  registry: Joi.string().optional(),
};

export const newRelatedProjectSchema = Joi.object({ ...baseSchema });

export const existingRelatedProjectSchema = Joi.object({
  id: Joi.string().required(),
  ...baseSchema,
});
