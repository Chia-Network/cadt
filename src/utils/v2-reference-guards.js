'use strict';

/**
 * V2 Delete Reference Guards
 *
 * Prevents deletion of shared/standalone records (methodology, stakeholder,
 * program, label) when local references still exist. Returns reference counts
 * so the caller can decide whether to proceed with ?force=true.
 *
 * See v2-cascade-delete.js for the full design rationale on why these records
 * must not be silently deleted.
 */

import {
  ProjectMethodologyV2,
  StakeholderProjectV2,
  UnitLabelV2,
  ProjectV2,
  StagingV2,
} from '../models/v2/index.js';
import { Op } from 'sequelize';
import { toSnakeCase } from './v2-camel-to-snake.js';

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
};

const countStagedReferences = async (table, snakeFkField, recordId) => {
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
        if (record?.[snakeFkField] === recordId) {
          count += 1;
        }
      }
    } catch {
      // Ignore malformed staging rows here; staging validation catches these separately.
      continue;
    }
  }
  return count;
};

/**
 * Check whether any local records reference the given shared record.
 *
 * @param {string} table   – one of 'methodology', 'stakeholder', 'program', 'label'
 * @param {string} recordId – PK of the record being deleted
 * @returns {{ hasReferences: boolean, references: Array<{table: string, count: number, label: string}> }}
 */
export const checkReferences = async (table, recordId) => {
  const definitions = REFERENCE_MAP[table];
  if (!definitions) {
    return { hasReferences: false, references: [] };
  }

  const references = [];

  for (const { model, fkField, table: refTable, label } of definitions) {
    const mainCount = await model.count({ where: { [fkField]: recordId } });
    const stagedCount = await countStagedReferences(refTable, toSnakeCase(fkField), recordId);
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
  return {
    success: false,
    message: `Cannot delete ${entityName}: referenced by ${parts.join(', ')}`,
    references: refResult.references.map(({ table, count }) => ({ table, count })),
    hint: 'Remove all references first, or use ?force=true to delete anyway',
  };
};
