import { Op } from 'sequelize';
import { ValidationV2, VerificationV2 } from '../models/v2/index.js';

export const projectRelatedIdColumns = [
  'cadTrustValidationIds',
  'cadTrustVerificationIds',
];

// Enrich only the selected page, without joining has-many rows into pagination.
// Plain response objects keep computed fields out of model/write serialization.
export async function enrichProjectRelatedIds(projects, columns) {
  if (!projects.length || !columns.length) return projects;

  const rows = projects.map((project) => project.toJSON());
  const projectIds = rows.map((project) => project.cadTrustProjectId);
  const children = [
    {
      column: 'cadTrustValidationIds',
      model: ValidationV2,
      id: 'cadTrustValidationId',
    },
    {
      column: 'cadTrustVerificationIds',
      model: VerificationV2,
      id: 'cadTrustVerificationId',
    },
  ];

  await Promise.all(
    children
      .filter(({ column }) => columns.includes(column))
      .map(async ({ column, model, id }) => {
        const records = await model.findAll({
          attributes: ['cadTrustProjectId', id],
          where: { cadTrustProjectId: { [Op.in]: projectIds } },
          order: [[id, 'ASC']],
          raw: true,
        });
        const idsByProject = new Map(
          rows.map((project) => [project.cadTrustProjectId, []]),
        );
        for (const record of records) {
          idsByProject.get(record.cadTrustProjectId).push(record[id]);
        }
        for (const project of rows) {
          project[column] = idsByProject.get(project.cadTrustProjectId);
        }
      }),
  );

  return rows;
}
