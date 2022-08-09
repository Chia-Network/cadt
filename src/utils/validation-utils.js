import { getPicklistValues } from './data-loaders';

export const pickListValidation = (field, name) => (value, helper) => {
  const pickList = getPicklistValues();

  if (pickList[field].includes(value)) {
    return value;
  }

  return helper.message(
    `${name || field} does not include a valid option ${pickList[field].join(
      ', ',
    )} instead got '${value}'`,
  );
};
