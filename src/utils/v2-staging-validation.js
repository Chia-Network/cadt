'use strict';

/**
 * Shared staging validation for V2 write paths.
 *
 * INVARIANT: every record staged to StagingV2 — regardless of entry path
 * (REST API, XLSX import, CSV import, or any future path) — is checked
 * against the same Joi schema, foreign-key existence, and NOT NULL
 * completeness that the REST API applies. Staged records become on-chain
 * DataLayer values verbatim, and every subscriber re-ingests them into models
 * with allowNull: false columns; an incomplete record permanently halts sync
 * for all subscribers of the registry. New write paths must call
 * validateStagedRecord and add a parity test.
 *
 * FK and NOT NULL always run against the whole record. Joi reporting can be
 * narrowed with `joiFields` for paths that edit a few fields of a record they
 * did not author — see that option's docs. Paths that build a record from
 * scratch must not narrow it.
 */

import { locationV2Schema } from '../validations/v2/location-v2.validations.js';
import { coBenefitV2Schema } from '../validations/v2/co-benefit-v2.validations.js';
import { estimationV2Schema } from '../validations/v2/estimation-v2.validations.js';
import { ratingV2Schema } from '../validations/v2/rating-v2.validations.js';
import { labelV2Schema } from '../validations/v2/label-v2.validations.js';
import { unitLabelV2Schema } from '../validations/v2/unit-label-v2.validations.js';
import { projectMethodologyV2Schema } from '../validations/v2/project-methodology-v2.validations.js';
import { stakeholderV2Schema } from '../validations/v2/stakeholder-v2.validations.js';
import { stakeholderProjectV2Schema } from '../validations/v2/stakeholder-projects-v2.validations.js';
import { programV2Schema } from '../validations/v2/program-v2.validations.js';
import { methodologyV2Schema } from '../validations/v2/methodology-v2.validations.js';
import { validationV2Schema } from '../validations/v2/validation-v2.validations.js';
import { verificationV2Schema } from '../validations/v2/verification-v2.validations.js';
import { issuanceV2Schema } from '../validations/v2/issuance-v2.validations.js';
import { projectV2Schema } from '../validations/v2/project-v2.validations.js';
import { unitV2Schema } from '../validations/v2/unit-v2.validations.js';
import { aefT1SubmissionV2Schema } from '../validations/v2/aef-t1-submission-v2.validations.js';
import { aefT2AuthorizationsV2Schema } from '../validations/v2/aef-t2-authorizations-v2.validations.js';
import { aefT3ActionsV2Schema } from '../validations/v2/aef-t3-actions-v2.validations.js';
import { aefT4HoldingsV2Schema } from '../validations/v2/aef-t4-holdings-v2.validations.js';
import { aefT5AuthorizedEntitiesV2Schema } from '../validations/v2/aef-t5-authorized-entities-v2.validations.js';

import { validateRequiredFields } from './v2-xls.js';
import { assertRecordExistanceOrStaged } from './v2-data-assertions.js';

// Model class name → Joi schema used by the REST API for that model.
const modelSchemaRegistry = {
  ProgramV2: programV2Schema,
  MethodologyV2: methodologyV2Schema,
  ProjectV2: projectV2Schema,
  ValidationV2: validationV2Schema,
  VerificationV2: verificationV2Schema,
  IssuanceV2: issuanceV2Schema,
  UnitV2: unitV2Schema,
  LocationV2: locationV2Schema,
  EstimationV2: estimationV2Schema,
  RatingV2: ratingV2Schema,
  CoBenefitV2: coBenefitV2Schema,
  ProjectMethodologyV2: projectMethodologyV2Schema,
  StakeholderV2: stakeholderV2Schema,
  StakeholderProjectV2: stakeholderProjectV2Schema,
  LabelV2: labelV2Schema,
  UnitLabelV2: unitLabelV2Schema,
  AefT1SubmissionV2: aefT1SubmissionV2Schema,
  AefT2AuthorizationsV2: aefT2AuthorizationsV2Schema,
  AefT3ActionsV2: aefT3ActionsV2Schema,
  AefT4HoldingsV2: aefT4HoldingsV2Schema,
  AefT5AuthorizedEntitiesV2: aefT5AuthorizedEntitiesV2Schema,
};

// Cache of schema key metadata: model name → { validatableKeys: string[] }.
// Keys flagged `forbidden` (PK, timestamps, orgUid, createdByOrgUid, …) are
// server-managed; import rows legitimately carry them, so they are excluded
// from the Joi payload rather than rejected.
const schemaKeyCache = new Map();

function getValidatableSchemaKeys(modelName, schema) {
  if (!schemaKeyCache.has(modelName)) {
    const described = schema.describe();
    const validatableKeys = Object.entries(described.keys || {})
      .filter(([, keyDesc]) => keyDesc?.flags?.presence !== 'forbidden')
      .map(([key]) => key);
    schemaKeyCache.set(modelName, validatableKeys);
  }
  return schemaKeyCache.get(modelName);
}

export function getSchemaForModel(modelClass) {
  return modelSchemaRegistry[modelClass?.name] || null;
}

function getBelongsToForeignKeys(modelClass) {
  return Object.values(modelClass.associations || {})
    .filter((assoc) => assoc.associationType === 'BelongsTo')
    .map((assoc) => ({
      foreignKey: assoc.foreignKey,
      target: assoc.target,
      targetTable: assoc.target.getTableName(),
    }));
}

/**
 * Validate a full (merged) record before it is staged, applying the same
 * rules as the REST API path: Joi schema, NOT NULL completeness, and FK
 * existence.
 *
 * @param {import('sequelize').Model} modelClass
 * @param {Object} camelRow - full record with camelCase attribute keys
 *   (for UPDATE this must be the merged record: existing + changes)
 * @param {Object} [options]
 * @param {boolean} [options.checkForeignKeys=true] - set false when the
 *   caller performs its own batch-aware FK checks (e.g. CSV batch upload)
 * @param {Object.<string, Set<string>>} [options.batchPks] - table name →
 *   set of primary keys staged in the same import batch; FKs resolving to
 *   these are accepted without a DB/staging lookup
 * @param {string[]} [options.joiFields] - when set, only Joi errors on these
 *   fields are reported. For flows that clone an existing DB record and
 *   override a few fields (e.g. unit split): the overrides get full Joi
 *   scrutiny, while pre-schema legacy values already on the record don't
 *   block the operation. NOT NULL and FK checks always run on the full record.
 * @returns {Promise<string[]>} array of error messages (empty when valid)
 */
export async function validateStagedRecord(
  modelClass,
  camelRow,
  { checkForeignKeys = true, batchPks = null, joiFields = null } = {},
) {
  const errors = [];

  const schema = getSchemaForModel(modelClass);
  if (schema) {
    const validatableKeys = getValidatableSchemaKeys(modelClass.name, schema);
    const payload = {};
    for (const key of validatableKeys) {
      if (camelRow[key] !== undefined) {
        payload[key] = camelRow[key];
      }
    }

    const { error } = schema.validate(payload, { abortEarly: false });
    if (error) {
      const joiFieldSet = joiFields ? new Set(joiFields) : null;
      for (const detail of error.details || []) {
        if (joiFieldSet && !joiFieldSet.has(detail.path?.[0])) {
          continue;
        }
        errors.push(detail.message);
      }
    }
  } else {
    // Fail closed: an unregistered model cannot be validated, and the
    // NOT NULL / FK checks below assume a real Sequelize model class.
    errors.push(
      `No validation schema registered for model '${modelClass?.name}'`,
    );
    return errors;
  }

  // Backstop for NOT NULL columns not covered by the Joi schema.
  const missing = validateRequiredFields(camelRow, modelClass);
  for (const field of missing) {
    if (!errors.some((message) => message.includes(`"${field}"`))) {
      errors.push(`"${field}" is required (NOT NULL column)`);
    }
  }

  if (checkForeignKeys) {
    for (const { foreignKey, target, targetTable } of getBelongsToForeignKeys(
      modelClass,
    )) {
      const fkValue = camelRow[foreignKey];
      if (fkValue === undefined || fkValue === null || fkValue === '') {
        continue; // required-ness is handled by Joi / NOT NULL checks
      }
      if (batchPks?.[targetTable]?.has(fkValue)) {
        continue;
      }
      try {
        await assertRecordExistanceOrStaged(target, fkValue, foreignKey);
      } catch (err) {
        errors.push(err.message);
      }
    }
  }

  return errors;
}

/**
 * Validate one row of a CSV batch upload against the REST API rules.
 *
 * INSERT rows get full Joi scrutiny: the record is built from the CSV alone,
 * so it must be as complete as a POST body. UPDATE rows get Joi scoped to the
 * columns the CSV actually supplies — the batch contract allows sparse rows
 * merged onto existing records, including ones that predate the current
 * schemas — while NOT NULL and FK checks always run on the full merged record.
 *
 * @param {import('sequelize').Model} modelClass
 * @param {Object} mergedRecord - full record with camelCase attribute keys
 * @param {Object} options
 * @param {'INSERT'|'UPDATE'} options.action
 * @param {string[]} options.csvFields - attribute names the row is responsible
 *   for: those its CSV columns supply, plus any the importer derives from them
 * @returns {Promise<string[]>} array of error messages (empty when valid)
 */
export async function validateCsvBatchRecord(
  modelClass,
  mergedRecord,
  { action, csvFields },
) {
  // A blank cell means "no value supplied", so it reaches here as null rather
  // than as an absent key. Drop those before validating instead of handing
  // null to the schemas, which only some fields accept. The NOT NULL and FK
  // checks read null and undefined the same way, so this only changes what
  // Joi sees, and it reports a blank required column as missing rather than as
  // the wrong type. Validate a copy — callers stage the original.
  const record = {};
  for (const [key, value] of Object.entries(mergedRecord)) {
    if (value !== null && value !== '') {
      record[key] = value;
    }
  }

  return validateStagedRecord(modelClass, record, {
    joiFields: action === 'INSERT' ? null : csvFields,
  });
}
