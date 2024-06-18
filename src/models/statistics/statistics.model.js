'use strict';

const { Model } = Sequelize;
import { Unit } from '../units/index.js';
import Sequelize from 'sequelize';
import { sequelize, safeMirrorDbHandler } from '../../database';
import { StatisticsMirror } from './statistics.model.mirror';
import ModelTypes from './statistics.modeltypes.cjs';
import { Project } from '../projects/index.js';
import { Organization } from '../organizations/index.js';
import { Issuance } from '../issuances/index.js';
import _ from 'lodash';

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

  static async getProjectCount(projectStatus, dateRangeStart, dateRangeEnd) {
    const homeOrg = await Organization.getHomeOrg();

    const andConditions = [{ orgUid: homeOrg.orgUid }];

    if (projectStatus) {
      andConditions.push({ projectStatus });
    }

    if (dateRangeStart && dateRangeEnd) {
      andConditions.push({
        updatedAt: {
          [Sequelize.Op.between]: [
            new Date(dateRangeStart),
            new Date(dateRangeEnd),
          ],
        },
      });
    }

    const where = {
      [Sequelize.Op.and]: andConditions,
    };

    return await Project.count({
      where,
    });
  }

  static async getUnitTableTonsCo2Count(
    unitStatus,
    dateRangeStart,
    dateRangeEnd,
  ) {
    const homeOrg = await Organization.getHomeOrg();

    const andConditions = [{ orgUid: homeOrg.orgUid }];

    if (unitStatus) {
      andConditions.push({ unitStatus });
    } else {
      andConditions.push({
        unitStatus: {
          [Sequelize.Op.not]: 'Cancelled',
        },
      });
    }

    if (dateRangeStart && dateRangeEnd) {
      andConditions.push({
        updatedAt: {
          [Sequelize.Op.between]: [
            new Date(dateRangeStart),
            new Date(dateRangeEnd),
          ],
        },
      });
    }

    const where = {
      [Sequelize.Op.and]: andConditions,
    };

    const [result] = await Unit.findAll({
      where,
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
          'unitCount',
        ],
      ],
      raw: true,
    });

    return result?.unitCount || 0;
  }

  static async getAllMethodologyTonsCo2Count() {
    const homeOrg = await Organization.getHomeOrg();

    const [result] = await sequelize.query(
      `
        WITH methodology_warehouse_projects AS (
            SELECT
                methodology,
                warehouseProjectId
            FROM
                projects
            WHERE
                orgUid = :orgUid
              AND
                projectStatus != 'Cancelled'
            )

        SELECT
            mwp.methodology,
            SUM(
                CASE
                    WHEN u.unitCount IS NULL THEN 0
                    WHEN u.unitCount GLOB '*[^0-9]*' THEN 0
                    ELSE CAST(u.unitCount AS INTEGER)
                END
            ) AS totalUnitCount
        FROM
            methodology_warehouse_projects mwp
          JOIN
            issuances i ON mwp.warehouseProjectId = i.warehouseProjectId
          JOIN
            units u ON u.issuanceId = i.id
        GROUP BY
            mwp.methodology
    `,
      {
        replacements: {
          orgUid: homeOrg.orgUid,
        },
      },
    );

    const [allMethodologies] = await sequelize.query(
      `
        SELECT methodology
        FROM projects
        WHERE
            orgUid = :orgUid
          AND
            projectStatus != 'Cancelled'
        GROUP BY methodology
    `,
      {
        replacements: {
          orgUid: homeOrg.orgUid,
        },
      },
    );

    const methodologyTonsCo2Count = result.reduce((acc, obj) => {
      acc[obj.methodology] = obj.totalUnitCount;
      return acc;
    }, {});

    allMethodologies.forEach((methodology) => {
      const count = methodologyTonsCo2Count?.[methodology.methodology];
      methodology.tonsCo2 = count || 0;
    });

    return allMethodologies;
  }

  static async getProjectAttributeBasedTonsCo2Count(projectSelectors) {
    const homeOrg = await Organization.getHomeOrg();
    const { dateRangeStart, dateRangeEnd, ...projectAttributes } =
      projectSelectors;

    const warehouseProjectIds = await Project.findAll({
      where: {
        [Sequelize.Op.and]: {
          orgUid: homeOrg.orgUid,
          ...(!_.isEmpty(projectAttributes) && { ...projectAttributes }),
          ...(dateRangeStart &&
            dateRangeEnd && {
              updatedAt: {
                [Sequelize.Op.between]: {
                  dateRangeStart,
                  dateRangeEnd,
                },
              },
            }),
        },
      },
      attributes: ['warehouseProjectId'],
    }).then((warehouseProjectIds) =>
      warehouseProjectIds.map((project) => project.warehouseProjectId),
    );

    const issuanceIds = await Issuance.findAll({
      attributes: ['id'],
      where: {
        warehouseProjectId: {
          [Sequelize.Op.in]: warehouseProjectIds,
        },
      },
      raw: true,
    }).then((issuances) => issuances.map((issuance) => issuance.id));

    const [unitResult] = await Unit.findAll({
      where: {
        [Sequelize.Op.and]: {
          unitStatus: {
            [Sequelize.Op.not]: 'Cancelled',
          },
          issuanceId: {
            [Sequelize.Op.in]: issuanceIds,
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
          'unitCount',
        ],
      ],
      raw: true,
    });

    return unitResult?.unitCount || 0;
  }

  static async getProjectStatistics(dateRangeStart, dateRangeEnd) {
    await Statistics.removeStaleTableEntries();

    const uri =
      dateRangeStart && dateRangeEnd
        ? `/statistics/projects?dateRangeStart=${dateRangeStart.valueOf()}&dateRangeEnd=${dateRangeEnd.valueOf()}`
        : `/statistics/projects`;
    const cacheResult = await Statistics.getCachedResult(uri);

    if (cacheResult?.statisticsJsonString) {
      return JSON.parse(cacheResult.statisticsJsonString);
    } else {
      const registeredProjectsCount = await Statistics.getProjectCount(
        'Registered',
        dateRangeStart,
        dateRangeEnd,
      );
      const authorizedProjectsCount = await Statistics.getProjectCount(
        'Authorized',
        dateRangeStart,
        dateRangeEnd,
      );
      const completedProjectsCount = await Statistics.getProjectCount(
        'Completed',
        dateRangeStart,
        dateRangeEnd,
      );

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

  static async getIssuedAuthorizedNdcTonsCo2(dateRangeStart, dateRangeEnd) {
    await Statistics.removeStaleTableEntries();

    const uri =
      dateRangeStart && dateRangeEnd
        ? `/statistics/tonsCo2?set=issuedAuthorizedNdc&dateRangeStart=${dateRangeStart}&dateRangeEnd=${dateRangeEnd}`
        : `/statistics/tonsCo2?set=issuedAuthorizedNdc`;
    const cacheResult = await Statistics.getCachedResult(uri);

    if (cacheResult?.statisticsJsonString) {
      return JSON.parse(cacheResult.statisticsJsonString);
    } else {
      const issuedTonsCount = await Statistics.getUnitTableTonsCo2Count(
        null,
        dateRangeStart,
        dateRangeEnd,
      );
      const authorizedTonsCount = await Statistics.getUnitTableTonsCo2Count(
        'Authorized',
        dateRangeStart,
        dateRangeEnd,
      );
      const ndcTonsCount =
        await Statistics.getProjectAttributeBasedTonsCo2Count({
          coveredByNDC: 'Inside NDC',
          dateRangeStart,
          dateRangeEnd,
        });

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

  static async getRetiredBufferTonsCo2(dateRangeStart, dateRangeEnd) {
    await Statistics.removeStaleTableEntries();

    const uri =
      dateRangeStart && dateRangeEnd
        ? `/statistics/tonsCo2?set=retiredBuffer&dateRangeStart=${dateRangeStart}&dateRangeEnd=${dateRangeEnd}`
        : `/statistics/tonsCo2?set=retiredBuffer`;
    const cacheResult = await Statistics.getCachedResult(uri);

    if (cacheResult?.statisticsJsonString) {
      return JSON.parse(cacheResult.statisticsJsonString);
    } else {
      const retiredTonsCount = await Statistics.getUnitTableTonsCo2Count(
        'Retired',
        dateRangeStart,
        dateRangeEnd,
      );
      const bufferTonsCount = await Statistics.getUnitTableTonsCo2Count(
        'Buffer',
        dateRangeStart,
        dateRangeEnd,
      );

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

  static async getTonsCo2ByMethodology(
    methodologies,
    dateRangeStart,
    dateRangeEnd,
  ) {
    await Statistics.removeStaleTableEntries();

    let uri = '';
    if (dateRangeStart && dateRangeEnd && methodologies) {
      uri = `/statistics/issuedCarbonByMethodology?methodologies=${methodologies}dateRangeStart=${dateRangeStart}&dateRangeEnd=${dateRangeEnd}`;
    } else if (dateRangeStart && dateRangeEnd) {
      uri = `/statistics/issuedCarbonByMethodology?methodologies=${methodologies}`;
    } else {
      uri = `/statistics/issuedCarbonByMethodology`;
    }
    const cacheResult = await Statistics.getCachedResult(uri);

    if (cacheResult?.statisticsJsonString) {
      return JSON.parse(cacheResult.statisticsJsonString);
    } else {
      let result = {};

      if (methodologies) {
        for (const methodology of methodologies) {
          result[methodology] =
            await Statistics.getProjectAttributeBasedTonsCo2Count({
              methodology,
              dateRangeStart,
              dateRangeEnd,
            });
        }
      } else {
        result = await Statistics.getAllMethodologyTonsCo2Count();
      }

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
