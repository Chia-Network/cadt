import { getPicklistValuesV2 } from './v2-data-loaders';

export const pickListValidationV2 = (field, name) => (value, helper) => {
  const pickList = getPicklistValuesV2();

  if (pickList[field].includes(value)) {
    return value;
  }

  return helper.message(
    `${name || field} does not include a valid option ${pickList[field].join(
      ', ',
    )} instead got '${value}'`,
  );
};
