'use strict';

import { startOfYear, endOfYear } from 'date-fns';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
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

  static async getDateRangeProjectStatistics(dateRangeStart, dateRangeEnd) {
    await Statistics.removeStaleTableEntries();

    const uri = `/statistics/projects?dateRangeStart=${dateRangeStart.valueOf()}&dateRangeEnd=${dateRangeEnd.valueOf()}`;
    const cacheResult = await Statistics.findOne({
      where: {
        uri,
      },
      attributes: ['statisticsJsonString'],
      raw: true,
    });

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

  static async getYtdProjectStatistics() {
    await Statistics.removeStaleTableEntries();

    const uri = `/statistics/projects`;
    const cacheResult = await Statistics.findOne({
      where: {
        uri,
      },
      attributes: ['statisticsJsonString'],
      raw: true,
    });

    if (cacheResult?.statisticsJsonString) {
      return JSON.parse(cacheResult.statisticsJsonString);
    } else {
      const currentYearStart = startOfYear(new Date());
      const currentYearEnd = endOfYear(new Date());

      const registeredProjectsCount = await Project.count({
        where: {
          projectStatus: 'Registered',
          updatedAt: {
            [Sequelize.Op.between]: [currentYearStart, currentYearEnd],
          },
        },
      });

      const authorizedProjectsCount = await Project.count({
        where: {
          projectStatus: 'Authorized',
          updatedAt: {
            [Sequelize.Op.between]: [currentYearStart, currentYearEnd],
          },
        },
      });

      const completedProjectsCount = await Project.count({
        where: {
          projectStatus: 'Completed',
          updatedAt: {
            [Sequelize.Op.between]: [currentYearStart, currentYearEnd],
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
