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

const STAGING_DELETE_DEFAULTS = {
  action: 'DELETE',
  committed: false,
  failed_commit: false,
  is_transfer: false,
};

const toCamelCase = (value) => value.replace(/_([a-z])/g, (_, char) => char.toUpperCase());

const getPrimaryKeyValue = (record, primaryKeyField) => {
  const camelPrimaryKeyField = toCamelCase(primaryKeyField);
  return record[camelPrimaryKeyField] ?? record[primaryKeyField] ?? null;
};

const buildDeleteRow = (table, primaryKeyField, primaryKeyValue) => ({
  uuid: uuidv4(),
  table,
  data: JSON.stringify([{ [primaryKeyField]: primaryKeyValue }]),
  ...STAGING_DELETE_DEFAULTS,
});

const pushRowsForRecords = (rows, records, table, primaryKeyField) => {
  for (const record of records) {
    const primaryKeyValue = getPrimaryKeyValue(record, primaryKeyField);
    if (!primaryKeyValue) {
      continue;
    }
    rows.push(buildDeleteRow(table, primaryKeyField, primaryKeyValue));
  }
};

export const stageIssuanceChildDeletes = async (issuanceId, options = {}) => {
  const { transaction } = options;
  const rows = [];

  const units = await UnitV2.findAll({
    where: { cadTrustIssuanceId: issuanceId },
    raw: true,
    transaction,
  });
  pushRowsForRecords(rows, units, 'unit', 'cad_trust_unit_id');

  const unitIds = units
    .map((unit) => unit.cadTrustUnitId)
    .filter(Boolean);

  if (unitIds.length > 0) {
    const unitLabels = await UnitLabelV2.findAll({
      where: { cadTrustUnitId: unitIds },
      raw: true,
      transaction,
    });
    pushRowsForRecords(rows, unitLabels, 'unit_label', 'cad_trust_unit_label_id');
  }

  if (rows.length > 0) {
    await StagingV2.bulkCreate(rows, { transaction });
  }

  return rows.length;
};

export const stageVerificationChildDeletes = async (verificationId, options = {}) => {
  const { transaction } = options;
  const rows = [];

  const issuances = await IssuanceV2.findAll({
    where: { cadTrustVerificationId: verificationId },
    raw: true,
    transaction,
  });
  pushRowsForRecords(rows, issuances, 'issuance', 'cad_trust_issuance_id');

  const issuanceIds = issuances
    .map((issuance) => issuance.cadTrustIssuanceId)
    .filter(Boolean);

  if (issuanceIds.length > 0) {
    const units = await UnitV2.findAll({
      where: { cadTrustIssuanceId: issuanceIds },
      raw: true,
      transaction,
    });
    pushRowsForRecords(rows, units, 'unit', 'cad_trust_unit_id');

    const unitIds = units
      .map((unit) => unit.cadTrustUnitId)
      .filter(Boolean);

    if (unitIds.length > 0) {
      const unitLabels = await UnitLabelV2.findAll({
        where: { cadTrustUnitId: unitIds },
        raw: true,
        transaction,
      });
      pushRowsForRecords(rows, unitLabels, 'unit_label', 'cad_trust_unit_label_id');
    }
  }

  if (rows.length > 0) {
    await StagingV2.bulkCreate(rows, { transaction });
  }

  return rows.length;
};

export const stageUnitChildDeletes = async (unitId, options = {}) => {
  const { transaction } = options;
  const rows = [];
  const unitLabels = await UnitLabelV2.findAll({
    where: { cadTrustUnitId: unitId },
    raw: true,
    transaction,
  });
  pushRowsForRecords(rows, unitLabels, 'unit_label', 'cad_trust_unit_label_id');

  if (rows.length > 0) {
    await StagingV2.bulkCreate(rows, { transaction });
  }

  return rows.length;
};

export const stageProjectChildDeletes = async (projectId, options = {}) => {
  const { transaction } = options;
  const rows = [];

  const directChildDefinitions = [
    { model: LocationV2, table: 'location', primaryKeyField: 'cad_trust_location_id' },
    { model: EstimationV2, table: 'estimation', primaryKeyField: 'cad_trust_estimation_id' },
    { model: RatingV2, table: 'rating', primaryKeyField: 'cad_trust_rating_id' },
    { model: CoBenefitV2, table: 'co_benefit', primaryKeyField: 'cad_trust_co_benefit_id' },
    { model: ValidationV2, table: 'validation', primaryKeyField: 'cad_trust_validation_id' },
    { model: ProjectMethodologyV2, table: 'project_methodology', primaryKeyField: 'cad_trust_project_methodology_id' },
    { model: StakeholderProjectV2, table: 'stakeholder_projects', primaryKeyField: 'cad_trust_stakeholder_project_id' },
  ];

  for (const { model, table, primaryKeyField } of directChildDefinitions) {
    const records = await model.findAll({
      where: { cadTrustProjectId: projectId },
      raw: true,
      transaction,
    });
    pushRowsForRecords(rows, records, table, primaryKeyField);
  }

  const verifications = await VerificationV2.findAll({
    where: { cadTrustProjectId: projectId },
    raw: true,
    transaction,
  });
  pushRowsForRecords(rows, verifications, 'verification', 'cad_trust_verification_id');

  const verificationIds = verifications
    .map((verification) => verification.cadTrustVerificationId)
    .filter(Boolean);

  if (verificationIds.length > 0) {
    const issuances = await IssuanceV2.findAll({
      where: { cadTrustVerificationId: verificationIds },
      raw: true,
      transaction,
    });
    pushRowsForRecords(rows, issuances, 'issuance', 'cad_trust_issuance_id');

    const issuanceIds = issuances
      .map((issuance) => issuance.cadTrustIssuanceId)
      .filter(Boolean);

    if (issuanceIds.length > 0) {
      const units = await UnitV2.findAll({
        where: { cadTrustIssuanceId: issuanceIds },
        raw: true,
        transaction,
      });
      pushRowsForRecords(rows, units, 'unit', 'cad_trust_unit_id');

      const unitIds = units
        .map((unit) => unit.cadTrustUnitId)
        .filter(Boolean);

      if (unitIds.length > 0) {
        const unitLabels = await UnitLabelV2.findAll({
          where: { cadTrustUnitId: unitIds },
          raw: true,
          transaction,
        });
        pushRowsForRecords(rows, unitLabels, 'unit_label', 'cad_trust_unit_label_id');
      }
    }
  }

  if (rows.length > 0) {
    await StagingV2.bulkCreate(rows, { transaction });
  }

  return rows.length;
};
