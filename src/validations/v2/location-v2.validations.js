import Joi from 'joi';
import { pickListValidationV2 } from '../../utils/v2-validation-utils.js';

// Validation schema for location - same for both create and update
// V2 follows V1 pattern: update requests include ALL fields, not just changed ones
export const locationV2Schema = Joi.object({
  locationCountry: Joi.string()
    .custom(pickListValidationV2('locationCountry'))
    .optional(), // No length limit - picklist validation controls valid values
  locationRegion: Joi.string()
    .max(255)
    .optional(),
  locationGis: Joi.string()
    .max(10000) // Large text field for GIS data
    .optional(),
  locationMapType: Joi.string()
    .max(100)
    .optional(),
  locationMapFileLink: Joi.string()
    .uri()
    .max(500)
    .optional(),
  cadTrustProjectId: Joi.string().uuid().required(),
  // Note: createdAt and updatedAt are automatically managed by Sequelize
  // Note: cadTrustLocationId is auto-generated UUID
});
