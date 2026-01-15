import { getPicklistValuesV2 } from './v2-data-loaders';

export const pickListValidationV2 = (field, name) => (value, helper) => {
  const pickList = getPicklistValuesV2();

  // Check if picklist field exists and is an array
  if (!pickList || !pickList[field] || !Array.isArray(pickList[field])) {
    return helper.message(
      `${name || field} validation failed: picklist data for '${field}' is not available. Please ensure governance data has been synced.`,
    );
  }

  if (pickList[field].includes(value)) {
    return value;
  }

  return helper.message(
    `${name || field} does not include a valid option. Valid options are: ${pickList[field].join(
      ', ',
    )}. Instead got '${value}'`,
  );
};

/**
 * Validates that all items in an array are valid picklist values
 * @param {string} field - The picklist field name (e.g., 'projectType', 'projectStatus')
 * @param {string} name - Optional display name for error messages
 * @returns {Function} Joi custom validator function
 */
export const pickListArrayValidationV2 = (field, name) => (values, helper) => {
  const pickList = getPicklistValuesV2();

  // Check if picklist field exists and is an array
  if (!pickList || !pickList[field] || !Array.isArray(pickList[field])) {
    return helper.message(
      `${name || field} validation failed: picklist data for '${field}' is not available. Please ensure governance data has been synced.`,
    );
  }

  // Check that values is an array
  if (!Array.isArray(values)) {
    return helper.message(
      `${name || field} must be an array. Instead got '${typeof values}'`,
    );
  }

  // Validate each item in the array against the picklist
  const invalidValues = values.filter(value => !pickList[field].includes(value));

  if (invalidValues.length > 0) {
    return helper.message(
      `${name || field} contains invalid values: ${invalidValues.join(', ')}. Valid options are: ${pickList[field].join(', ')}`,
    );
  }

  return values;
};
