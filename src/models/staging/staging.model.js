'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { Project, Unit } from '../../models';

import rxjs from 'rxjs';
import { sequelize } from '../database';

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

  static seperateStagingDataIntoActionGroups = (stagedData, table) => {
    const insertRecords = [];
    const updateRecords = [];
    const deleteChangeList = [];

    stagedData
      .filter((stagingRecord) => stagingRecord.table === table)
      .forEach((stagingRecord) => {
        if (stagingRecord.action === 'INSERT') {
          insertRecords.push(...JSON.parse(stagingRecord.data));
        } else if (stagingRecord.action === 'UPDATE') {
          updateRecords.push(...JSON.parse(stagingRecord.data));
        } else if (stagingRecord.action === 'DELETE') {
          deleteChangeList.push({
            action: 'delete',
            key: Buffer.from(stagingRecord.uuid).toString('hex'),
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

    console.log(unifiedChangeList);
  }
}

Staging.init(ModelTypes, {
  sequelize,
  modelName: 'staging',
  freezeTableName: true,
});

export { Staging };
