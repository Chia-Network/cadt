'use strict';

/**
 * V2 Delete Reference Guards
 *
 * Blocks deletion when any local record (committed or staged INSERT/UPDATE)
 * still references the target. References from any org/registry in the synced
 * database count the same.
 *
 * See v2-cascade-delete.js for cascade vs shared-record design rationale.
 */

import {
  ProjectMethodologyV2,
  StakeholderProjectV2,
  UnitLabelV2,
  ProjectV2,
  StagingV2,
  IssuanceV2,
  VerificationV2,
  AefT5AuthorizedEntitiesV2,
  AefT2AuthorizationsV2,
  AefT3ActionsV2,
  AefT4HoldingsV2,
} from '../models/v2/index.js';
import { Op } from 'sequelize';
import { toSnakeCase } from './v2-camel-to-snake.js';
import { getV2PrimaryKeyField } from './v2-primary-key-utils.js';

const REFERENCE_ERROR_CODE = 'Referenced records must be removed before deletion';

/**
 * @typedef {object} ReferenceDefinition
 * @property {import('sequelize').Model} model
 * @property {string} fkField - Sequelize attribute (camelCase)
 * @property {string} table - staging / DB table name (snake_case)
 * @property {string} label - human-readable plural for messages
 * @property {(recordId: string) => object} [buildWhere] - optional custom where clause
 * @property {(record: object, recordId: string) => boolean} [stagedMatch] - staged row match
 */

/** @type {Record<string, ReferenceDefinition[]>} */
const REFERENCE_MAP = {
  methodology: [
    {
      model: ProjectMethodologyV2,
      fkField: 'cadTrustMethodologyId',
      table: 'project_methodology',
      label: 'project-methodology links',
    },
  ],
  stakeholder: [
    {
      model: StakeholderProjectV2,
      fkField: 'cadTrustStakeholderId',
      table: 'stakeholder_projects',
      label: 'stakeholder-project links',
    },
  ],
  program: [
    {
      model: ProjectV2,
      fkField: 'cadTrustProgramId',
      table: 'project',
      label: 'projects',
    },
  ],
  label: [
    {
      model: UnitLabelV2,
      fkField: 'cadTrustLabelId',
      table: 'unit_label',
      label: 'unit-label links',
    },
  ],
  project_methodology: [
    {
      model: IssuanceV2,
      fkField: 'cadTrustProjectMethodologyId',
      table: 'issuance',
      label: 'issuance records',
    },
  ],
  location: [
    {
      model: IssuanceV2,
      fkField: 'cadTrustLocationId',
      table: 'issuance',
      label: 'issuance records',
    },
  ],
  validation: [
    {
      model: VerificationV2,
      fkField: 'cadTrustValidationId',
      table: 'verification',
      label: 'verifications',
    },
  ],
  project: [
    {
      model: ProjectV2,
      fkField: 'cadTrustReferenceProjectId',
      table: 'project',
      label: 'projects referencing this project',
      buildWhere: (recordId) => ({
        cadTrustReferenceProjectId: recordId,
        cadTrustProjectId: { [Op.ne]: recordId },
      }),
      stagedMatch: (record, recordId) => (
        record?.cad_trust_reference_project_id === recordId
        && record?.cad_trust_project_id !== recordId
      ),
    },
  ],
  unit: [
    {
      model: AefT5AuthorizedEntitiesV2,
      fkField: 'cadTrustUnitId',
      table: 'aef_t5_authorized_entities',
      label: 'AEF-T5 authorized entity records',
    },
    {
      model: AefT2AuthorizationsV2,
      fkField: 'cadTrustUnitId',
      table: 'aef_t2_authorizations',
      label: 'AEF-T2 authorization records',
    },
    {
      model: AefT3ActionsV2,
      fkField: 'cadTrustUnitId',
      table: 'aef_t3_actions',
      label: 'AEF-T3 action records',
    },
    {
      model: AefT4HoldingsV2,
      fkField: 'cadTrustUnitId',
      table: 'aef_t4_holdings',
      label: 'AEF-T4 holding records',
    },
  ],
};

const countStagedReferences = async (table, snakeFkField, recordId, matchPredicate = null) => {
  const stagedRows = await StagingV2.findAll({
    where: {
      table,
      action: { [Op.in]: ['INSERT', 'UPDATE'] },
      committed: false,
      failed_commit: false,
    },
    raw: true,
  });

  let count = 0;
  for (const stagedRow of stagedRows) {
    try {
      const parsedData = JSON.parse(stagedRow.data);
      const records = Array.isArray(parsedData) ? parsedData : [parsedData];
      for (const record of records) {
        if (matchPredicate) {
          if (matchPredicate(record)) {
            count += 1;
          }
        } else if (record?.[snakeFkField] === recordId) {
          count += 1;
        }
      }
    } catch {
      continue;
    }
  }
  return count;
};

const findPendingStagedDeleteIds = async (table, primaryKeyField) => {
  const stagedRows = await StagingV2.findAll({
    where: {
      table,
      action: 'DELETE',
      committed: false,
      failed_commit: false,
    },
    raw: true,
  });

  const deletedIds = new Set();
  for (const stagedRow of stagedRows) {
    try {
      const parsedData = JSON.parse(stagedRow.data);
      const records = Array.isArray(parsedData) ? parsedData : [parsedData];
      for (const record of records) {
        if (record?.[primaryKeyField]) {
          deletedIds.add(record[primaryKeyField]);
        }
      }
    } catch {
      continue;
    }
  }
  return deletedIds;
};

/**
 * Check whether any local records reference the given record (committed + staged).
 *
 * @param {string} table – logical key: methodology, stakeholder, program, label,
 *   project_methodology, location, validation, project, unit
 * @param {string} recordId – PK of the record being deleted
 * @returns {{ hasReferences: boolean, references: Array<{table: string, count: number, label: string}> }}
 */
export const checkReferences = async (table, recordId) => {
  const definitions = REFERENCE_MAP[table];
  if (!definitions) {
    return { hasReferences: false, references: [] };
  }

  const references = [];

  for (const def of definitions) {
    const { model, fkField, table: refTable, label, buildWhere, stagedMatch } = def;
    const where = buildWhere ? buildWhere(recordId) : { [fkField]: recordId };
    const mainRecords = await model.findAll({ where, raw: true });
    const primaryKeyAttr = model.primaryKeyAttribute;
    const primaryKeyField = getV2PrimaryKeyField(refTable) || toSnakeCase(primaryKeyAttr);
    const pendingDeleteIds = await findPendingStagedDeleteIds(refTable, primaryKeyField);
    const mainCount = mainRecords.filter((row) => {
      const rowId = row?.[primaryKeyAttr] ?? row?.[primaryKeyField];
      return !pendingDeleteIds.has(rowId);
    }).length;

    const snakeFk = toSnakeCase(fkField);
    const stagedCount = stagedMatch
      ? await countStagedReferences(refTable, snakeFk, recordId, (record) => stagedMatch(record, recordId))
      : await countStagedReferences(refTable, snakeFk, recordId);

    const totalCount = mainCount + stagedCount;
    if (totalCount > 0) {
      references.push({ table: refTable, count: totalCount, label });
    }
  }

  return {
    hasReferences: references.length > 0,
    references,
  };
};

/**
 * Build a 409 response body from a reference check result.
 *
 * @param {string} entityName – human-readable name ("methodology", "program", …)
 * @param {{ references: Array<{count: number, label: string}> }} refResult
 * @returns {object} JSON-serialisable response body
 */
export const buildReferenceConflictBody = (entityName, refResult) => {
  const parts = refResult.references.map((r) => `${r.count} ${r.label}`);
  const refSummary = parts.join(', ');
  return {
    success: false,
    message: `Cannot delete ${entityName}: it is still referenced by ${refSummary}. Remove those references before deleting this ${entityName}.`,
    error: REFERENCE_ERROR_CODE,
    references: refResult.references.map(({ table, count }) => ({ table, count })),
  };
};
