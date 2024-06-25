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

  static async getProjectCount(projectStatus) {
    const homeOrg = await Organization.getHomeOrg();

    return await Project.count({
      where: {
        [Sequelize.Op.and]: {
          orgUid: homeOrg.orgUid,
          projectStatus,
        },
      },
    });
  }

  static async getUnitTableTonsCo2Count(
    unitStatusList,
    unitTypeList,
    vintageYearRangeStart,
    vintageYearRangeEnd,
  ) {
    const homeOrg = await Organization.getHomeOrg();
    const andConditions = [{ orgUid: homeOrg.orgUid }];

    if (
      unitStatusList &&
      !unitStatusList.find((status) => status?.toLowerCase() === 'all')
    ) {
      andConditions.push({
        unitStatus: {
          [Sequelize.Op.or]: unitStatusList,
        },
      });
    }

    if (
      unitTypeList &&
      !unitTypeList.find((status) => status?.toLowerCase() === 'all')
    ) {
      andConditions.push({
        unitStatus: {
          [Sequelize.Op.or]: unitTypeList,
        },
      });
    }

    if (vintageYearRangeStart && vintageYearRangeEnd) {
      andConditions.push({
        vintageYear: {
          [Sequelize.Op.between]: {
            vintageYearRangeStart,
            vintageYearRangeEnd,
          },
        },
      });
    }

    const attributes = [];

    if (unitStatusList) {
      attributes.push('unitStatus');
    }

    if (vintageYearRangeStart && vintageYearRangeEnd) {
      attributes.push('vintageYear');
    }

    if (unitTypeList) {
      attributes.push('unitType');
    }

    const queryResult = await Unit.findAll({
      where: {
        [Sequelize.Op.and]: andConditions,
      },
      attributes: [
        ...attributes,
        [
          sequelize.fn(
            'SUM',
            sequelize.fn(
              'IFNULL',
              sequelize.cast(sequelize.col('unitCount'), 'SIGNED'),
              0,
            ),
          ),
          'tonsCo2',
        ],
      ],
      group: attributes,
      raw: true,
    });

    return queryResult;
  }

  static async getAllMethodologyTonsCo2Count(dateRangeStart, dateRangeEnd) {
    const homeOrg = await Organization.getHomeOrg();

    let methodologyCountQuery = `
        WITH methodology_warehouse_projects AS (
            SELECT
                methodology,
                warehouseProjectId
            FROM
                projects
            WHERE
                orgUid = :orgUid
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
        WHERE u.unitStatus != "Cancelled"
    `;

    const methodologyCountQueryReplacements = {
      orgUid: homeOrg.orgUid,
    };

    if (dateRangeStart && dateRangeEnd) {
      methodologyCountQuery += ` AND u.createdAt BETWEEN :dateRangeStart AND :dateRangeEnd `;
      methodologyCountQueryReplacements.dateRangeStart = dateRangeStart;
      methodologyCountQueryReplacements.dateRangeEnd = dateRangeEnd;
    }

    methodologyCountQuery += ` GROUP BY mwp.methodology `;

    const [result] = await sequelize.query(methodologyCountQuery, {
      replacements: methodologyCountQueryReplacements,
    });

    const [allMethodologies] = await sequelize.query(
      `
        SELECT methodology
        FROM projects
        WHERE
            orgUid = :orgUid
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

  static async getAllProjectTypesTonsCo2Count(dateRangeStart, dateRangeEnd) {
    const homeOrg = await Organization.getHomeOrg();

    let projectCountQuery = `
        WITH project_type_warehouse_projects AS (
            SELECT
                projectType,
                warehouseProjectId
            FROM
                projects
            WHERE
                orgUid = :orgUid
            )

        SELECT
            ptwp.projectType,
            SUM(
                CASE
                    WHEN u.unitCount IS NULL THEN 0
                    WHEN u.unitCount GLOB '*[^0-9]*' THEN 0
                    ELSE CAST(u.unitCount AS INTEGER)
                END
            ) AS totalUnitCount
        FROM
            project_type_warehouse_projects ptwp
          JOIN
            issuances i ON ptwp.warehouseProjectId = i.warehouseProjectId
          JOIN
            units u ON u.issuanceId = i.id
        WHERE u.unitStatus != "Cancelled"
    `;

    const projectTypeCountQueryReplacements = {
      orgUid: homeOrg.orgUid,
    };

    if (dateRangeStart && dateRangeEnd) {
      projectCountQuery += ` AND u.createdAt BETWEEN :dateRangeStart AND :dateRangeEnd `;
      projectTypeCountQueryReplacements.dateRangeStart = dateRangeStart;
      projectTypeCountQueryReplacements.dateRangeEnd = dateRangeEnd;
    }

    projectCountQuery += ` GROUP BY ptwp.projectType `;

    const [result] = await sequelize.query(projectCountQuery, {
      replacements: projectTypeCountQueryReplacements,
    });

    const [allProjectTypes] = await sequelize.query(
      `
        SELECT projectType
        FROM projects
        WHERE
            orgUid = :orgUid
        GROUP BY projectType
    `,
      {
        replacements: {
          orgUid: homeOrg.orgUid,
        },
      },
    );

    const projectTypeTonsCo2Count = result.reduce((acc, obj) => {
      acc[obj.projectType] = obj.totalUnitCount;
      return acc;
    }, {});

    allProjectTypes.forEach((projectType) => {
      const count = projectTypeTonsCo2Count?.[projectType.projectType];
      projectType.tonsCo2 = count || 0;
    });

    return allProjectTypes;
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
          vintageYear: {
            [Sequelize.Op.between]: [dateRangeStart, dateRangeEnd],
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

  static async getProjectStatusCounts() {
    await Statistics.removeStaleTableEntries();

    const uri = `/statistics/projects?counts=true`;
    const cacheResult = await Statistics.getCachedResult(uri);

    if (cacheResult?.statisticsJsonString) {
      return JSON.parse(cacheResult.statisticsJsonString);
    } else {
      const registeredProjectsCount =
        await Statistics.getProjectCount('Registered');
      const authorizedProjectsCount =
        await Statistics.getProjectCount('Authorized');
      const completedProjectsCount =
        await Statistics.getProjectCount('Completed');

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

  static async getRehostedProjectCounts() {
    await Statistics.removeStaleTableEntries();
    const homeOrg = await Organization.getHomeOrg();
    const uri = `/statistics/projects?rehosted=true`;
    const cacheResult = await Statistics.getCachedResult(uri);

    if (cacheResult?.statisticsJsonString) {
      return JSON.parse(cacheResult.statisticsJsonString);
    } else {
      const query = `
        SELECT
          currentRegistry,
          SUM(CASE WHEN currentRegistry = registryOfOrigin THEN 1 ELSE 0 END) AS originProjectCount,
          SUM(CASE WHEN currentRegistry <> registryOfOrigin THEN 1 ELSE 0 END) AS rehostedProjectCount
        FROM
          Projects
        WHERE
          orgUid = :orgUid
        GROUP BY
          currentRegistry;
        `;

      const [result] = await sequelize.query(query, {
        replacements: {
          orgUid: homeOrg.orgUid,
        },
      });

      await Statistics.create({
        uri,
        statisticsJsonString: JSON.stringify(result),
      });

      return result;
    }
  }

  static async getTonsCo2(
    unitStatusList,
    unitTypeList,
    vintageYearRangeStart,
    vintageYearRangeEnd,
  ) {
    await Statistics.removeStaleTableEntries();

    let uri = `/statistics/tonsCo2`;

    if (vintageYearRangeStart && vintageYearRangeEnd) {
      uri += `?vintageYearRangeStart=${vintageYearRangeStart}&vintageYearRangeEnd=${vintageYearRangeEnd}`;
    }

    if (unitStatusList) {
      uri += `&unitStatusList=${unitStatusList}`;
    }

    if (unitTypeList) {
      uri += `&byUnitType=${unitStatusList}`;
    }

    const cacheResult = await Statistics.getCachedResult(uri);

    if (cacheResult?.statisticsJsonString) {
      return JSON.parse(cacheResult.statisticsJsonString);
    } else {
      const result = await Statistics.getUnitTableTonsCo2Count(
        unitStatusList,
        unitTypeList,
        vintageYearRangeStart,
        vintageYearRangeEnd,
      );
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
        result = await Statistics.getAllMethodologyTonsCo2Count(
          dateRangeStart,
          dateRangeEnd,
        );
      }

      await Statistics.create({
        uri,
        statisticsJsonString: JSON.stringify(result),
      });

      return result;
    }
  }

  static async getTonsCo2ByProjectType(
    projectTypes,
    dateRangeStart,
    dateRangeEnd,
  ) {
    await Statistics.removeStaleTableEntries();

    let uri = ``;
    if (dateRangeStart && dateRangeEnd && projectTypes) {
      uri = `/statistics/issuedCarbonByProjectType?projectTypes=${projectTypes}dateRangeStart=${dateRangeStart}&dateRangeEnd=${dateRangeEnd}`;
    } else if (dateRangeStart && dateRangeEnd) {
      uri = `/statistics/issuedCarbonByProjectType?projectTypes=${projectTypes}`;
    } else {
      uri = `/statistics/issuedCarbonByProjectType`;
    }
    const cacheResult = await Statistics.getCachedResult(uri);

    if (cacheResult?.statisticsJsonString) {
      return JSON.parse(cacheResult.statisticsJsonString);
    } else {
      let result = {};

      if (projectTypes) {
        for (const projectType of projectTypes) {
          result[projectType] =
            await Statistics.getProjectAttributeBasedTonsCo2Count({
              projectType: projectType,
              dateRangeStart,
              dateRangeEnd,
            });
        }
      } else {
        result = await Statistics.getAllProjectTypesTonsCo2Count(
          dateRangeStart,
          dateRangeEnd,
        );
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
