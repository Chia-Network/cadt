import Joi from 'joi';

// Validation schema for program - same for both create and update
// V2 follows V1 pattern: update requests include ALL fields, not just changed ones
export const programV2Schema = Joi.object({
  // Primary key - auto-generated, not allowed in requests
  cadTrustProgramId: Joi.string().uuid().forbidden().messages({
    'any.unknown': 'cadTrustProgramId is auto-generated and cannot be set via API',
  }),

  programName: Joi.string().required(),
  programRegistry: Joi.string().required(),
  programRegistryActivityId: Joi.string().required(),
  programRegistryProgramId: Joi.string().optional(),
  programDescription: Joi.string().optional(),

  // Timestamps - forbidden in requests
  createdAt: Joi.date().forbidden().messages({
    'any.unknown': 'createdAt is automatically managed and cannot be set via API',
  }),
  updatedAt: Joi.date().forbidden().messages({
    'any.unknown': 'updatedAt is automatically managed and cannot be set via API',
  }),
});
