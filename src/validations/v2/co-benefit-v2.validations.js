import Joi from 'joi';

export const coBenefitV2Schema = Joi.object({
  // Primary key - auto-generated, not allowed in requests
  cadTrustCoBenefitId: Joi.string().uuid().forbidden().messages({
    'any.unknown': 'cadTrustCoBenefitId is auto-generated and cannot be set via API',
  }),

  // Required fields
  coBenefitId: Joi.string().valid(
    'SDG 1 - No poverty',
    'SDG 2 - Zero hunger',
    'SDG 3 - Good health and well-being',
    'SDG 4 - Quality education',
    'SDG 5 - Gender equality',
    'SDG 6 - Clean water and sanitation',
    'SDG 7 - Affordable and clean energy',
    'SDG 8 - Decent work and economic growth',
    'SDG 9 - Industry, innovation, and infrastructure',
    'SDG 10 - Reduced inequalities',
    'SDG 11 - Sustainable cities and communities',
    'SDG 12 - Responsible consumption and production',
    'SDG 13 - Climate action',
    'SDG 14 - Life below water',
    'SDG 15 - Life on land',
    'SDG 16 - Peace and justice strong institutions',
    'SDG 17 - Partnerships for the goals'
  ).required().messages({
    'any.required': 'coBenefitId is required',
    'any.only': 'coBenefitId must be one of the valid SDG values',
  }),

  // Foreign key - required
  cadTrustProjectId: Joi.string().uuid().required().messages({
    'any.required': 'cadTrustProjectId is required',
    'string.guid': 'cadTrustProjectId must be a valid UUID',
  }),

  // Timestamps - forbidden in requests
  createdAt: Joi.date().forbidden().messages({
    'any.unknown': 'createdAt is automatically managed and cannot be set via API',
  }),
  updatedAt: Joi.date().forbidden().messages({
    'any.unknown': 'updatedAt is automatically managed and cannot be set via API',
  }),
});
