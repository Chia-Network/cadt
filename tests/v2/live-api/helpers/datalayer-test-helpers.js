/**
 * Datalayer RPC helpers for live API tests
 * Allows tests to validate that stores exist and contain expected data
 */
import fs from 'fs';
import path from 'path';
import superagent from 'superagent';
import { getChiaRoot } from '../../../../src/utils/chia-root.js';
import { getLiveApiConfig } from './live-api-helpers.js';

// Disable TLS certificate validation for self-signed certs
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

/**
 * Get base options for datalayer RPC calls (certs, keys, timeout)
 */
const getBaseOptions = () => {
  const chiaRoot = getChiaRoot();
  const certificateFolderPath = `${chiaRoot}/config/ssl`;

  const certFile = path.resolve(
    `${certificateFolderPath}/data_layer/private_data_layer.crt`,
  );

  const keyFile = path.resolve(
    `${certificateFolderPath}/data_layer/private_data_layer.key`,
  );

  return {
    cert: fs.readFileSync(certFile),
    key: fs.readFileSync(keyFile),
    timeout: 60000, // 60 second timeout
  };
};

/**
 * Get the datalayer RPC URL from config
 */
const getDatalayerUrl = () => {
  const { config } = getLiveApiConfig();
  // Default to localhost:8562 if not configured
  return config?.APP?.DATALAYER_URL || 'https://localhost:8562';
};

/**
 * Get the root hash of a store
 * @param {string} storeId - The store ID
 * @returns {Promise<{confirmed: boolean, hash: string}>}
 */
export const getStoreRoot = async (storeId) => {
  const url = `${getDatalayerUrl()}/get_root`;
  const { cert, key, timeout } = getBaseOptions();

  const response = await superagent
    .post(url)
    .key(key)
    .cert(cert)
    .timeout(timeout)
    .send({ id: storeId });

  if (!response.body.success) {
    throw new Error(`Failed to get root for store ${storeId}: ${response.body.error}`);
  }

  return {
    confirmed: response.body.confirmed,
    hash: response.body.hash,
  };
};

/**
 * Get all keys and values from a store
 * @param {string} storeId - The store ID
 * @returns {Promise<Array<{key: string, value: string}>>} - Array of hex-encoded key-value pairs
 */
export const getStoreKeysValues = async (storeId) => {
  const url = `${getDatalayerUrl()}/get_keys_values`;
  const { cert, key, timeout } = getBaseOptions();

  const response = await superagent
    .post(url)
    .key(key)
    .cert(cert)
    .timeout(timeout)
    .send({ id: storeId });

  if (!response.body.success) {
    throw new Error(`Failed to get keys/values for store ${storeId}: ${response.body.error}`);
  }

  return response.body.keys_values || [];
};

/**
 * Get a specific value from a store by key
 * @param {string} storeId - The store ID
 * @param {string} hexKey - The key in hex format
 * @returns {Promise<string|null>} - The value in hex format, or null if not found
 */
export const getStoreValue = async (storeId, hexKey) => {
  const url = `${getDatalayerUrl()}/get_value`;
  const { cert, key, timeout } = getBaseOptions();

  try {
    const response = await superagent
      .post(url)
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .send({ id: storeId, key: hexKey });

    if (response.body.success) {
      return response.body.value;
    }
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Convert a string to hex format (for datalayer keys)
 * @param {string} str - The string to convert
 * @returns {string} - Hex encoded string
 */
export const stringToHex = (str) => {
  return Buffer.from(str, 'utf8').toString('hex');
};

/**
 * Convert hex to string
 * @param {string} hex - The hex string to convert (may have 0x prefix)
 * @returns {string} - Decoded string
 */
export const hexToString = (hex) => {
  // Strip 0x prefix if present
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Buffer.from(cleanHex, 'hex').toString('utf8');
};

/**
 * Validate that a store exists and is confirmed
 * @param {string} storeId - The store ID to validate
 * @returns {Promise<{exists: boolean, confirmed: boolean, hash: string|null}>}
 */
export const validateStoreExists = async (storeId) => {
  try {
    const root = await getStoreRoot(storeId);
    return {
      exists: true,
      confirmed: root.confirmed,
      hash: root.hash,
    };
  } catch (error) {
    return {
      exists: false,
      confirmed: false,
      hash: null,
    };
  }
};

/**
 * Validate that a store contains expected keys
 * @param {string} storeId - The store ID to validate
 * @param {string[]} expectedKeys - Array of expected key names (not hex)
 * @returns {Promise<{valid: boolean, missingKeys: string[], foundKeys: string[]}>}
 */
export const validateStoreHasKeys = async (storeId, expectedKeys) => {
  const keysValues = await getStoreKeysValues(storeId);

  // Convert hex keys to strings
  const foundKeys = keysValues.map(kv => hexToString(kv.key));

  const missingKeys = expectedKeys.filter(key => !foundKeys.includes(key));

  return {
    valid: missingKeys.length === 0,
    missingKeys,
    foundKeys,
  };
};

/**
 * Validate that a store contains a specific key-value pair
 * @param {string} storeId - The store ID
 * @param {string} keyName - The key name (not hex)
 * @param {string} expectedValue - The expected value (not hex)
 * @returns {Promise<{valid: boolean, actualValue: string|null}>}
 */
export const validateStoreKeyValue = async (storeId, keyName, expectedValue) => {
  const hexKey = stringToHex(keyName);
  const hexValue = await getStoreValue(storeId, hexKey);

  if (hexValue === null) {
    return {
      valid: false,
      actualValue: null,
    };
  }

  const actualValue = hexToString(hexValue);

  return {
    valid: actualValue === expectedValue,
    actualValue,
  };
};

/**
 * Validate an organization's stores in datalayer
 * Checks that all 4 stores exist and the org store has expected data
 * @param {Object} org - Organization object with store IDs
 * @param {boolean} isV2 - Whether this is a V2 org (affects field names)
 * @returns {Promise<{valid: boolean, errors: string[], details: Object}>}
 */
export const validateOrganizationStores = async (org, isV2 = true) => {
  const errors = [];
  const details = {};

  // Get store IDs based on version
  const orgUid = isV2 ? org.org_uid : org.orgUid;
  const registryId = isV2 ? org.registry_id : org.registryId;
  const dataModelVersionStoreId = isV2 ? org.data_model_version_store_id : org.dataModelVersionStoreId;
  const fileStoreId = isV2 ? org.file_store_subscribed : org.fileStoreId;
  const orgName = org.name;
  const orgIcon = org.icon;

  console.log(`\nValidating datalayer stores for organization ${orgName}:`);
  console.log(`  org_uid store: ${orgUid}`);
  console.log(`  registry store: ${registryId}`);
  console.log(`  data_model_version store: ${dataModelVersionStoreId}`);
  console.log(`  file store: ${fileStoreId}`);

  // 1. Validate org store exists
  const orgStoreResult = await validateStoreExists(orgUid);
  details.orgStore = orgStoreResult;
  if (!orgStoreResult.exists) {
    errors.push(`Org store ${orgUid} does not exist in datalayer`);
  } else if (!orgStoreResult.confirmed) {
    errors.push(`Org store ${orgUid} is not confirmed`);
  } else {
    console.log(`  ✓ Org store exists and is confirmed (hash: ${orgStoreResult.hash})`);
  }

  // 2. Validate org store has expected keys
  if (orgStoreResult.exists && orgStoreResult.confirmed) {
    const expectedOrgKeys = ['registryId', 'fileStoreId', 'name', 'icon'];
    const keysResult = await validateStoreHasKeys(orgUid, expectedOrgKeys);
    details.orgStoreKeys = keysResult;
    if (!keysResult.valid) {
      errors.push(`Org store missing keys: ${keysResult.missingKeys.join(', ')}`);
    } else {
      console.log(`  ✓ Org store has expected keys: ${keysResult.foundKeys.join(', ')}`);
    }

    // 3. Validate org store values - name, icon, registryId, and fileStoreId
    const nameResult = await validateStoreKeyValue(orgUid, 'name', orgName);
    details.orgStoreName = nameResult;
    if (!nameResult.valid) {
      errors.push(`Org store 'name' mismatch: expected '${orgName}', got '${nameResult.actualValue}'`);
    } else {
      console.log(`  ✓ Org store 'name' value matches: ${orgName}`);
    }

    if (orgIcon) {
      const iconResult = await validateStoreKeyValue(orgUid, 'icon', orgIcon);
      details.orgStoreIcon = iconResult;
      if (!iconResult.valid) {
        errors.push(`Org store 'icon' mismatch: expected '${orgIcon}', got '${iconResult.actualValue}'`);
      } else {
        console.log(`  ✓ Org store 'icon' value matches`);
      }
    }

    // Validate registryId in org store matches the actual registry store ID
    if (registryId) {
      const registryIdResult = await validateStoreKeyValue(orgUid, 'registryId', registryId);
      details.orgStoreRegistryId = registryIdResult;
      if (!registryIdResult.valid) {
        errors.push(`Org store 'registryId' mismatch: expected '${registryId}', got '${registryIdResult.actualValue}'`);
      } else {
        console.log(`  ✓ Org store 'registryId' value matches: ${registryId}`);
      }
    }

    // Validate fileStoreId in org store matches the actual file store ID
    if (fileStoreId) {
      const fileStoreIdResult = await validateStoreKeyValue(orgUid, 'fileStoreId', fileStoreId);
      details.orgStoreFileStoreId = fileStoreIdResult;
      if (!fileStoreIdResult.valid) {
        errors.push(`Org store 'fileStoreId' mismatch: expected '${fileStoreId}', got '${fileStoreIdResult.actualValue}'`);
      } else {
        console.log(`  ✓ Org store 'fileStoreId' value matches: ${fileStoreId}`);
      }
    }
  }

  // 4. Validate registry store exists
  const registryStoreResult = await validateStoreExists(registryId);
  details.registryStore = registryStoreResult;
  if (!registryStoreResult.exists) {
    errors.push(`Registry store ${registryId} does not exist in datalayer`);
  } else if (!registryStoreResult.confirmed) {
    errors.push(`Registry store ${registryId} is not confirmed`);
  } else {
    console.log(`  ✓ Registry store exists and is confirmed (hash: ${registryStoreResult.hash})`);
  }

  // 5. Validate data model version store exists
  const dmvStoreResult = await validateStoreExists(dataModelVersionStoreId);
  details.dataModelVersionStore = dmvStoreResult;
  if (!dmvStoreResult.exists) {
    errors.push(`Data model version store ${dataModelVersionStoreId} does not exist in datalayer`);
  } else if (!dmvStoreResult.confirmed) {
    errors.push(`Data model version store ${dataModelVersionStoreId} is not confirmed`);
  } else {
    console.log(`  ✓ Data model version store exists and is confirmed (hash: ${dmvStoreResult.hash})`);
  }

  // 6. Validate file store exists
  const fileStoreResult = await validateStoreExists(fileStoreId);
  details.fileStore = fileStoreResult;
  if (!fileStoreResult.exists) {
    errors.push(`File store ${fileStoreId} does not exist in datalayer`);
  } else if (!fileStoreResult.confirmed) {
    errors.push(`File store ${fileStoreId} is not confirmed`);
  } else {
    console.log(`  ✓ File store exists and is confirmed (hash: ${fileStoreResult.hash})`);
  }

  // 7. Validate that hashes in database match datalayer
  const orgHash = isV2 ? org.org_hash : org.orgHash;
  const registryHash = isV2 ? org.registry_hash : org.registryHash;
  const dataModelVersionStoreHash = isV2 ? org.data_model_version_store_hash : org.dataModelVersionStoreHash;

  if (orgStoreResult.exists && orgStoreResult.confirmed && orgHash) {
    if (orgStoreResult.hash !== orgHash) {
      errors.push(`Org hash mismatch: DB has ${orgHash}, datalayer has ${orgStoreResult.hash}`);
    } else {
      console.log(`  ✓ Org hash matches datalayer`);
    }
  }

  if (registryStoreResult.exists && registryStoreResult.confirmed && registryHash) {
    if (registryStoreResult.hash !== registryHash) {
      errors.push(`Registry hash mismatch: DB has ${registryHash}, datalayer has ${registryStoreResult.hash}`);
    } else {
      console.log(`  ✓ Registry hash matches datalayer`);
    }
  }

  if (dmvStoreResult.exists && dmvStoreResult.confirmed && dataModelVersionStoreHash) {
    if (dmvStoreResult.hash !== dataModelVersionStoreHash) {
      errors.push(`Data model version store hash mismatch: DB has ${dataModelVersionStoreHash}, datalayer has ${dmvStoreResult.hash}`);
    } else {
      console.log(`  ✓ Data model version store hash matches datalayer`);
    }
  }

  const valid = errors.length === 0;
  if (valid) {
    console.log(`  ✓ All datalayer store validations passed`);
  } else {
    console.log(`  ✗ Datalayer store validation failed with ${errors.length} error(s)`);
    errors.forEach(err => console.log(`    - ${err}`));
  }

  return { valid, errors, details };
};
