'use strict';

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

export const stageUnitChildDeletes = async (unitId) => {
  const rows = [];
  const unitLabels = await UnitLabelV2.findAll({
    where: { cadTrustUnitId: unitId },
    raw: true,
  });
  pushRowsForRecords(rows, unitLabels, 'unit_label', 'cad_trust_unit_label_id');

  if (rows.length > 0) {
    await StagingV2.bulkCreate(rows);
  }

  return rows.length;
};

export const stageProjectChildDeletes = async (projectId) => {
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
    });
    pushRowsForRecords(rows, records, table, primaryKeyField);
  }

  const verifications = await VerificationV2.findAll({
    where: { cadTrustProjectId: projectId },
    raw: true,
  });
  pushRowsForRecords(rows, verifications, 'verification', 'cad_trust_verification_id');

  const verificationIds = verifications
    .map((verification) => verification.cadTrustVerificationId)
    .filter(Boolean);

  if (verificationIds.length > 0) {
    const issuances = await IssuanceV2.findAll({
      where: { cadTrustVerificationId: verificationIds },
      raw: true,
    });
    pushRowsForRecords(rows, issuances, 'issuance', 'cad_trust_issuance_id');

    const issuanceIds = issuances
      .map((issuance) => issuance.cadTrustIssuanceId)
      .filter(Boolean);

    if (issuanceIds.length > 0) {
      const units = await UnitV2.findAll({
        where: { cadTrustIssuanceId: issuanceIds },
        raw: true,
      });
      pushRowsForRecords(rows, units, 'unit', 'cad_trust_unit_id');

      const unitIds = units
        .map((unit) => unit.cadTrustUnitId)
        .filter(Boolean);

      if (unitIds.length > 0) {
        const unitLabels = await UnitLabelV2.findAll({
          where: { cadTrustUnitId: unitIds },
          raw: true,
        });
        pushRowsForRecords(rows, unitLabels, 'unit_label', 'cad_trust_unit_label_id');
      }
    }
  }

  if (rows.length > 0) {
    await StagingV2.bulkCreate(rows);
  }

  return rows.length;
};
