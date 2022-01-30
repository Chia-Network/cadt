import Joi from 'joi';

export const relatedProjectSchema = Joi.object({
  // orgUid - derived upon creation
  // warehouseProjectId - derived upon creation
  id: Joi.string().optional(),
  // Need to add 'relatedProjectId' as an optional field with STRING type.
  // A project may not exist in the warehouse, so we need to list the project ID as it would appear in the associated registry.
  relationshipType: Joi.string().optional(),
  registry: Joi.string().optional(),
  updatedAt: Joi.date().timestamp().optional(),
  createdAt: Joi.date().timestamp().optional(),
});
