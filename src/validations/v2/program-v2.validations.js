import Joi from 'joi';

// Validation schema for program - same for both create and update
// V2 follows V1 pattern: update requests include ALL fields, not just changed ones
export const programV2Schema = Joi.object({
  programName: Joi.string().required(),
  programRegistry: Joi.string().required(),
  programRegistryActivityId: Joi.string().required(),
  programRegistryProgramId: Joi.string().optional(),
  programDescription: Joi.string().optional(),
  // Note: createdAt and updatedAt are automatically managed by Sequelize
  // Note: cadTrustProgramId is auto-generated INTEGER
});
