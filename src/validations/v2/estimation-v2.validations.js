import Joi from 'joi';

export const estimationV2Schema = Joi.object({
  // Primary key - auto-generated, not allowed in requests
  cadTrustEstimationId: Joi.string().uuid().forbidden().messages({
    'any.unknown': 'cadTrustEstimationId is auto-generated and cannot be set via API',
  }),

  // Required fields
  estimationStartDate: Joi.date().iso().required().messages({
    'any.required': 'estimationStartDate is required',
    'date.format': 'estimationStartDate must be a valid ISO date (YYYY-MM-DD)',
  }),

  estimationEndDate: Joi.date().iso().required().messages({
    'any.required': 'estimationEndDate is required',
    'date.format': 'estimationEndDate must be a valid ISO date (YYYY-MM-DD)',
  }),

  // Optional fields
  estimationUnitCount: Joi.number().precision(6).optional().messages({
    'number.precision': 'estimationUnitCount must have at most 6 decimal places',
  }),

  estimationReferenceNo: Joi.string().max(255).optional().messages({
    'string.max': 'estimationReferenceNo must not exceed 255 characters',
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
}).custom((value, helpers) => {
  // Custom validation: end date must be after start date
  if (value.estimationStartDate && value.estimationEndDate) {
    const startDate = new Date(value.estimationStartDate);
    const endDate = new Date(value.estimationEndDate);

    if (endDate <= startDate) {
      return helpers.error('custom.dateRange', {
        message: 'estimationEndDate must be after estimationStartDate',
      });
    }
  }

  return value;
}).messages({
  'custom.dateRange': '{{#message}}',
});
