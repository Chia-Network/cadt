'use strict';

import { Op } from 'sequelize';
import {
  destroyByPrimaryKeyBatches,
  resolveDeleteBatchSize,
} from './batched-delete.js';
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

const chunkValues = (values, batchSize) => {
  const chunks = [];
  for (let index = 0; index < values.length; index += batchSize) {
    chunks.push(values.slice(index, index + batchSize));
  }
  return chunks;
};

const uniqueValues = (values) => [...new Set(values.filter(Boolean))];

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
 * Organization and audit rows are intentionally NOT removed here. The caller
 * removes them after registry data, deleting the organization row last so an
 * interrupted purge remains visible and can be retried.
 *
 * @param {string} orgUid
 * @param {{ transaction?: import('sequelize').Transaction, batchSize?: number, transactionRunner?: Function }} [options]
 * @returns {Promise<number>} total number of registry rows deleted
 */
export const purgeV2OrganizationData = async (
  orgUid,
  { transaction, batchSize, transactionRunner } = {},
) => {
  if (!orgUid) {
    return 0;
  }
  const deleteBatchSize = resolveDeleteBatchSize(batchSize);

  const destroyBatches = (model, where) =>
    destroyByPrimaryKeyBatches(model, {
      where,
      batchSize: deleteBatchSize,
      transactionRunner:
        transactionRunner ||
        (transaction
          ? (operation) => operation(transaction)
          : undefined),
    });

  const destroyByIdChunks = async (model, attributeName, values) => {
    let deleted = 0;
    for (const chunk of chunkValues(values, deleteBatchSize)) {
      deleted += await destroyBatches(model, {
        [attributeName]: { [Op.in]: chunk },
      });
    }
    return deleted;
  };

  const findIdsByChunks = async (
    model,
    lookupAttributeName,
    lookupValues,
    idAttributeName,
  ) => {
    const ids = [];
    for (const chunk of chunkValues(lookupValues, deleteBatchSize)) {
      const rows = await model.findAll({
        where: { [lookupAttributeName]: { [Op.in]: chunk } },
        attributes: [idAttributeName],
        raw: true,
        transaction,
      });
      ids.push(...rows.map((row) => row[idAttributeName]).filter(Boolean));
    }
    return ids;
  };

  const findIdsByAnyRelationship = async (model, idAttributeName, relationships) => {
    const ids = [];
    for (const [lookupAttributeName, lookupValues] of relationships) {
      if (lookupValues.length > 0) {
        ids.push(
          ...(await findIdsByChunks(
            model,
            lookupAttributeName,
            lookupValues,
            idAttributeName,
          )),
        );
      }
    }
    return uniqueValues(ids);
  };

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
    verificationIds = await findIdsByChunks(
      VerificationV2,
      'cadTrustProjectId',
      projectIds,
      'cadTrustVerificationId',
    );
  }

  let totalDeleted = 0;

  // Project-scoped children keyed directly by project id.
  if (projectIds.length > 0) {
    const projectScopedModels = [
      ValidationV2,
      LocationV2,
      EstimationV2,
      RatingV2,
      CoBenefitV2,
      ProjectMethodologyV2,
      StakeholderProjectV2,
    ];
    for (const model of projectScopedModels) {
      totalDeleted += await destroyByIdChunks(
        model,
        'cadTrustProjectId',
        projectIds,
      );
    }
  }

  // Issuance hangs off verification, so delete it before verification rows.
  if (verificationIds.length > 0) {
    totalDeleted += await destroyByIdChunks(
      IssuanceV2,
      'cadTrustVerificationId',
      verificationIds,
    );
  }
  if (projectIds.length > 0) {
    totalDeleted += await destroyByIdChunks(
      VerificationV2,
      'cadTrustProjectId',
      projectIds,
    );
  }

  // Unit labels hang off unit.
  if (unitIds.length > 0) {
    totalDeleted += await destroyByIdChunks(UnitLabelV2, 'cadTrustUnitId', unitIds);
  }

  const aefOwnershipRelationships = [
    ['cadTrustProjectId', projectIds],
    ['cadTrustUnitId', unitIds],
    ['cadTrustAefT1SubmissionId', aefT1SubmissionIds],
  ];

  const ownedAefT5Ids = await findIdsByAnyRelationship(
    AefT5AuthorizedEntitiesV2,
    'cadTrustAefT5AuthorizedEntitiesId',
    aefOwnershipRelationships,
  );
  const ownedAefT2Ids = await findIdsByAnyRelationship(
    AefT2AuthorizationsV2,
    'cadTrustAefT2AuthorizationsId',
    [
      ...aefOwnershipRelationships,
      ['cadTrustAefT5AuthorizedEntitiesId', ownedAefT5Ids],
    ],
  );

  // AEF tier tables can reference project, unit, T1, or parent AEF rows.
  for (const [lookupAttributeName, lookupValues] of [
    ...aefOwnershipRelationships,
    ['cadTrustAefT2AuthorizationsId', ownedAefT2Ids],
  ]) {
    if (lookupValues.length > 0) {
      totalDeleted += await destroyByIdChunks(
        AefT3ActionsV2,
        lookupAttributeName,
        lookupValues,
      );
      totalDeleted += await destroyByIdChunks(
        AefT4HoldingsV2,
        lookupAttributeName,
        lookupValues,
      );
    }
  }

  for (const [lookupAttributeName, lookupValues] of [
    ...aefOwnershipRelationships,
    ['cadTrustAefT5AuthorizedEntitiesId', ownedAefT5Ids],
  ]) {
    if (lookupValues.length > 0) {
      totalDeleted += await destroyByIdChunks(
        AefT2AuthorizationsV2,
        lookupAttributeName,
        lookupValues,
      );
    }
  }

  for (const [lookupAttributeName, lookupValues] of aefOwnershipRelationships) {
    if (lookupValues.length > 0) {
      totalDeleted += await destroyByIdChunks(
        AefT5AuthorizedEntitiesV2,
        lookupAttributeName,
        lookupValues,
      );
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
    totalDeleted += await destroyBatches(model, { orgUid });
  }

  // Filestore cache exposes the snake-case `org_uid` attribute.
  totalDeleted += await destroyBatches(FilestoreV2, { org_uid: orgUid });

  return totalDeleted;
};
