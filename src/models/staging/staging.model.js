'use strict';

import _ from 'lodash';
import Sequelize from 'sequelize';
const Op = Sequelize.Op;

const { Model } = Sequelize;
import { Project, Unit, Organization, Issuance } from '../../models';
import { encodeHex, generateOffer } from '../../utils/datalayer-utils';

import * as rxjs from 'rxjs';
import { sequelize } from '../../database';

import datalayer from '../../datalayer';
import { makeOffer } from '../../datalayer/persistance';

import ModelTypes from './staging.modeltypes.cjs';
import { formatModelAssociationName } from '../../utils/model-utils.js';

import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls';

class Staging extends Model {
  static changes = new rxjs.Subject();

  static async create(values, options) {
    Staging.changes.next(['staging']);
    return super.create(values, options);
  }

  static async destroy(values) {
    Staging.changes.next(['staging']);
    return super.destroy(values);
  }

  static async upsert(values, options) {
    Staging.changes.next(['staging']);
    return super.upsert(values, options);
  }

  static generateOfferFile = async () => {
    const stagingRecord = await Staging.findOne({
      // where: { isTransfer: true },
      where: { commited: false },
      raw: true,
    });

    const makerProjectRecord = _.head(JSON.parse(stagingRecord.data));

    const myOrganization = await Organization.findOne({
      where: { isHome: true },
      raw: true,
    });

    const taker = { inclusions: [] };
    const maker = { inclusions: [] };

    // The record still has the orgUid of the takerProjectRecord,
    // we will update this to the correct orgUId later
    taker.storeId = makerProjectRecord.orgUid;
    maker.storeId = myOrganization.orgUid;

    const takerProjectRecord = await Project.findOne({
      where: { warehouseProjectId: makerProjectRecord.warehouseProjectId },
      include: Project.getAssociatedModels().map((association) => {
        return {
          model: association.model,
          as: formatModelAssociationName(association),
        };
      }),
    });

    takerProjectRecord.projectStatus = 'Transitioned';

    const issuanceIds = takerProjectRecord.issuances.reduce((ids, issuance) => {
      if (!ids.includes(issuance.id)) {
        ids.push(issuance.id);
      }
      return ids;
    }, []);

    let unitTakerRecords = await Unit.findAll({
      where: {
        issuanceId: { [Op.in]: issuanceIds },
      },
      raw: true,
    });

    // Takers get an unlatered copy of all the project units from the maker
    const unitMakerRecords = _.cloneDeep(unitTakerRecords);

    unitTakerRecords = unitTakerRecords.map((record) => {
      record.unitStatus = 'Exported';
      return record;
    });

    const primaryProjectKeyMap = {
      project: 'warehouseProjectId',
      projectLocations: 'id',
      labels: 'id',
      issuances: 'id',
      coBenefits: 'id',
      relatedProjects: 'id',
      estimations: 'id',
      projectRatings: 'id',
    };

    const primaryUnitKeyMap = {
      unit: 'warehouseUnitId',
      labels: 'id',
      label_units: 'id',
      issuances: 'id',
    };

    const takerProjectXslsSheets = createXlsFromSequelizeResults({
      rows: [takerProjectRecord],
      model: Project,
      toStructuredCsv: true,
    });

    const makerProjectXslsSheets = createXlsFromSequelizeResults({
      rows: [makerProjectRecord],
      model: Project,
      toStructuredCsv: true,
    });

    const takerUnitXslsSheets = createXlsFromSequelizeResults({
      rows: unitTakerRecords,
      model: Unit,
      toStructuredCsv: true,
    });

    const makerUnitXslsSheets = createXlsFromSequelizeResults({
      rows: unitMakerRecords,
      model: Unit,
      toStructuredCsv: true,
    });

    const makerProjectInclusions = await transformFullXslsToChangeList(
      makerProjectXslsSheets,
      'insert',
      primaryProjectKeyMap,
    );

    const takerProjectInclusions = await transformFullXslsToChangeList(
      takerProjectXslsSheets,
      'insert',
      primaryProjectKeyMap,
    );

    const takerUnitInclusions = await transformFullXslsToChangeList(
      takerUnitXslsSheets,
      'insert',
      primaryUnitKeyMap,
    );

    const makerUnitInclusions = await transformFullXslsToChangeList(
      makerUnitXslsSheets,
      'insert',
      primaryUnitKeyMap,
    );

    /* Object.keys(maker.inclusions).forEach((table) => {
      maker.inclusions[table] = maker.inclusions[table]
        .filter((inclusion) => inclusion.action !== 'delete')
        .map((inclusion) => ({ key: inclusion.key, value: inclusion.value }));
    });*/

    taker.inclusions.push(
      ...takerProjectInclusions.project
        .filter((inclusion) => inclusion.action !== 'delete')
        .map((inclusion) => ({
          key: inclusion.key,
          value: inclusion.value,
        })),
    );

    if (takerUnitInclusions?.unit) {
      taker.inclusions.push(
        ...takerUnitInclusions.unit
          .filter((inclusion) => inclusion.action !== 'delete')
          .map((inclusion) => ({
            key: inclusion.key,
            value: inclusion.value,
          })),
      );
    }

    maker.inclusions.push(
      ...makerProjectInclusions.project
        .filter((inclusion) => inclusion.action !== 'delete')
        .map((inclusion) => ({
          key: inclusion.key,
          value: inclusion.value,
        })),
    );

    if (makerUnitInclusions?.unit) {
      maker.inclusions.push(
        ...makerUnitInclusions.unit
          .filter((inclusion) => inclusion.action !== 'delete')
          .map((inclusion) => ({
            key: inclusion.key,
            value: inclusion.value,
          })),
      );
    }

    const offer = generateOffer(maker, taker);
    return makeOffer(offer);
  };

  // If the record was commited but the diff.original is null
  // that means that the original record no longer exists and
  // the staging record should be cleaned up.
  static cleanUpCommitedAndInvalidRecords = async () => {
    const stagingRecords = await Staging.findAll({ raw: true });

    const stagingRecordsToDelete = await Promise.all(
      stagingRecords.filter(async (record) => {
        if (record.commited === 1) {
          const { uuid, table, action, data } = record;
          const diff = await Staging.getDiffObject(uuid, table, action, data);
          return diff.original == null;
        }
        return false;
      }),
    );

    await Staging.destroy({
      where: { uuid: stagingRecordsToDelete.map((record) => record.uuid) },
    });
  };

  static getDiffObject = async (uuid, table, action, data) => {
    const diff = {};
    if (action === 'INSERT') {
      diff.original = {};
      diff.change = JSON.parse(data);
    }

    if (action === 'UPDATE') {
      diff.change = JSON.parse(data);

      let original;

      if (table === 'Projects') {
        original = await Project.findOne({
          where: { warehouseProjectId: uuid },
          include: Project.getAssociatedModels().map((association) => {
            return {
              model: association.model,
              as: formatModelAssociationName(association),
            };
          }),
        });

        // Show the issuance data if its being reused
        // this is just for view purposes onlys
        await Promise.all(
          diff.change.map(async (record) => {
            if (record.issuanceId) {
              const issuance = await Issuance.findOne({
                where: { id: record.issuanceId },
              });

              record.issuance = issuance.dataValues;
            }
          }),
        );
      } else if (table === 'Units') {
        original = await Unit.findOne({
          where: { warehouseUnitId: uuid },
          include: Unit.getAssociatedModels().map((association) => {
            return {
              model: association.model,
              as: formatModelAssociationName(association),
            };
          }),
        });

        // Show the issuance data if its being reused,
        // this is just for view purposes onlys
        await Promise.all(
          diff.change.map(async (record) => {
            if (record.issuanceId) {
              const issuance = await Issuance.findOne({
                where: { id: record.issuanceId },
              });

              record.issuance = issuance.dataValues;
            }
          }),
        );
      }

      diff.original = original;
    }

    if (action === 'DELETE') {
      let original;

      if (table === 'Projects') {
        original = await Project.findOne({
          where: { warehouseProjectId: uuid },
          include: Project.getAssociatedModels().map((association) => {
            return {
              model: association.model,
              as: formatModelAssociationName(association),
            };
          }),
        });
      } else if (table === 'Units') {
        original = await Unit.findOne({
          where: { warehouseUnitId: uuid },
          include: Unit.getAssociatedModels().map((association) => {
            return {
              model: association.model,
              as: formatModelAssociationName(association),
            };
          }),
        });
      }

      diff.original = original;
      diff.change = {};
    }

    return diff;
  };

  static seperateStagingDataIntoActionGroups = (stagedData, table) => {
    const insertRecords = [];
    const updateRecords = [];
    const deleteChangeList = [];

    stagedData
      .filter((stagingRecord) => stagingRecord.table === table)
      .forEach((stagingRecord) => {
        // TODO: Think of a better place to mark the records as commited
        Staging.update(
          { commited: true },
          { where: { uuid: stagingRecord.uuid } },
        );
        if (stagingRecord.action === 'INSERT') {
          insertRecords.push(...JSON.parse(stagingRecord.data));
        } else if (stagingRecord.action === 'UPDATE') {
          let tablePrefix = table.toLowerCase();
          // hacky fix to account for the units and projects table not
          // being lowercase and plural in the xsls transformation
          if (tablePrefix === 'units' || tablePrefix === 'projects') {
            tablePrefix = tablePrefix.replace(/s\s*$/, '');
          }

          deleteChangeList.push({
            action: 'delete',
            key: encodeHex(`${tablePrefix}|${stagingRecord.uuid}`),
          });

          // TODO: Child table records are getting orphaned in the datalayer,
          // because we need to generate a delete action for each one

          updateRecords.push(...JSON.parse(stagingRecord.data));
        } else if (stagingRecord.action === 'DELETE') {
          let tablePrefix = table.toLowerCase();

          // hacky fix to account for the units and projects table not
          // being lowercase and plural in the xsls transformation
          if (tablePrefix === 'units' || tablePrefix === 'projects') {
            tablePrefix = tablePrefix.replace(/s\s*$/, '');
          }

          deleteChangeList.push({
            action: 'delete',
            key: encodeHex(`${tablePrefix}|${stagingRecord.uuid}`),
          });

          // TODO: Child table records are getting orphaned in the datalayer,
          // because we need to generate a delete action for each one
        }
      });

    return [insertRecords, updateRecords, deleteChangeList];
  };

  static async pushToDataLayer(tableToPush, comment, author, ids = []) {
    let stagedRecords;

    if (tableToPush) {
      stagedRecords = await Staging.findAll({
        where: {
          commited: false,
          table: tableToPush,
          ...(ids.length
            ? {
                uuid: {
                  [Sequelize.Op.in]: ids,
                },
              }
            : {}),
        },
        raw: true,
      });
    } else {
      stagedRecords = await Staging.findAll({
        where: {
          commited: false,
          ...(ids.length
            ? {
                uuid: {
                  [Sequelize.Op.in]: ids,
                },
              }
            : {}),
        },
        raw: true,
      });
    }

    if (!stagedRecords.length) {
      throw new Error('No records to send to datalayer');
    }

    const unitsChangeList = await Unit.generateChangeListFromStagedData(
      stagedRecords,
      comment,
      author,
    );

    const projectsChangeList = await Project.generateChangeListFromStagedData(
      stagedRecords,
      comment,
      author,
    );

    const unifiedChangeList = {
      ...projectsChangeList,
      ...unitsChangeList,
      issuances: [
        ...unitsChangeList.issuances,
        ...projectsChangeList.issuances,
      ],
      labels: [...unitsChangeList.labels, ...projectsChangeList.labels],
    };

    const myOrganization = await Organization.findOne({
      where: { isHome: true },
      raw: true,
    });

    // sort so that deletes are first and inserts second
    const finalChangeList = _.uniqBy(
      _.sortBy(_.flatten(_.values(unifiedChangeList)), 'action'),
      (v) => [v.action, v.key].join(),
    );

    await datalayer.pushDataLayerChangeList(
      myOrganization.registryId,
      finalChangeList,
      async () => {
        // The push failed so revert the commited staging records.
        await Staging.update(
          { failedCommit: true },
          { where: { commited: true } },
        );
      },
    );
  }
}

Staging.init(ModelTypes, {
  sequelize,
  modelName: 'staging',
  freezeTableName: true,
  timestamps: true,
});

export { Staging };
