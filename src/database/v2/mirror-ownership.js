import { Op } from 'sequelize';
import { loggerV2 } from '../../config/logger.js';

// The count/timestamp gate cannot see owners omitted by old mirror metadata.
// Only a NULL mirror owner with a known source owner needs repair. Paginate
// candidates so legitimate legacy NULLs neither force full writes nor require
// loading the entire table into memory. Errors conservatively require backfill.
export const hasMissingMirrorOwners = async (source, mirror, batchSize) => {
  const pk = source.primaryKeyAttribute;
  let lastPk = null;
  try {
    while (true) {
      const candidates = await mirror.findAll({
        attributes: [pk],
        where: {
          orgUid: null,
          ...(lastPk === null ? {} : { [pk]: { [Op.gt]: lastPk } }),
        },
        order: [[pk, 'ASC']],
        limit: batchSize,
        raw: true,
      });
      if (candidates.length === 0) return false;
      const knownOwner = await source.findOne({
        attributes: [pk],
        where: {
          [pk]: { [Op.in]: candidates.map((row) => row[pk]) },
          orgUid: { [Op.ne]: null },
        },
        raw: true,
      });
      if (knownOwner) return true;
      if (candidates.length < batchSize) return false;
      lastPk = candidates[candidates.length - 1][pk];
    }
  } catch (error) {
    loggerV2.warn(
      `[v2]: Mirror ownership check failed for ${source.tableName}: ${error.message}; falling through to full backfill`,
    );
    return true;
  }
};
