/**
 * Shared state to track all created IDs across test files
 * Used for cleanup at the end of test run
 */

const createdIds = {
  methodology: [],
  program: [],
  project: [],
  validation: [],
  verification: [],
  issuance: [],
  unit: [],
  location: [],
  estimation: [],
  rating: [],
  coBenefit: [],
  label: [],
  stakeholder: [],
  'project-methodology': [],
  'stakeholder-projects': [],
  'unit-label': [],
  'aef-t1-submission': [],
  'aef-t2-authorizations': [],
  'aef-t3-actions': [],
  'aef-t4-holdings': [],
  'aef-t5-authorized-entities': [],
};

/**
 * Add a created ID to the shared state
 * @param {string} type - Resource type (e.g., 'methodology', 'project')
 * @param {string} id - The created ID (UUID)
 */
export const addCreatedId = (type, id) => {
  if (!createdIds[type]) {
    createdIds[type] = [];
  }
  createdIds[type].push(id);
};

/**
 * Get all created IDs in reverse dependency order for cleanup
 * @returns {Array<{type: string, id: string}>}
 */
export const getAllCreatedIds = () => {
  const all = [];
  // Delete in reverse dependency order
  const deleteOrder = [
    'unit-label',
    'stakeholder-projects',
    'project-methodology',
    'unit',
    'issuance',
    'verification',
    'validation',
    'aef-t4-holdings',
    'aef-t3-actions',
    'aef-t2-authorizations',
    'aef-t5-authorized-entities',
    'aef-t1-submission',
    'co-benefit',
    'estimation',
    'rating',
    'label',
    'stakeholder',
    'project',
    'program',
    'methodology',
    'location',
  ];

  for (const type of deleteOrder) {
    if (createdIds[type] && createdIds[type].length > 0) {
      for (const id of createdIds[type]) {
        all.push({ type, id });
      }
    }
  }

  return all;
};

/**
 * Clear all tracked IDs (useful for test cleanup)
 */
export const clearAllCreatedIds = () => {
  for (const key in createdIds) {
    createdIds[key] = [];
  }
};
