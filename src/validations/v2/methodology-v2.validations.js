import Joi from 'joi';
import { pickListValidationV2 } from '../../utils/v2-validation-utils.js';

// Validation schema for methodology - same for both create and update
// V2 follows V1 pattern: update requests include ALL fields, not just changed ones
export const methodologyV2Schema = Joi.object({
  methodologyCode: Joi.string().max(255).required(),
  methodologyName: Joi.string().max(255).required(),
  methodologyVersion: Joi.string().max(50).allow(null).optional(),
  methodologyDate: Joi.date().allow(null).optional(),
  methodologyLink: Joi.string()
    .uri()
    .max(500)
    .allow(null, '')
    .optional(),
  methodologyType: Joi.string()
    .max(100)
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
