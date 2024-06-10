'use strict';

import { Unit } from '../units/index.js';

const { Model } = Sequelize;
import Sequelize from 'sequelize';
import { sequelize, safeMirrorDbHandler } from '../../database';
import { StatisticsMirror } from './statistics.model.mirror';
import ModelTypes from './statistics.modeltypes.cjs';
import { Project } from '../projects/index.js';

class Statistics extends Model {
  static async create(values, options) {
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await StatisticsMirror.create(values, mirrorOptions);
    });
    return super.create(values, options);
  }

  static async destroy(options) {
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await StatisticsMirror.destroy(mirrorOptions);
    });
    return super.destroy(options);
  }

  static async upsert(values, options) {
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await StatisticsMirror.upsert(values, mirrorOptions);
    });
    return super.upsert(values, options);
  }

  static async removeStaleTableEntries() {
    const invalidationDate = new Date(Date.now().valueOf() - 300000); // time 5 mins ago

    const where = {
      createdAt: {
        [Sequelize.Op.notBetween]: [invalidationDate, new Date()],
      },
    };

    return await Statistics.destroy({ where });
  }

  static async getCachedResult(uri) {
    return await Statistics.findOne({
      where: {
        uri,
      },
      attributes: ['statisticsJsonString'],
      raw: true,
    });
  }

  static async getDateRangeProjectStatistics(dateRangeStart, dateRangeEnd) {
    await Statistics.removeStaleTableEntries();

    const uri = `/statistics/projects?dateRangeStart=${dateRangeStart.valueOf()}&dateRangeEnd=${dateRangeEnd.valueOf()}`;
    const cacheResult = await Statistics.getCachedResult(uri);

    if (cacheResult?.statisticsJsonString) {
      return JSON.parse(cacheResult.statisticsJsonString);
    } else {
      const registeredProjectsCount = await Project.count({
        where: {
          projectStatus: 'Registered',
          updatedAt: {
            [Sequelize.Op.between]: [
              new Date(dateRangeStart),
              new Date(dateRangeEnd),
            ],
          },
        },
      });

      const authorizedProjectsCount = await Project.count({
        where: {
          projectStatus: 'Authorized',
          updatedAt: {
            [Sequelize.Op.between]: [
              new Date(dateRangeStart),
              new Date(dateRangeEnd),
            ],
          },
        },
      });

      const completedProjectsCount = await Project.count({
        where: {
          projectStatus: 'Completed',
          updatedAt: {
            [Sequelize.Op.between]: [
              new Date(dateRangeStart),
              new Date(dateRangeEnd),
            ],
          },
        },
      });

      const result = {
        registeredProjectsCount,
        authorizedProjectsCount,
        completedProjectsCount,
      };

      await Statistics.create({
        uri,
        statisticsJsonString: JSON.stringify(result),
      });

      return result;
    }
  }

  static async getProjectStatistics() {
    await Statistics.removeStaleTableEntries();

    const uri = `/statistics/projects`;
    const cacheResult = await Statistics.getCachedResult(uri);

    if (cacheResult?.statisticsJsonString) {
      return JSON.parse(cacheResult.statisticsJsonString);
    } else {
      const registeredProjectsCount = await Project.count({
        where: {
          projectStatus: 'Registered',
        },
      });

      const authorizedProjectsCount = await Project.count({
        where: {
          projectStatus: 'Authorized',
        },
      });

      const completedProjectsCount = await Project.count({
        where: {
          projectStatus: 'Completed',
        },
      });

      const result = {
        registeredProjectsCount,
        authorizedProjectsCount,
        completedProjectsCount,
      };

      await Statistics.create({
        uri,
        statisticsJsonString: JSON.stringify(result),
      });

      return result;
    }
  }

  static async getIssuedAuthorizedNdcTonsCo2() {
    await Statistics.removeStaleTableEntries();

    const uri = `/statistics/tonsCo2?set=issued-authorized-ndc`;
    const cacheResult = await Statistics.getCachedResult(uri);

    if (cacheResult?.statisticsJsonString) {
      return JSON.parse(cacheResult.statisticsJsonString);
    } else {
      const [issuedTonsResult] = await Unit.findAll({
        attributes: [
          [
            sequelize.fn(
              'SUM',
              sequelize.fn(
                'IFNULL',
                sequelize.cast(sequelize.col('unitCount'), 'SIGNED'),
                0,
              ),
            ),
            'unitSum',
          ],
        ],
      });

      const [authorizedTonsResult] = await Unit.findAll({
        where: {
          unitStatus: 'Authorized',
        },
        attributes: [
          [
            sequelize.fn(
              'SUM',
              sequelize.fn(
                'IFNULL',
                sequelize.cast(sequelize.col('unitCount'), 'SIGNED'),
                0,
              ),
            ),
            'unitSum',
          ],
        ],
      });

      const issuedTonsCount = issuedTonsResult?.dataValues?.unitSum || 0;
      const authorizedTonsCount =
        authorizedTonsResult?.dataValues?.unitSum || 0;
      const ndcTonsCount = 0;

      const result = {
        issuedTonsCount,
        authorizedTonsCount,
        ndcTonsCount,
      };

      await Statistics.create({
        uri,
        statisticsJsonString: JSON.stringify(result),
      });

      return result;
    }
  }

  static async getDateRangeIssuedAuthorizedNdcTonsCo2(
    dateRangeStart,
    dateRangeEnd,
  ) {
    await Statistics.removeStaleTableEntries();

    const uri = `/statistics/tonsCo2?set=issuedAuthorizedNdc&dateRangeStart=${dateRangeStart}&dateRangeEnd=${dateRangeEnd}`;
    const cacheResult = await Statistics.getCachedResult(uri);

    if (cacheResult?.statisticsJsonString) {
      return JSON.parse(cacheResult.statisticsJsonString);
    } else {
      const [issuedTonsResult] = await Unit.findAll({
        where: {
          updatedAt: {
            [Sequelize.Op.between]: [
              new Date(dateRangeStart),
              new Date(dateRangeEnd),
            ],
          },
        },
        attributes: [
          [
            sequelize.fn(
              'SUM',
              sequelize.fn(
                'IFNULL',
                sequelize.cast(sequelize.col('unitCount'), 'SIGNED'),
                0,
              ),
            ),
            'unitSum',
          ],
        ],
      });

      const [authorizedTonsResult] = await Unit.findAll({
        where: {
          [Sequelize.Op.and]: {
            unitStatus: 'Authorized',
            updatedAt: {
              [Sequelize.Op.between]: [
                new Date(dateRangeStart),
                new Date(dateRangeEnd),
              ],
            },
          },
        },
        attributes: [
          [
            sequelize.fn(
              'SUM',
              sequelize.fn(
                'IFNULL',
                sequelize.cast(sequelize.col('unitCount'), 'SIGNED'),
                0,
              ),
            ),
            'unitSum',
          ],
        ],
      });

      const issuedTonsCount = issuedTonsResult?.dataValues?.unitSum || 0;
      const authorizedTonsCount =
        authorizedTonsResult?.dataValues?.unitSum || 0;
      const ndcTonsCount = 0;

      const result = {
        issuedTonsCount,
        authorizedTonsCount,
        ndcTonsCount,
      };

      await Statistics.create({
        uri,
        statisticsJsonString: JSON.stringify(result),
      });

      return result;
    }
  }

  static async getRetiredBufferTonsCo2() {
    await Statistics.removeStaleTableEntries();

    const uri = `/statistics/tonsCo2?set=retiredBuffer`;
    const cacheResult = await Statistics.getCachedResult(uri);

    if (cacheResult?.statisticsJsonString) {
      return JSON.parse(cacheResult.statisticsJsonString);
    } else {
      const [retiredTonsResult] = await Unit.findAll({
        where: {
          [Sequelize.Op.and]: {
            unitStatus: 'Retired',
          },
        },
        attributes: [
          [
            sequelize.fn(
              'SUM',
              sequelize.fn(
                'IFNULL',
                sequelize.cast(sequelize.col('unitCount'), 'SIGNED'),
                0,
              ),
            ),
            'unitSum',
          ],
        ],
      });

      const bufferTonsCount = 0;
      const retiredTonsCount = retiredTonsResult?.dataValues?.unitSum || 0;

      const result = {
        bufferTonsCount,
        retiredTonsCount,
      };

      await Statistics.create({
        uri,
        statisticsJsonString: JSON.stringify(result),
      });

      return result;
    }
  }

  static async getDateRangeRetiredBufferTonsCo2(dateRangeStart, dateRangeEnd) {
    await Statistics.removeStaleTableEntries();

    const uri = `/statistics/tonsCo2?set=retiredBuffer&dateRangeStart=${dateRangeStart}&dateRangeEnd=${dateRangeEnd}`;
    const cacheResult = await Statistics.getCachedResult(uri);

    if (cacheResult?.statisticsJsonString) {
      return JSON.parse(cacheResult.statisticsJsonString);
    } else {
      const [retiredTonsResult] = await Unit.findAll({
        where: {
          [Sequelize.Op.and]: {
            unitStatus: 'Retired',
            updatedAt: {
              [Sequelize.Op.between]: [
                new Date(dateRangeStart),
                new Date(dateRangeEnd),
              ],
            },
          },
        },
        attributes: [
          [
            sequelize.fn(
              'SUM',
              sequelize.fn(
                'IFNULL',
                sequelize.cast(sequelize.col('unitCount'), 'SIGNED'),
                0,
              ),
            ),
            'unitSum',
          ],
        ],
      });

      const bufferTonsCount = 0;
      const retiredTonsCount = retiredTonsResult?.dataValues?.unitSum || 0;

      const result = {
        bufferTonsCount,
        retiredTonsCount,
      };

      await Statistics.create({
        uri,
        statisticsJsonString: JSON.stringify(result),
      });

      return result;
    }
  }
}

Statistics.init(ModelTypes, {
  sequelize,
  modelName: 'statistics',
  freezeTableName: true,
  timestamps: true,
  createdAt: true,
  updatedAt: true,
});

export { Statistics };
