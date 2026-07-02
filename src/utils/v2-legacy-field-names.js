'use strict';

// Legacy field-name compatibility for V2 datalayer ingestion.
//
// The AEF T3/T4 cooperative-approach columns were renamed from the misspelled
// "coopoerative" to "cooperative". Records published to the datalayer before the
// rename still carry the old key, and on-chain data is immutable, so ingestion
// must map the old key onto the corrected attribute before upserting.
const LEGACY_V2_FIELD_RENAMES = {
  aef_t3_actions: {
    aefT3ActionsCoopoerativeApproachId: 'aefT3ActionsCooperativeApproachId',
  },
  aef_t4_holdings: {
    aefT4HoldingsCoopoerativeApproachId: 'aefT4HoldingsCooperativeApproachId',
  },
};

/**
 * Returns a copy of a camelCase datalayer record with any legacy misspelled
 * field keys renamed to their corrected attribute names. The input is not
 * mutated. Records for models without known renames are returned unchanged.
 * @param {string} modelKey - datalayer model key (e.g. "aef_t4_holdings")
 * @param {Object} record - camelCase record produced from a datalayer diff
 * @returns {Object} record with legacy keys renamed to corrected names
 */
export const normalizeLegacyV2FieldNames = (modelKey, record) => {
  const renames = LEGACY_V2_FIELD_RENAMES[modelKey];
  if (!renames || record == null || typeof record !== 'object') {
    return record;
  }

  const normalized = { ...record };
  for (const [oldKey, newKey] of Object.entries(renames)) {
    if (
      Object.hasOwn(normalized, oldKey) &&
      !Object.hasOwn(normalized, newKey)
    ) {
      normalized[newKey] = normalized[oldKey];
      delete normalized[oldKey];
    }
  }

  return normalized;
};

export { LEGACY_V2_FIELD_RENAMES };
