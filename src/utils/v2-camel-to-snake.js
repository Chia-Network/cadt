'use strict';

// Helper function to convert camelCase to snake_case
export const toSnakeCase = (str) => {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
};

// Helper function to convert snake_case to camelCase
export const toCamelCase = (str) => {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
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

// Helper function to convert object keys from snake_case to camelCase
export const convertToCamelCase = (obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }
  const result = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const camelKey = toCamelCase(key);
      result[camelKey] = obj[key]; // Preserve the value, only convert the key
    }
  }
  return result;
};

