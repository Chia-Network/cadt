'use strict';

// Helper function to convert camelCase to snake_case
export const toSnakeCase = (str) => {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
};

// Helper function to convert object keys from camelCase to snake_case
export const convertToSnakeCase = (obj) => {
  const result = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      result[toSnakeCase(key)] = obj[key];
    }
  }
  return result;
};





