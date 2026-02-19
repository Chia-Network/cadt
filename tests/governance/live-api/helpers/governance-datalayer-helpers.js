/**
 * Datalayer RPC verification helpers for governance stores.
 * Validates that on-chain stores contain the expected version mapping
 * and governance data (pickList, glossary, orgList).
 */
import {
  validateStoreExists,
  getStoreKeysValues,
  validateStoreKeyValue,
  hexToString,
} from '../../../v2/live-api/helpers/datalayer-test-helpers.js';

/**
 * Validate the main governance body store contains the expected version mapping.
 *
 * The main store holds entries like { v1: <v1StoreId>, v2: <v2StoreId> }.
 *
 * @param {string} mainStoreId - the main governance body store ID
 * @param {Object} expectedVersions - e.g. { v1: '<storeId>' } or { v1: '<id>', v2: '<id>' }
 * @returns {Promise<{valid: boolean, errors: string[], versionStoreIds: Object}>}
 */
export const validateGovernanceMainStore = async (mainStoreId, expectedVersions) => {
  const errors = [];
  const versionStoreIds = {};

  console.log(`\nValidating governance main store: ${mainStoreId}`);

  const storeResult = await validateStoreExists(mainStoreId);
  if (!storeResult.exists) {
    errors.push(`Main governance store ${mainStoreId} does not exist in datalayer`);
    return { valid: false, errors, versionStoreIds };
  }
  if (!storeResult.confirmed) {
    errors.push(`Main governance store ${mainStoreId} is not confirmed`);
    return { valid: false, errors, versionStoreIds };
  }
  console.log(`  Main store exists and is confirmed (hash: ${storeResult.hash})`);

  const keysValues = await getStoreKeysValues(mainStoreId);
  const storeMap = {};
  for (const kv of keysValues) {
    const key = hexToString(kv.key);
    const value = hexToString(kv.value);
    storeMap[key] = value;
  }

  console.log(`  Main store keys: [${Object.keys(storeMap).join(', ')}]`);

  for (const [version, expectedStoreId] of Object.entries(expectedVersions)) {
    if (!storeMap[version]) {
      errors.push(`Main store missing version key '${version}'`);
    } else {
      versionStoreIds[version] = storeMap[version];
      if (expectedStoreId && storeMap[version] !== expectedStoreId) {
        errors.push(`Version '${version}' store ID mismatch: expected ${expectedStoreId}, got ${storeMap[version]}`);
      } else {
        console.log(`  Version '${version}' -> store ${storeMap[version]}`);
      }
    }
  }

  // Check for unexpected keys
  const expectedKeys = Object.keys(expectedVersions);
  const unexpectedKeys = Object.keys(storeMap).filter(k => !expectedKeys.includes(k));
  if (unexpectedKeys.length > 0) {
    console.log(`  Note: unexpected keys in main store: [${unexpectedKeys.join(', ')}]`);
  }

  const valid = errors.length === 0;
  if (valid) {
    console.log(`  Main governance store validation passed`);
  } else {
    console.log(`  Main governance store validation failed:`);
    errors.forEach(err => console.log(`    - ${err}`));
  }

  return { valid, errors, versionStoreIds };
};

/**
 * Validate a version-specific governance store contains expected data keys.
 *
 * Version stores hold keys like pickList, glossary, orgList.
 *
 * @param {string} versionStoreId - the version store ID
 * @param {string} versionLabel - label for logging (e.g. 'v1' or 'v2')
 * @param {Object} expectedData - { pickList?: object, glossary?: object, orgList?: array }
 * @returns {Promise<{valid: boolean, errors: string[], foundKeys: string[]}>}
 */
export const validateGovernanceVersionStore = async (versionStoreId, versionLabel, expectedData) => {
  const errors = [];

  console.log(`\nValidating ${versionLabel} governance version store: ${versionStoreId}`);

  const storeResult = await validateStoreExists(versionStoreId);
  if (!storeResult.exists) {
    errors.push(`${versionLabel} governance store ${versionStoreId} does not exist`);
    return { valid: false, errors, foundKeys: [] };
  }
  if (!storeResult.confirmed) {
    errors.push(`${versionLabel} governance store ${versionStoreId} is not confirmed`);
    return { valid: false, errors, foundKeys: [] };
  }
  console.log(`  Store exists and is confirmed (hash: ${storeResult.hash})`);

  const keysValues = await getStoreKeysValues(versionStoreId);
  const foundKeys = keysValues.map(kv => hexToString(kv.key));

  console.log(`  Store keys: [${foundKeys.join(', ')}]`);

  for (const [metaKey, expectedValue] of Object.entries(expectedData)) {
    if (!foundKeys.includes(metaKey)) {
      errors.push(`${versionLabel} store missing key '${metaKey}'`);
      continue;
    }

    const expectedValueStr = JSON.stringify(expectedValue);
    const result = await validateStoreKeyValue(versionStoreId, metaKey, expectedValueStr);

    if (!result.valid) {
      // Compare parsed JSON instead of raw strings in case of formatting differences
      try {
        const actualParsed = JSON.parse(result.actualValue);
        const expectedParsed = JSON.parse(expectedValueStr);

        if (JSON.stringify(actualParsed) === JSON.stringify(expectedParsed)) {
          console.log(`  '${metaKey}': data matches (${typeof expectedValue === 'object' ? Object.keys(expectedValue).length + ' keys' : 'ok'})`);
          continue;
        }
      } catch {
        // Fall through to error
      }

      const actualPreview = result.actualValue
        ? result.actualValue.substring(0, 100) + (result.actualValue.length > 100 ? '...' : '')
        : 'null';
      const expectedPreview = expectedValueStr.substring(0, 100) + (expectedValueStr.length > 100 ? '...' : '');
      errors.push(`${versionLabel} store '${metaKey}' value mismatch: expected ${expectedPreview}, got ${actualPreview}`);
    } else {
      console.log(`  '${metaKey}': data matches (${typeof expectedValue === 'object' ? Object.keys(expectedValue).length + ' keys' : 'ok'})`);
    }
  }

  const valid = errors.length === 0;
  if (valid) {
    console.log(`  ${versionLabel} governance version store validation passed`);
  } else {
    console.log(`  ${versionLabel} governance version store validation failed:`);
    errors.forEach(err => console.log(`    - ${err}`));
  }

  return { valid, errors, foundKeys };
};
