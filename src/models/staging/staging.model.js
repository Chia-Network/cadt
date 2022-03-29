'use strict';

import _ from 'lodash';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { Project, Unit, Organization, Issuance } from '../../models';
import { encodeHex } from '../../utils/datalayer-utils';

import * as rxjs from 'rxjs';
import { sequelize } from '../../database';

import datalayer from '../../datalayer';

import ModelTypes from './staging.modeltypes.cjs';
import { formatModelAssociationName } from '../../utils/model-utils.js';

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

  static async pushToDataLayer(tableToPush) {
    let stagedRecords;
    if (tableToPush) {
      stagedRecords = await Staging.findAll({
        where: { table: tableToPush },
        raw: true,
      });
    } else {
      stagedRecords = await Staging.findAll({ raw: true });
    }

    const unitsChangeList = await Unit.generateChangeListFromStagedData(
      stagedRecords,
    );

    const projectsChangeList = await Project.generateChangeListFromStagedData(
      stagedRecords,
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
