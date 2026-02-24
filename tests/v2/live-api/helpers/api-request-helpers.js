/**
 * API request helpers for making POST/PUT/DELETE requests to endpoints
 * Handles response parsing and ID extraction
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
 * @param {string} endpoint - Endpoint path (e.g., '/v2/methodology')
 * @param {object} responseBody - Response body from POST request
 * @returns {string|object|null} - Extracted ID (string for single key, object for composite key, null if not found)
 */
export const extractIdFromResponse = (endpoint, responseBody) => {
  // Map endpoint to ID field name
  const endpointToIdField = {
    '/v2/methodology': 'cadTrustMethodologyId',
    '/v2/program': 'cadTrustProgramId',
    '/v2/project': 'cadTrustProjectId',
    '/v2/unit': 'cadTrustUnitId',
    '/v2/issuance': 'cadTrustIssuanceId',
    '/v2/verification': 'cadTrustVerificationId',
    '/v2/validation': 'cadTrustValidationId',
    '/v2/rating': 'cadTrustRatingId',
    '/v2/co-benefit': 'cadTrustCoBenefitId',
    '/v2/estimation': 'cadTrustEstimationId',
    '/v2/stakeholder': 'cadTrustStakeholderId',
    '/v2/label': 'cadTrustLabelId',
    '/v2/location': 'cadTrustLocationId',
    '/v2/stakeholder-projects': 'cadTrustStakeholderProjectId',
    '/v2/project-methodology': 'cadTrustProjectMethodologyId',
    '/v2/unit-label': 'cadTrustUnitLabelId',
    '/v2/aef-t1-submission': 'cadTrustAefT1SubmissionId',
    '/v2/aef-t2-authorizations': 'cadTrustAefT2AuthorizationsId',
    '/v2/aef-t3-actions': 'cadTrustAefT3ActionsId',
    '/v2/aef-t4-holdings': 'cadTrustAefT4HoldingsId',
    '/v2/aef-t5-authorized-entities': 'cadTrustAefT5AuthorizedEntitiesId',
  };

  // All endpoints now return UUID primary keys in response

  const idField = endpointToIdField[endpoint];
  if (!idField) {
    console.warn(`⚠️  Unknown endpoint for ID extraction: ${endpoint}`);
    return null;
  }

  return responseBody[idField] || null;
};

/**
 * Make a POST request to an endpoint
 * @param {Object} request - supertest request instance
 * @param {string} endpoint - Endpoint path (e.g., '/v2/methodology')
 * @param {object} data - Request body data
 * @param {boolean} expectId - Whether to expect an ID in the response (default: true)
 * @returns {Promise<{id: string|object|null, response: object}>} - ID and full response
 */
export const makePostRequest = async (request, endpoint, data, expectId = true) => {
  // Note: Request logging is handled by the request wrapper in live-api-helpers.js
  // No need to log here to avoid duplicate logs

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
        // Also log full response body for debugging
        console.error(`  Full response:`, JSON.stringify(errorBody, null, 2));

        // Create an error object similar to supertest's
        const error = new Error(`expected 200 "OK", got ${response.status} "${response.statusText}"`);
        error.status = response.status;
        error.response = response;
        lastError = error;

        // If this was the first attempt, wait 3 seconds before retrying
        if (attempt === 0) {
          console.log(`[${getTimestamp()}] Retrying POST ${endpoint} after 3 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    } catch (error) {
      lastError = error;
      // supertest errors structure: error.status, error.response.status, error.response.body
      // Also check error.res which supertest sometimes uses
      const res = error.response || error.res;
      const status = error.status || res?.status;
      const errorBody = res?.body;

      if (status && errorBody) {
        // Extract error message from response body
        const errorMessage = errorBody.error || errorBody.message || 'Unknown error';
        const errorDetails = errorBody.details || errorBody.validation || '';

        console.error(`[${getTimestamp()}] POST ${endpoint} failed with status ${status} (attempt ${attempt + 1}/2):`);
        console.error(`  Error: ${errorMessage}`);
        if (errorDetails) {
          console.error(`  Details: ${typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails, null, 2)}`);
        }
        // Also log full response body for debugging
        console.error(`  Full response:`, JSON.stringify(errorBody, null, 2));
      } else {
        // Log error structure for debugging if we can't parse it
        console.error(`[${getTimestamp()}] POST ${endpoint} failed (attempt ${attempt + 1}/2):`, error.message);
        console.error(`  Error object keys:`, Object.keys(error));
        if (error.response) console.error(`  error.response keys:`, Object.keys(error.response));
        if (error.res) console.error(`  error.res keys:`, Object.keys(error.res));
        // Try to get response body from error if available
        if (error.response?.body) {
          console.error(`  Response body:`, JSON.stringify(error.response.body, null, 2));
        }
      }

      // If this was the first attempt, wait 3 seconds before retrying
      if (attempt === 0) {
        console.log(`[${getTimestamp()}] Retrying POST ${endpoint} after 3 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }

  // If we still don't have a response after retries, throw the last error
  if (!response) {
    throw lastError;
  }

  // Return response object even for non-200 status codes so tests can handle them
  // The response.body will contain the error information
  if (response.status !== 200) {
    return { id: null, response: response.body };
  }

  let id = null;
  if (expectId) {
    id = extractIdFromResponse(endpoint, response.body);
    if (!id) {
      console.warn(`⚠️  No ID found in POST response for ${endpoint}`);
    }
  }

  return { id, response: response.body };
};

/**
 * Make a PUT request to an endpoint
 * @param {Object} request - supertest request instance
 * @param {string} endpoint - Endpoint path (e.g., '/v2/methodology')
 * @param {string|object} id - Record ID (string for single key, object for composite key)
 * @param {object} data - Request body data
 * @returns {Promise<object>} - Response body
 */
export const makePutRequest = async (request, endpoint, id, data) => {
  // Construct full endpoint path with ID
  // All endpoints now use UUID primary keys
  const fullEndpoint = `${endpoint}/${id}`;

  // Note: Request logging is handled by the request wrapper in live-api-helpers.js
  // No need to log here to avoid duplicate logs

  let response;
  let lastError;

  // Retry logic: try once, then retry once after 3 seconds if it fails
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await request
        .put(fullEndpoint)
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

        console.error(`[${getTimestamp()}] PUT ${fullEndpoint} failed with status ${response.status} (attempt ${attempt + 1}/2):`);
        console.error(`  Error: ${errorMessage}`);
        if (errorDetails) {
          console.error(`  Details: ${typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails, null, 2)}`);
        }
        // Also log full response body for debugging
        console.error(`  Full response:`, JSON.stringify(errorBody, null, 2));

        // Create an error object similar to supertest's
        const error = new Error(`expected 200 "OK", got ${response.status} "${response.statusText}"`);
        error.status = response.status;
        error.response = response;
        lastError = error;

        // If this was the first attempt, wait 3 seconds before retrying
        if (attempt === 0) {
          console.log(`[${getTimestamp()}] Retrying PUT ${fullEndpoint} after 3 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    } catch (error) {
      lastError = error;
      // supertest errors structure: error.status, error.response.status, error.response.body
      // Also check error.res which supertest sometimes uses
      const res = error.response || error.res;
      const status = error.status || res?.status;
      const errorBody = res?.body;

      if (status && errorBody) {
        // Extract error message from response body
        const errorMessage = errorBody.error || errorBody.message || 'Unknown error';
        const errorDetails = errorBody.details || errorBody.validation || '';

        console.error(`[${getTimestamp()}] PUT ${fullEndpoint} failed with status ${status} (attempt ${attempt + 1}/2):`);
        console.error(`  Error: ${errorMessage}`);
        if (errorDetails) {
          console.error(`  Details: ${typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails, null, 2)}`);
        }
        // Also log full response body for debugging
        console.error(`  Full response:`, JSON.stringify(errorBody, null, 2));
      } else {
        // Log error structure for debugging if we can't parse it
        console.error(`[${getTimestamp()}] PUT ${fullEndpoint} failed (attempt ${attempt + 1}/2):`, error.message);
        console.error(`  Error object keys:`, Object.keys(error));
        if (error.response) console.error(`  error.response keys:`, Object.keys(error.response));
        if (error.res) console.error(`  error.res keys:`, Object.keys(error.res));
        // Try to get response body from error if available
        if (error.response?.body) {
          console.error(`  Response body:`, JSON.stringify(error.response.body, null, 2));
        }
      }

      // If this was the first attempt, wait 3 seconds before retrying
      if (attempt === 0) {
        console.log(`[${getTimestamp()}] Retrying PUT ${fullEndpoint} after 3 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }

  // If we still don't have a response after retries, throw the last error
  if (!response) {
    throw lastError;
  }

  // Return response object even for non-200 status codes so tests can handle them
  // The response.body will contain the error information
  if (response.status !== 200) {
    return response.body;
  }

  return response.body;
};

/**
 * Make a DELETE request to an endpoint
 * @param {Object} request - supertest request instance
 * @param {string} endpoint - Endpoint path (e.g., '/v2/methodology')
 * @param {string|object} id - Record ID (string for single key, object for composite key)
 * @returns {Promise<object>} - Response body
 */
export const makeDeleteRequest = async (request, endpoint, id) => {
  // Construct full endpoint path with ID
  // All endpoints now use UUID primary keys
  const fullEndpoint = `${endpoint}/${id}`;

  // Note: Request logging is handled by the request wrapper in live-api-helpers.js
  // No need to log here to avoid duplicate logs

  const response = await request
    .delete(fullEndpoint);

  // Return response object even for non-200 status codes so tests can handle them
  // The response.body will contain the error information
  if (response.status !== 200) {
    const errorBody = response.body || {};
    const errorMessage = errorBody.error || errorBody.message || `HTTP ${response.status}`;
    console.error(`[${getTimestamp()}] DELETE ${fullEndpoint} failed with status ${response.status}:`);
    console.error(`  Error: ${errorMessage}`);
    console.error(`  Full response:`, JSON.stringify(errorBody, null, 2));
    return response.body;
  }

  return response.body;
};

/**
 * Convert endpoint path to table name
 * @param {string} endpoint - Endpoint path (e.g., '/v2/methodology', '/v2/project-methodology')
 * @returns {string} - Table name in snake_case (e.g., 'methodology', 'project_methodology')
 */
const endpointToTableName = (endpoint) => {
  // Remove /v2/ prefix
  let tableName = endpoint.replace(/^\/v2\//, '');
  // Convert kebab-case to snake_case
  tableName = tableName.replace(/-/g, '_');
  return tableName;
};

/**
 * Convert camelCase to snake_case
 * @param {string} str - camelCase string
 * @returns {string} - snake_case string
 */
const camelToSnake = (str) => {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
};

/**
 * Check if a record exists in staging table
 * @param {Object} request - supertest request instance
 * @param {string} endpoint - Endpoint path (e.g., '/v2/methodology')
 * @param {string|object} id - Record ID
 * @param {object} expectedData - Expected data to match (in camelCase)
 * @returns {Promise<boolean>} - true if record found in staging
 */
export const checkRecordInStaging = async (request, endpoint, id, expectedData) => {
  try {
    const response = await request.get('/v2/staging').query({ page: 1, limit: 1000 });
    const records = response.body?.data || [];

    // Convert endpoint to table name
    const tableName = endpointToTableName(endpoint);

    // Find record matching the table and ID
    for (const record of records) {
      // Match by table name (snake_case)
      if (record.table === tableName) {
        // Get the actual data from diff.change[0] (staging stores data in diff.change array)
        const changeData = record.diff?.change?.[0];
        if (!changeData) {
          continue; // Skip records without change data
        }

        // Check if ID matches
        let idMatches = false;
        // All tables now use UUID primary keys
        // Find the ID field (primary key field is cad_trust_{table}_id)
        // Try both camelCase and snake_case ID field names
        const idFieldSnake = `cad_trust_${tableName}_id`;
        const idFieldCamel = `cadTrust${tableName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}Id`;

        // Handle special cases for table name variations
        let actualIdField;
        if (tableName === 'project_methodology') {
          actualIdField = Object.keys(changeData).find(key =>
            key === 'cad_trust_project_methodology_id' ||
            key === 'cadTrustProjectMethodologyId' ||
            (key.toLowerCase() === 'cad_trust_project_methodology_id' && changeData[key] === id)
          );
        } else if (tableName === 'unit_label') {
          actualIdField = Object.keys(changeData).find(key =>
            key === 'cad_trust_unit_label_id' ||
            key === 'cadTrustUnitLabelId' ||
            (key.toLowerCase() === 'cad_trust_unit_label_id' && changeData[key] === id)
          );
        } else {
            // Try to find the ID field - check exact matches first
            actualIdField = Object.keys(changeData).find(key =>
              key === idFieldSnake || // Exact snake_case match
              key === idFieldCamel || // Exact camelCase match
              (key.toLowerCase() === idFieldSnake.toLowerCase() && changeData[key] === id) // Case-insensitive match with value check
            );

            // If not found, try a broader search
            if (!actualIdField) {
              actualIdField = Object.keys(changeData).find(key =>
                key.toLowerCase().includes('cad_trust') &&
                key.toLowerCase().includes('_id') &&
                changeData[key] === id
              );
            }
          }

          if (actualIdField && changeData[actualIdField] === id) {
            idMatches = true;
          }

        if (idMatches) {
          // Verify data matches expected data
          // Convert camelCase expectedData keys to snake_case for comparison
          let allDataMatches = true;
          for (const [key, value] of Object.entries(expectedData)) {
            const snakeKey = camelToSnake(key);
            // Check both camelCase and snake_case versions
            const camelMatch = changeData[key] === value;
            const snakeMatch = changeData[snakeKey] === value;

            if (!camelMatch && !snakeMatch) {
              allDataMatches = false;
              break;
            }
          }
          if (allDataMatches) {
            return true; // Found matching record with all expected data
          }
          // If ID matches but data doesn't, continue searching (might be wrong record)
        }
      }
    }

    return false; // Record not found
  } catch (error) {
    console.error(`Error checking staging table: ${error.message}`);
    return false;
  }
};
