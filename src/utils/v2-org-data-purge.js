'use strict';

import { Op } from 'sequelize';
import {
  ProjectV2,
  UnitV2,
  VerificationV2,
  IssuanceV2,
  ValidationV2,
  LocationV2,
  EstimationV2,
  RatingV2,
  CoBenefitV2,
  ProjectMethodologyV2,
  StakeholderProjectV2,
  UnitLabelV2,
  MethodologyV2,
  ProgramV2,
  StakeholderV2,
  LabelV2,
  AefT1SubmissionV2,
  AefT5AuthorizedEntitiesV2,
  AefT2AuthorizationsV2,
  AefT3ActionsV2,
  AefT4HoldingsV2,
  FilestoreV2,
} from '../models/v2/index.js';

/**
 * Hard-delete every V2 registry record owned by an organization.
 *
 * Ownership is resolved two ways, with no reference guards — every row the org
 * created is removed even if another org/registry references it:
 *
 *  - Root/standalone tables carry org_uid directly (camelCase `orgUid`
 *    attribute): project, unit, methodology, program, stakeholder, label,
 *    aef_t1_submission. Filestore carries the snake-case `org_uid` attribute.
 *  - Project-scoped child tables carry no org_uid; ownership is traced through
 *    the org's project / unit / verification / aef_t1_submission ids:
 *    validation, verification, location, estimation, rating, co_benefit,
 *    project_methodology, stakeholder_projects, issuance, unit_label, and the
 *    AEF tier tables.
 *
 * Unlike v2-cascade-delete.js, this purge issues direct hard deletes (no
 * StagingV2 DELETE rows), so nothing is propagated to DataLayer subscribers. It
 * therefore intentionally deletes the shared/standalone records (methodology,
 * program, stakeholder, label) that v2-cascade-delete.js deliberately does NOT
 * cascade: this is a local-only "remove the whole org from this node" purge,
 * and the caller has opted out of reference checks.
 *
 * Organization and audit rows are intentionally NOT removed here — the caller
 * (OrganizationsV2.deleteAllOrganizationData) removes those alongside its meta
 * bookkeeping within the same transaction.
 *
 * @param {string} orgUid
 * @param {{ transaction?: import('sequelize').Transaction }} [options]
 * @returns {Promise<number>} total number of registry rows deleted
 */
export const purgeV2OrganizationData = async (orgUid, { transaction } = {}) => {
  if (!orgUid) {
    return 0;
  }

  const projects = await ProjectV2.findAll({
    where: { orgUid },
    attributes: ['cadTrustProjectId'],
    raw: true,
    transaction,
  });
  const projectIds = projects
    .map((project) => project.cadTrustProjectId)
    .filter(Boolean);

  const units = await UnitV2.findAll({
    where: { orgUid },
    attributes: ['cadTrustUnitId'],
    raw: true,
    transaction,
  });
  const unitIds = units.map((unit) => unit.cadTrustUnitId).filter(Boolean);

  const aefT1Submissions = await AefT1SubmissionV2.findAll({
    where: { orgUid },
    attributes: ['cadTrustAefT1SubmissionId'],
    raw: true,
    transaction,
  });
  const aefT1SubmissionIds = aefT1Submissions
    .map((submission) => submission.cadTrustAefT1SubmissionId)
    .filter(Boolean);

  let verificationIds = [];
  if (projectIds.length > 0) {
    const verifications = await VerificationV2.findAll({
      where: { cadTrustProjectId: { [Op.in]: projectIds } },
      attributes: ['cadTrustVerificationId'],
      raw: true,
      transaction,
    });
    verificationIds = verifications
      .map((verification) => verification.cadTrustVerificationId)
      .filter(Boolean);
  }

  let totalDeleted = 0;

  // Project-scoped children keyed directly by project id.
  if (projectIds.length > 0) {
    const projectScopedModels = [
      ValidationV2,
      VerificationV2,
      LocationV2,
      EstimationV2,
      RatingV2,
      CoBenefitV2,
      ProjectMethodologyV2,
      StakeholderProjectV2,
    ];
    for (const model of projectScopedModels) {
      totalDeleted += await model.destroy({
        where: { cadTrustProjectId: { [Op.in]: projectIds } },
        transaction,
      });
    }
  }

  // Issuance hangs off verification.
  if (verificationIds.length > 0) {
    totalDeleted += await IssuanceV2.destroy({
      where: { cadTrustVerificationId: { [Op.in]: verificationIds } },
      transaction,
    });
  }

  // Unit labels hang off unit.
  if (unitIds.length > 0) {
    totalDeleted += await UnitLabelV2.destroy({
      where: { cadTrustUnitId: { [Op.in]: unitIds } },
      transaction,
    });
  }

  // AEF tier tables reference the project, unit, and/or aef_t1_submission. A
  // tier row owned by the org via its T1 submission alone (null project/unit)
  // must still be removed, so trace all three relationships.
  const aefOrConditions = [];
  if (projectIds.length > 0) {
    aefOrConditions.push({ cadTrustProjectId: { [Op.in]: projectIds } });
  }
  if (unitIds.length > 0) {
    aefOrConditions.push({ cadTrustUnitId: { [Op.in]: unitIds } });
  }
  if (aefT1SubmissionIds.length > 0) {
    aefOrConditions.push({
      cadTrustAefT1SubmissionId: { [Op.in]: aefT1SubmissionIds },
    });
  }
  if (aefOrConditions.length > 0) {
    const aefModels = [
      AefT5AuthorizedEntitiesV2,
      AefT2AuthorizationsV2,
      AefT3ActionsV2,
      AefT4HoldingsV2,
    ];
    for (const model of aefModels) {
      totalDeleted += await model.destroy({
        where: { [Op.or]: aefOrConditions },
        transaction,
      });
    }
  }

  // Root/standalone tables owned via the camelCase `orgUid` attribute.
  const orgUidOwnedModels = [
    ProjectV2,
    UnitV2,
    MethodologyV2,
    ProgramV2,
    StakeholderV2,
    LabelV2,
    AefT1SubmissionV2,
  ];
  for (const model of orgUidOwnedModels) {
    totalDeleted += await model.destroy({ where: { orgUid }, transaction });
  }

  // Filestore cache exposes the snake-case `org_uid` attribute.
  totalDeleted += await FilestoreV2.destroy({
    where: { org_uid: orgUid },
    transaction,
  });

  return totalDeleted;
};
