'use strict';

import _ from 'lodash';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { Project, Unit, Organization } from '../../models';

import rxjs from 'rxjs';
import { sequelize } from '../database';

import { pushDataLayerChangeList } from '../../fullnode';

import ModelTypes from './staging.modeltypes.cjs';

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

  static getDiffObject = async (uuid, table, action, data) => {
    const diff = {};
    if (action === 'INSERT') {
      diff.original = {};
      diff.change = JSON.parse(data);
    }

    if (action === 'UPDATE') {
      let original;
      if (table === 'Projects') {
        original = await Project.findOne({
          where: { warehouseProjectId: uuid },
          include: Project.getAssociatedModels(),
        });
      }

      if (table === 'Units') {
        original = await Unit.findOne({
          where: { warehouseUnitId: uuid },
          include: Unit.getAssociatedModels(),
        });
      }

      diff.original = original;
      diff.change = JSON.parse(data);
    }

    if (action === 'DELETE') {
      let original;
      if (table === 'Projects') {
        original = await Project.findOne({
          where: { warehouseProjectId: uuid },
        });
      }

      if (table === 'Units') {
        original = await Unit.findOne({
          where: { warehouseUnitId: uuid },
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
            key: Buffer.from(`${tablePrefix}_${stagingRecord.uuid}`).toString(
              'hex',
            ),
          });
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
            key: Buffer.from(`${tablePrefix}_${stagingRecord.uuid}`).toString(
              'hex',
            ),
          });
        }
      });

    return [insertRecords, updateRecords, deleteChangeList];
  };

  static async pushToDataLayer() {
    const stagedRecords = await Staging.findAll({ raw: true });
    const unitsChangeList =
      Unit.generateChangeListFromStagedData(stagedRecords);

    const projectsChangeList =
      Project.generateChangeListFromStagedData(stagedRecords);

    const unifiedChangeList = {
      ...projectsChangeList,
      ...unitsChangeList,
      vintages: [...unitsChangeList.vintages, ...projectsChangeList.vintages],
      qualifications: [
        ...unitsChangeList.qualifications,
        ...projectsChangeList.qualifications,
      ],
    };

    const myOrganization = await Organization.findOne({
      where: { isHome: true },
      raw: true,
    });

    await pushDataLayerChangeList(
      myOrganization.registryId,
      // sort so that deletes are first and inserts second
      _.sortBy(_.flatten(_.values(unifiedChangeList)), 'action'),
    );
  }
}

Staging.init(ModelTypes, {
  sequelize,
  modelName: 'staging',
  freezeTableName: true,
});

export { Staging };
