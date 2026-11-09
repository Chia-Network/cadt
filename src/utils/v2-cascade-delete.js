'use strict';

/**
 * V2 Cascade Delete — Design Rationale
 *
 * CADT records fall into two categories with fundamentally different deletion
 * strategies. Understanding this distinction is critical before modifying any
 * delete logic.
 *
 * ## 1. Project-scoped records — CASCADE on delete
 *
 * These are exclusively owned by a single project (or by a single unit in the
 * case of unit_label). No other project or registry can reference them, so they
 * are safe to cascade-delete when their parent is removed.
 *
 *   project → location, estimation, rating, co_benefit, validation,
 *             verification, project_methodology (link), stakeholder_projects (link)
 *   verification → issuance
 *   issuance → unit
 *   unit → unit_label
 *
 * When a project is deleted, the full chain above is traversed and every child
 * gets a staged DELETE entry. When a unit is deleted, its unit_label rows are
 * cascade-staged. The same applies to mid-chain deletes of verification or
 * issuance — their downstream children must also be staged.
 *
 * ## 2. Shared / standalone records — DO NOT cascade
 *
 * These exist independently with their own org_uid and can be cross-referenced
 * by any registry on the network:
 *
 *   methodology  — referenced via project_methodology from any project
 *   stakeholder  — referenced via stakeholder_projects from any project
 *   program      — referenced via cad_trust_program_id from any project
 *   label        — referenced via unit_label from any unit
 *
 * Hard-deleting a shared record propagates through DataLayer sync to every
 * subscriber, silently breaking referential integrity for any registry that
 * still references it. There is no mechanism to notify affected registries.
 *
 * These records intentionally do NOT cascade. The correct approaches (in order
 * of priority) are:
 *   - Tier 2: Block delete with 409 if any local references exist (committed or staged
 *             INSERT/UPDATE); clients must remove references first
 *   - Tier 3: Soft delete / deprecation (the only truly safe distributed
 *             systems answer — tombstones over hard deletes)
 *   - Tier 4: Orphan cleanup endpoint for records with zero local references
 *
 * See: docs/orphaned-records-analysis.md for the full analysis.
 */

import { v4 as uuidv4 } from 'uuid';
import { Transaction } from 'sequelize';
import { sequelizeV2 } from '../database/v2/index.js';
import {
  StagingV2,
  LocationV2,
  EstimationV2,
  RatingV2,
  CoBenefitV2,
  ValidationV2,
  VerificationV2,
  IssuanceV2,
  UnitV2,
  UnitLabelV2,
  ProjectMethodologyV2,
  StakeholderProjectV2,
} from '../models/v2/index.js';

// Keep the existing table traversal order; IDs within each table are canonical.
const CHILDREN = [
  { parent: 'project', model: LocationV2, foreignKey: 'cadTrustProjectId' },
  { parent: 'project', model: EstimationV2, foreignKey: 'cadTrustProjectId' },
  { parent: 'project', model: RatingV2, foreignKey: 'cadTrustProjectId' },
  { parent: 'project', model: CoBenefitV2, foreignKey: 'cadTrustProjectId' },
  { parent: 'project', model: ValidationV2, foreignKey: 'cadTrustProjectId' },
  {
    parent: 'project',
    model: ProjectMethodologyV2,
    foreignKey: 'cadTrustProjectId',
  },
  {
    parent: 'project',
    model: StakeholderProjectV2,
    foreignKey: 'cadTrustProjectId',
  },
  { parent: 'project', model: VerificationV2, foreignKey: 'cadTrustProjectId' },
  {
    parent: 'verification',
    model: IssuanceV2,
    foreignKey: 'cadTrustVerificationId',
  },
  { parent: 'issuance', model: UnitV2, foreignKey: 'cadTrustIssuanceId' },
  { parent: 'unit', model: UnitLabelV2, foreignKey: 'cadTrustUnitId' },
];

const ROOT_PRIMARY_KEYS = {
  project: 'cad_trust_project_id',
  verification: 'cad_trust_verification_id',
  issuance: 'cad_trust_issuance_id',
  unit: 'cad_trust_unit_id',
};

/**
 * Discover committed descendants only; this does not check root existence,
 * ownership, reference blockers or pending staging eligibility.
 *
 * Returns root plus unique members in parent/table traversal order, with IDs
 * sorted lexically within each table. Counts include the root. Target IDs are
 * database primary keys; staging UUIDs are allocated only by the write helpers.
 *
 * Without a supplied transaction, use one DEFERRED SQLite read snapshot rather
 * than the configured IMMEDIATE write-intent default. With a transaction, every
 * SELECT uses it and its lifecycle/snapshot remains the caller's responsibility.
 * No data/staging writes or change notifications occur during discovery.
 */
export const discoverCascadeDeletePlan = async (table, id, options = {}) => {
  if (!Object.hasOwn(ROOT_PRIMARY_KEYS, table)) {
    throw new Error(`Unsupported cascade delete root: ${table}`);
  }
  if (!options.transaction) {
    return sequelizeV2.transaction(
      { type: Transaction.TYPES.DEFERRED },
      (transaction) => discoverCascadeDeletePlan(table, id, { transaction }),
    );
  }

  const { transaction } = options;
  const root = { table, primaryKeyField: ROOT_PRIMARY_KEYS[table], id };
  const members = [root];
  const idsByTable = new Map([[table, [id]]]);
  const counts = { [table]: 1 };

  for (const { parent, model, foreignKey } of CHILDREN) {
    const parentIds = idsByTable.get(parent);
    if (!parentIds?.length) continue;
    const records = await model.findAll({
      where: { [foreignKey]: parentIds },
      raw: true,
      transaction,
    });
    const primaryKey = model.primaryKeyAttribute;
    const primaryKeyField = model.rawAttributes[primaryKey].field;
    const ids = [
      ...new Set(
        records
          .map((record) => record[primaryKey] ?? record[primaryKeyField])
          .filter(Boolean),
      ),
    ].sort();
    idsByTable.set(model.tableName, ids);
    if (ids.length > 0) {
      counts[model.tableName] = ids.length;
      for (const childId of ids)
        members.push({ table: model.tableName, primaryKeyField, id: childId });
    }
  }

  return {
    root,
    members,
    counts,
    totalCount: members.length,
    descendantCount: members.length - 1,
  };
};

const stageChildDeletes = async (table, id, { transaction } = {}) => {
  const plan = await discoverCascadeDeletePlan(table, id, { transaction });
  const rows = plan.members.slice(1).map((member) => ({
    uuid: uuidv4(),
    table: member.table,
    data: JSON.stringify([{ [member.primaryKeyField]: member.id }]),
    action: 'DELETE',
    committed: false,
    failed_commit: false,
    is_transfer: false,
  }));
  if (rows.length > 0) await StagingV2.bulkCreate(rows, { transaction });
  return rows.length;
};

export const stageProjectChildDeletes = (id, options) =>
  stageChildDeletes('project', id, options);
export const stageVerificationChildDeletes = (id, options) =>
  stageChildDeletes('verification', id, options);
export const stageIssuanceChildDeletes = (id, options) =>
  stageChildDeletes('issuance', id, options);
export const stageUnitChildDeletes = (id, options) =>
  stageChildDeletes('unit', id, options);

export const getProjectCascadeUnits = async (projectId, options = {}) => {
  const { transaction } = options;

  const verifications = await VerificationV2.findAll({
    where: { cadTrustProjectId: projectId },
    raw: true,
    transaction,
  });

  const verificationIds = verifications
    .map((verification) => verification.cadTrustVerificationId)
    .filter(Boolean);

  if (verificationIds.length === 0) {
    return [];
  }

  const issuances = await IssuanceV2.findAll({
    where: { cadTrustVerificationId: verificationIds },
    raw: true,
    transaction,
  });

  const issuanceIds = issuances
    .map((issuance) => issuance.cadTrustIssuanceId)
    .filter(Boolean);

  if (issuanceIds.length === 0) {
    return [];
  }

  return getUnitsForIssuances(issuanceIds, { transaction });
};

const getUnitsForIssuances = async (issuanceIds, options = {}) => {
  const { transaction } = options;

  if (issuanceIds.length === 0) {
    return [];
  }

  return UnitV2.findAll({
    where: { cadTrustIssuanceId: issuanceIds },
    raw: true,
    transaction,
  });
};
