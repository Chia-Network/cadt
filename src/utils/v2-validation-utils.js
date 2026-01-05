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
