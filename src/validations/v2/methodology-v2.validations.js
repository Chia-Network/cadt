import Joi from 'joi';
import { pickListValidationV2 } from '../../utils/v2-validation-utils.js';

// Validation schema for methodology - same for both create and update
// V2 follows V1 pattern: update requests include ALL fields, not just changed ones
export const methodologyV2Schema = Joi.object({
  methodologyCode: Joi.string().required(),
  methodologyName: Joi.string().required(),
  methodologyVersion: Joi.string().allow(null).optional(),
  methodologyDate: Joi.date().allow(null).optional(),
  methodologyLink: Joi.alternatives().try(Joi.string().uri(), Joi.allow(null, '')).optional(),
  methodologyType: Joi.string()
    .allow(null)
    .custom(pickListValidationV2('methodologyType'))
    .optional(),
  // Forbidden fields - automatically managed or auto-generated
  createdAt: Joi.any().forbidden().messages({
    'any.unknown': 'createdAt is automatically managed and cannot be set via API',
  }),
  updatedAt: Joi.any().forbidden().messages({
    'any.unknown': 'updatedAt is automatically managed and cannot be set via API',
  }),
  cadTrustMethodologyId: Joi.any().forbidden().messages({
    'any.unknown': 'cadTrustMethodologyId is auto-generated and cannot be set via API',
  }),
}).unknown(false);
