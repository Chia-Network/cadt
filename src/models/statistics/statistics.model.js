'use strict';

import { fuzzyStringMatch } from '../../utils/string-utils.js';

const { Model } = Sequelize;
import { Unit } from '../units/index.js';
import Sequelize from 'sequelize';
import { sequelize } from '../../database';
import ModelTypes from './statistics.modeltypes.cjs';
import { Project } from '../projects/index.js';
import { Organization } from '../organizations/index.js';
import { Issuance } from '../issuances/index.js';
import _ from 'lodash';

class Statistics extends Model {
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

  static async getProjectStatusCounts() {
    await Statistics.removeStaleTableEntries();

    const uri = `/statistics/projects?counts=true`;
    const cacheResult = await Statistics.getCachedResult(uri);

    if (cacheResult?.statisticsJsonString) {
      return JSON.parse(cacheResult.statisticsJsonString);
    } else {
      const homeOrg = await Organization.getHomeOrg();

      const allStatusResults = await Project.findAll({
        attributes: [
          [
            sequelize.fn('DISTINCT', sequelize.col('projectStatus')),
            'projectStatus',
          ],
        ],
        raw: true,
      });

      const countResult = await Project.findAll({
        attributes: [
          'projectStatus',
          [Sequelize.fn('COUNT', Sequelize.col('projectStatus')), 'count'],
        ],
        where: {
          orgUid: homeOrg.orgUid,
        },
        group: 'projectStatus',
        raw: true,
      });

      const projectCounts = countResult.reduce((acc, curr) => {
        acc[curr.projectStatus] = curr.count;
        return acc;
      }, {});

      allStatusResults.forEach((status) => {
        if (projectCounts?.[status.projectStatus]) {
          status.count = projectCounts[status.projectStatus];
        } else {
          status.count = 0;
        }
      });

      await Statistics.create({
        uri,
        statisticsJsonString: JSON.stringify(allStatusResults),
      });

      return allStatusResults;
    }
  }

  static async getProjectHostRegistryCounts() {
    await Statistics.removeStaleTableEntries();
    const uri = `/statistics/projects?hostRegistry=true`;
    const cacheResult = await Statistics.getCachedResult(uri);

    if (cacheResult?.statisticsJsonString) {
      return JSON.parse(cacheResult.statisticsJsonString);
    } else {
      const homeOrg = await Organization.getHomeOrg();

      const currentRegistries = await Project.findAll({
        where: {
          orgUid: homeOrg.orgUid,
        },
        attributes: ['currentRegistry'],
        raw: true,
      });

      const result = {
        selfHostedProjectCount: 0,
        externallyHostedProjectCount: 0,
      };

      currentRegistries.forEach(({ currentRegistry }) => {
        const { percentMatch } = fuzzyStringMatch(
          homeOrg.name,
          currentRegistry,
        );
        if (percentMatch > 70) {
          result.selfHostedProjectCount++;
        } else {
          result.externallyHostedProjectCount++;
        }
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
      uri += `&byUnitType=${unitTypeList}`;
    }

    const cacheResult = await Statistics.getCachedResult(uri);

    if (cacheResult?.statisticsJsonString) {
      return JSON.parse(cacheResult.statisticsJsonString);
    } else {
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
          unitType: {
            [Sequelize.Op.or]: unitTypeList,
          },
        });
      }

      if (vintageYearRangeStart && vintageYearRangeEnd) {
        andConditions.push({
          vintageYear: {
            [Sequelize.Op.between]: [
              vintageYearRangeStart,
              vintageYearRangeEnd,
            ],
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

      const result = await Unit.findAll({
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

      await Statistics.create({
        uri,
        statisticsJsonString: JSON.stringify(result),
      });

      return result;
    }
  }

  static async getTonsCo2ByMethodology(
    methodologies,
    vintageYearRangeStart,
    vintageYearRangeEnd,
  ) {
    await Statistics.removeStaleTableEntries();

    let uri = '';
    if (vintageYearRangeStart && vintageYearRangeEnd && methodologies) {
      uri = `/statistics/issuedCarbonByMethodology?methodologies=${methodologies}&vintageYearRangeStart=${vintageYearRangeStart}&vintageYearRangeEnd=${vintageYearRangeEnd}`;
    } else if (vintageYearRangeStart && vintageYearRangeEnd) {
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
          result[methodology] = await getProjectAttributeBasedTonsCo2Count({
            methodology,
            vintageYearRangeStart,
            vintageYearRangeEnd,
          });
        }
      } else {
        result = await getAllMethodologyTonsCo2Count(
          vintageYearRangeStart,
          vintageYearRangeEnd,
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
    vintageYearRangeStart,
    vintageYearRangeEnd,
  ) {
    await Statistics.removeStaleTableEntries();

    let uri = ``;
    if (vintageYearRangeStart && vintageYearRangeEnd && projectTypes) {
      uri = `/statistics/issuedCarbonByProjectType?projectTypes=${projectTypes}vintageYearRangeStart=${vintageYearRangeStart}&vintageYearRangeEnd=${vintageYearRangeEnd}`;
    } else if (vintageYearRangeStart && vintageYearRangeEnd) {
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
          result[projectType] = await getProjectAttributeBasedTonsCo2Count({
            projectType,
            vintageYearRangeStart,
            vintageYearRangeEnd,
          });
        }
      } else {
        result = await getAllProjectTypesTonsCo2Count(
          vintageYearRangeStart,
          vintageYearRangeEnd,
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

const getAllMethodologyTonsCo2Count = async (
  vintageYearRangeStart,
  vintageYearRangeEnd,
) => {
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

  if (vintageYearRangeStart && vintageYearRangeEnd) {
    methodologyCountQuery += ` AND u.vintageYear BETWEEN :vintageYearRangeStart AND :vintageYearRangeEnd `;
    methodologyCountQueryReplacements.vintageYearRangeStart =
      vintageYearRangeStart;
    methodologyCountQueryReplacements.vintageYearRangeEnd = vintageYearRangeEnd;
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
};

const getAllProjectTypesTonsCo2Count = async (
  vintageYearRangeStart,
  vintageYearRangeEnd,
) => {
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

  if (vintageYearRangeStart && vintageYearRangeEnd) {
    projectCountQuery += ` AND u.vintageYear BETWEEN :vintageYearRangeStart AND :vintageYearRangeEnd `;
    projectTypeCountQueryReplacements.vintageYearRangeStart =
      vintageYearRangeStart;
    projectTypeCountQueryReplacements.vintageYearRangeEnd = vintageYearRangeEnd;
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
};

const getProjectAttributeBasedTonsCo2Count = async (projectSelectors) => {
  const homeOrg = await Organization.getHomeOrg();
  const { vintageYearRangeStart, vintageYearRangeEnd, ...projectAttributes } =
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

  const andConditions = [
    {
      unitStatus: {
        [Sequelize.Op.not]: 'Cancelled',
      },
    },
    {
      issuanceId: {
        [Sequelize.Op.in]: issuanceIds,
      },
    },
  ];

  if (vintageYearRangeStart && vintageYearRangeEnd) {
    andConditions.push({
      vintageYear: {
        [Sequelize.Op.between]: [vintageYearRangeStart, vintageYearRangeEnd],
      },
    });
  }

  const [unitResult] = await Unit.findAll({
    where: {
      [Sequelize.Op.and]: andConditions,
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
};
