/**
 * API request helpers for making POST/PUT/DELETE requests to endpoints
 * Handles response parsing and ID extraction
 */

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
    '/v2/aef-t1-submission': 'cadTrustAefT1SubmissionId',
    '/v2/aef-t2-authorizations': 'cadTrustAefT2AuthorizationsId',
    '/v2/aef-t3-actions': 'cadTrustAefT3ActionsId',
    '/v2/aef-t4-holdings': 'cadTrustAefT4HoldingsId',
    '/v2/aef-t5-authorized-entities': 'cadTrustAefT5AuthorizedEntitiesId',
  };

  // Special handling for composite key endpoints
  if (endpoint === '/v2/project-methodology') {
    // These don't return IDs in the response, need to construct from request data
    return null; // Caller should handle this
  }

  if (endpoint === '/v2/unit-label') {
    // These don't return IDs in the response, need to construct from request data
    return null; // Caller should handle this
  }

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
  // Log the request URI (without data)
  console.log(`POST ${endpoint}`);

  let response;
  try {
    response = await request
      .post(endpoint)
      .send(data)
      .expect(200);
  } catch (error) {
    // supertest errors have error.status and error.response
    if (error.status && error.response) {
      console.error(`POST ${endpoint} failed with status ${error.status}:`, JSON.stringify(error.response.body, null, 2));
    } else if (error.response) {
      console.error(`POST ${endpoint} failed with status ${error.response.status}:`, JSON.stringify(error.response.body, null, 2));
    }
    throw error;
  }

  let id = null;
  if (expectId) {
    id = extractIdFromResponse(endpoint, response.body);
    if (!id) {
      // For composite key endpoints, construct ID from request data
      if (endpoint === '/v2/project-methodology') {
        id = {
          projectId: data.cadTrustProjectId,
          methodologyId: data.cadTrustMethodologyId,
        };
      } else if (endpoint === '/v2/unit-label') {
        id = {
          labelId: data.cadTrustLabelId,
          unitId: data.cadTrustUnitId,
        };
      } else {
        console.warn(`⚠️  No ID found in POST response for ${endpoint}`);
      }
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
  let fullEndpoint;
  if (typeof id === 'object') {
    if (endpoint === '/v2/project-methodology') {
      fullEndpoint = `/v2/project-methodology/project/${id.projectId}/methodology/${id.methodologyId}`;
    } else if (endpoint === '/v2/unit-label') {
      fullEndpoint = `/v2/unit-label/${id.labelId}/${id.unitId}`;
    } else {
      throw new Error(`Unknown composite key endpoint: ${endpoint}`);
    }
  } else {
    fullEndpoint = `${endpoint}/${id}`;
  }

  // Log the request URI (without data)
  console.log(`PUT ${fullEndpoint}`);

  const response = await request
    .put(fullEndpoint)
    .send(data)
    .expect(200);

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
  let fullEndpoint;
  if (typeof id === 'object') {
    if (endpoint === '/v2/project-methodology') {
      fullEndpoint = `/v2/project-methodology/project/${id.projectId}/methodology/${id.methodologyId}`;
    } else if (endpoint === '/v2/unit-label') {
      fullEndpoint = `/v2/unit-label/${id.labelId}/${id.unitId}`;
    } else {
      throw new Error(`Unknown composite key endpoint: ${endpoint}`);
    }
  } else {
    fullEndpoint = `${endpoint}/${id}`;
  }

  // Log the request URI (without data)
  console.log(`DELETE ${fullEndpoint}`);

  const response = await request
    .delete(fullEndpoint)
    .expect(200);

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
    const response = await request.get('/v2/staging');
    const records = Array.isArray(response.body)
      ? response.body
      : (response.body?.data || []);

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
        if (typeof id === 'object') {
          // For composite keys, check all key fields
          if (endpoint === '/v2/project-methodology' || endpoint === '/v2/projectMethodology') {
            const projectIdField = 'cad_trust_project_id';
            const methodologyIdField = 'cad_trust_methodology_id';
            idMatches = changeData[projectIdField] === id.projectId &&
                       changeData[methodologyIdField] === id.methodologyId;
          } else if (endpoint === '/v2/unit-label' || endpoint === '/v2/unitLabel') {
            const labelIdField = 'cad_trust_label_id';
            const unitIdField = 'cad_trust_unit_id';
            idMatches = changeData[labelIdField] === id.labelId &&
                       changeData[unitIdField] === id.unitId;
          }
        } else {
          // For single keys, find the ID field (primary key field is cad_trust_{table}_id)
          // Try both camelCase and snake_case ID field names
          const idFieldSnake = `cad_trust_${tableName.replace(/_/g, '_')}_id`;
          const idFieldCamel = `cadTrust${tableName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}Id`;

          // Handle special cases
          let actualIdField;
          if (tableName === 'project_methodology') {
            // This is a composite key table, shouldn't reach here
            continue;
          } else if (tableName === 'unit_label') {
            // This is a composite key table, shouldn't reach here
            continue;
          } else {
            // Try to find the ID field
            actualIdField = Object.keys(changeData).find(key =>
              key.toLowerCase() === idFieldSnake.toLowerCase() ||
              key === idFieldCamel ||
              (key.toLowerCase().includes('id') && changeData[key] === id)
            );
          }

          if (actualIdField && changeData[actualIdField] === id) {
            idMatches = true;
          }
        }

        if (idMatches) {
          // Verify data matches expected data
          // Convert camelCase expectedData keys to snake_case for comparison
          for (const [key, value] of Object.entries(expectedData)) {
            const snakeKey = camelToSnake(key);
            // Check both camelCase and snake_case versions
            if (changeData[key] !== value && changeData[snakeKey] !== value) {
              return false; // Data doesn't match
            }
          }
          return true; // Found matching record
        }
      }
    }

    return false; // Record not found
  } catch (error) {
    console.error(`Error checking staging table: ${error.message}`);
    return false;
  }
};
