/**
 * API request helpers for making POST/PUT/DELETE requests to endpoints
 * Handles response parsing and ID extraction for V1
 */

/**
 * Format current timestamp as YYYY-MM-DD HH:mm:ss
 * @returns {string} - Formatted timestamp
 */
const getTimestamp = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

/**
 * Extract ID from POST response based on endpoint type
 * V1 returns uuid in response, which IS the warehouseProjectId/warehouseUnitId
 * @param {string} endpoint - Endpoint path (e.g., '/v1/projects')
 * @param {object} responseBody - Response body from POST request
 * @returns {string|null} - Extracted ID (warehouseProjectId or warehouseUnitId), null if not found
 */
export const extractIdFromResponse = (endpoint, responseBody) => {
  // V1 POST responses return { success: true, message: "...", uuid: "..." }
  // The uuid IS the warehouseProjectId/warehouseUnitId (V1 uses the same UUID for both staging and record ID)
  return responseBody.uuid || null;
};

/**
 * Make a POST request to an endpoint
 * @param {Object} request - supertest request instance
 * @param {string} endpoint - Endpoint path (e.g., '/v1/projects')
 * @param {object} data - Request body data
 * @param {boolean} expectId - Whether to expect an ID in the response (default: true)
 * @returns {Promise<{id: string|null, response: object}>} - ID (staging UUID) and full response
 */
export const makePostRequest = async (request, endpoint, data, expectId = true) => {
  let response;
  let lastError;

  // Retry logic: try once, then retry once after 3 seconds if it fails
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await request
        .post(endpoint)
        .send(data);

      // Check status code manually so we can capture error responses
      if (response.status === 200) {
        // Success - break out of retry loop
        break;
      } else {
        // Non-200 response - log it and throw
        const errorBody = response.body || {};
        const errorMessage = errorBody.error || errorBody.message || `HTTP ${response.status}`;
        const errorDetails = errorBody.details || errorBody.validation || '';

        console.error(`[${getTimestamp()}] POST ${endpoint} failed with status ${response.status} (attempt ${attempt + 1}/2):`);
        console.error(`  Error: ${errorMessage}`);
        if (errorDetails) {
          console.error(`  Details: ${typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails, null, 2)}`);
        }
        console.error(`  Full response:`, JSON.stringify(errorBody, null, 2));

        const error = new Error(`expected 200 "OK", got ${response.status} "${response.statusText}"`);
        error.status = response.status;
        error.response = response;
        lastError = error;

        if (attempt === 0) {
          console.log(`[${getTimestamp()}] Retrying POST ${endpoint} after 3 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    } catch (error) {
      lastError = error;
      const res = error.response || error.res;
      const status = error.status || res?.status;
      const errorBody = res?.body;

      if (status && errorBody) {
        const errorMessage = errorBody.error || errorBody.message || 'Unknown error';
        const errorDetails = errorBody.details || errorBody.validation || '';

        console.error(`[${getTimestamp()}] POST ${endpoint} failed with status ${status} (attempt ${attempt + 1}/2):`);
        console.error(`  Error: ${errorMessage}`);
        if (errorDetails) {
          console.error(`  Details: ${typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails, null, 2)}`);
        }
        console.error(`  Full response:`, JSON.stringify(errorBody, null, 2));
      } else {
        console.error(`[${getTimestamp()}] POST ${endpoint} failed (attempt ${attempt + 1}/2):`, error.message);
      }

      if (attempt === 0) {
        console.log(`[${getTimestamp()}] Retrying POST ${endpoint} after 3 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }

  if (!response) {
    throw lastError;
  }

  if (response.status !== 200) {
    return { id: null, response: response.body };
  }

  // V1 returns uuid (staging UUID) in response
  // We'll use this to track the record, but the actual warehouseProjectId/warehouseUnitId
  // will be available after commit
  let id = null;
  if (expectId) {
    id = extractIdFromResponse(endpoint, response.body);
    if (!id) {
      console.warn(`⚠️  No UUID found in POST response for ${endpoint}`);
    }
  }

  return { id, response: response.body };
};

/**
 * Make a PUT request to an endpoint
 * V1 PUT requests require ALL fields, not just changed ones
 * @param {Object} request - supertest request instance
 * @param {string} endpoint - Endpoint path (e.g., '/v1/projects')
 * @param {string} warehouseId - Record warehouseProjectId or warehouseUnitId
 * @param {object} data - Request body data (must include ALL fields)
 * @returns {Promise<object>} - Response body
 */
export const makePutRequest = async (request, endpoint, warehouseId, data) => {
  // V1 PUT doesn't use ID in path, it's in the body
  // But we need warehouseProjectId/warehouseUnitId in the body
  const fullData = {
    ...data,
    warehouseProjectId: endpoint.includes('project') ? warehouseId : undefined,
    warehouseUnitId: endpoint.includes('unit') ? warehouseId : undefined,
  };

  let response;
  let lastError;

  // Retry logic: try once, then retry once after 3 seconds if it fails
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await request
        .put(endpoint)
        .send(fullData);

      if (response.status === 200) {
        break;
      } else {
        const errorBody = response.body || {};
        const errorMessage = errorBody.error || errorBody.message || `HTTP ${response.status}`;
        const errorDetails = errorBody.details || errorBody.validation || '';

        console.error(`[${getTimestamp()}] PUT ${endpoint} failed with status ${response.status} (attempt ${attempt + 1}/2):`);
        console.error(`  Error: ${errorMessage}`);
        if (errorDetails) {
          console.error(`  Details: ${typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails, null, 2)}`);
        }
        console.error(`  Full response:`, JSON.stringify(errorBody, null, 2));

        const error = new Error(`expected 200 "OK", got ${response.status} "${response.statusText}"`);
        error.status = response.status;
        error.response = response;
        lastError = error;

        if (attempt === 0) {
          console.log(`[${getTimestamp()}] Retrying PUT ${endpoint} after 3 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    } catch (error) {
      lastError = error;
      const res = error.response || error.res;
      const status = error.status || res?.status;
      const errorBody = res?.body;

      if (status && errorBody) {
        const errorMessage = errorBody.error || errorBody.message || 'Unknown error';
        const errorDetails = errorBody.details || errorBody.validation || '';

        console.error(`[${getTimestamp()}] PUT ${endpoint} failed with status ${status} (attempt ${attempt + 1}/2):`);
        console.error(`  Error: ${errorMessage}`);
        if (errorDetails) {
          console.error(`  Details: ${typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails, null, 2)}`);
        }
        console.error(`  Full response:`, JSON.stringify(errorBody, null, 2));
      } else {
        console.error(`[${getTimestamp()}] PUT ${endpoint} failed (attempt ${attempt + 1}/2):`, error.message);
      }

      if (attempt === 0) {
        console.log(`[${getTimestamp()}] Retrying PUT ${endpoint} after 3 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }

  if (!response) {
    throw lastError;
  }

  if (response.status !== 200) {
    return response.body;
  }

  return response.body;
};

/**
 * Make a DELETE request to an endpoint
 * V1 DELETE uses body with warehouseProjectId/warehouseUnitId
 * @param {Object} request - supertest request instance
 * @param {string} endpoint - Endpoint path (e.g., '/v1/projects')
 * @param {string} warehouseId - Record warehouseProjectId or warehouseUnitId
 * @returns {Promise<object>} - Response body
 */
export const makeDeleteRequest = async (request, endpoint, warehouseId) => {
  // V1 DELETE uses body with warehouseProjectId/warehouseUnitId
  const body = endpoint.includes('project')
    ? { warehouseProjectId: warehouseId }
    : { warehouseUnitId: warehouseId };

  const response = await request
    .delete(endpoint)
    .send(body);

  if (response.status !== 200) {
    const errorBody = response.body || {};
    const errorMessage = errorBody.error || errorBody.message || `HTTP ${response.status}`;
    console.error(`[${getTimestamp()}] DELETE ${endpoint} failed with status ${response.status}:`);
    console.error(`  Error: ${errorMessage}`);
    console.error(`  Full response:`, JSON.stringify(errorBody, null, 2));
    return response.body;
  }

  return response.body;
};

/**
 * Check if a record exists in staging table
 * @param {Object} request - supertest request instance
 * @param {string} endpoint - Endpoint path (e.g., '/v1/projects')
 * @param {string} uuid - Staging UUID
 * @param {object} expectedData - Expected data to match (in camelCase)
 * @returns {Promise<boolean>} - true if record found in staging
 */
export const checkRecordInStaging = async (request, endpoint, uuid, expectedData) => {
  try {
    const response = await request.get('/v1/staging');
    const records = Array.isArray(response.body)
      ? response.body
      : (response.body?.data || []);

    // Find record matching the UUID
    for (const record of records) {
      if (record.uuid === uuid) {
        // Get the actual data from diff.change[0] (staging stores data in diff.change array)
        const changeData = record.diff?.change?.[0];
        if (!changeData) {
          continue;
        }

        // Verify data matches expected data
        let allDataMatches = true;
        for (const [key, value] of Object.entries(expectedData)) {
          // V1 uses camelCase in API
          if (changeData[key] !== value) {
            allDataMatches = false;
            break;
          }
        }
        if (allDataMatches) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error(`Error checking staging table: ${error.message}`);
    return false;
  }
};
