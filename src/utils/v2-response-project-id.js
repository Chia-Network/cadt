import { Op } from 'sequelize';
import {
  IssuanceV2,
  ProjectMethodologyV2,
  ProjectV2,
} from '../models/v2/index.js';

const uniqueIds = (records, field) => [
  ...new Set(records.map((record) => record[field]).filter(Boolean)),
];

// Resolve only committed methodology/project links, independent of the
// verification path used by existing organization filters and project search.
const projectIdsByMethodology = async (issuances) => {
  const ids = uniqueIds(issuances, 'cadTrustProjectMethodologyId');
  if (!ids.length) return new Map();
  const methodologies = await ProjectMethodologyV2.findAll({
    attributes: ['cadTrustProjectMethodologyId'],
    where: { cadTrustProjectMethodologyId: { [Op.in]: ids } },
    include: [
      {
        model: ProjectV2,
        as: 'project',
        attributes: ['cadTrustProjectId'],
        required: false,
      },
    ],
  });
  return new Map(
    methodologies.map((record) => [
      record.cadTrustProjectMethodologyId,
      record.project?.cadTrustProjectId ?? null,
    ]),
  );
};

export const issuanceResponsesWithProjectId = async (records) => {
  const projectIds = await projectIdsByMethodology(records);
  return records.map((record) => ({
    ...record.toJSON(),
    cadTrustProjectId:
      projectIds.get(record.cadTrustProjectMethodologyId) ?? null,
  }));
};

export const unitResponsesWithProjectId = async (records) => {
  const ids = uniqueIds(records, 'cadTrustIssuanceId');
  const issuances = ids.length
    ? await IssuanceV2.findAll({
        attributes: ['cadTrustIssuanceId', 'cadTrustProjectMethodologyId'],
        where: { cadTrustIssuanceId: { [Op.in]: ids } },
      })
    : [];
  const projectIds = await projectIdsByMethodology(issuances);
  const projectIdsByIssuance = new Map(
    issuances.map((record) => [
      record.cadTrustIssuanceId,
      projectIds.get(record.cadTrustProjectMethodologyId) ?? null,
    ]),
  );
  return records.map((record) => ({
    ...record.toJSON(),
    cadTrustProjectId:
      projectIdsByIssuance.get(record.cadTrustIssuanceId) ?? null,
  }));
};
