'use strict';

import _ from 'lodash';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../../database';
import { encodeHex } from '../../utils/datalayer-utils';
import { ModelKeys, Staging } from '../index';

import ModelTypes from './simulator.modeltypes.cjs';
import { uuid as uuidv4 } from 'uuidv4';

class Simulator extends Model {
  /**
   * Generate Simulated Key-Value Differences (kvDiffs) from Staging Table.
   *
   * This function serves to simulate the kvDiffs generated from the data layer.
   * It reads all records from the Staging table and produces kvDiffs for each record,
   * transforming the Staging table into a form that resembles the data layer output.
   *
   * The kvDiffs are used to track changes (INSERT, DELETE, UPDATE) to the underlying data model.
   *
   * For each record in the Staging table:
   *
   * 1. If the action is 'DELETE' or 'UPDATE', a kvDiff with type 'DELETE' is created for the existing record.
   * 2. If the action is 'INSERT' or 'UPDATE', a kvDiff with type 'INSERT' is created for the new record(s).
   *
   * For 'UPDATE' actions, the function first generates kvDiffs for 'DELETE' using existing records,
   * and then kvDiffs for 'INSERT' using the new records. This effectively breaks down an 'UPDATE'
   * into a 'DELETE' followed by an 'INSERT'.
   *
   * @returns {Array<Object>} An array of kvDiff objects.
   * @throws Will throw an error if the corresponding model for the table doesn't exist or if other database operations fail.
   */
  static async getMockedKvDiffFromStagingTable() {
    const data = await Staging.findAll();
    const diff = [];

    for (const staging of data) {
      const lowerTable = staging.table.toLowerCase();
      const modelKey = ModelKeys[lowerTable];
      const array = [];

      if (staging.action === 'DELETE' || staging.action === 'UPDATE') {
        const existingData = await modelKey.findOne({
          where: { [modelKey.primaryKeyAttributes[0]]: staging.uuid },
          raw: true,
        });
        if (existingData) {
          array.push({
            key: encodeHex(`${lowerTable}|${staging.uuid}`),
            value: encodeHex(JSON.stringify(existingData)),
            type: 'DELETE',
          });

          const arrayKeys = Object.keys(existingData).filter((key) =>
            Array.isArray(existingData[key]),
          );

          for (const key of arrayKeys) {
            for (const obj of existingData[key]) {
              array.push({
                key: encodeHex(`${key}|${staging.uuid}`),
                value: encodeHex(JSON.stringify(obj)),
                type: 'DELETE',
              });
            }
          }
        }
      }

      if (staging.action === 'INSERT' || staging.action === 'UPDATE') {
        const parsedDataArray = JSON.parse(staging?.data ?? []);
        for (const parsedData of parsedDataArray) {
          if (!parsedData) continue;

          const issuanceUuid = uuidv4();
          const issuance = parsedData.issuance
            ? _.cloneDeep(parsedData.issuance)
            : null;

          if (staging.table.toLowerCase() === 'units' && issuance) {
            parsedData.issuanceId = issuanceUuid;
            issuance.id = issuanceUuid;
          }

          array.push({
            key: encodeHex(`${lowerTable}|${staging.uuid}`),
            value: encodeHex(JSON.stringify(parsedData)),
            type: 'INSERT',
          });

          const arrayKeys = Object.keys(parsedData).filter((key) =>
            Array.isArray(parsedData[key]),
          );

          if (staging.table.toLowerCase() === 'units' && Boolean(issuance)) {
            arrayKeys.push('issuances');
          }

          for (const key of arrayKeys) {
            if (key === 'issuances' && Boolean(issuance)) {
              array.push({
                key: encodeHex(`${key}|${staging.uuid}`),
                value: encodeHex(JSON.stringify(issuance ?? {})),
                type: 'INSERT',
              });
            } else {
              for (const obj of parsedData[key]) {
                array.push({
                  key: encodeHex(`${key}|${staging.uuid}`),
                  value: encodeHex(JSON.stringify(obj)),
                  type: 'INSERT',
                });

                if (key === 'labels' && obj.label_unit) {
                  array.push({
                    key: encodeHex(`label_unit|${staging.uuid}`),
                    value: encodeHex(JSON.stringify(obj.label_unit)),
                    type: 'INSERT',
                  });
                }
              }
            }
          }
        }
      }

      diff.push(array);
    }

    return _.flatten(diff);
  }
}

Simulator.init(ModelTypes, {
  sequelize,
  modelName: 'simulator',
  freezeTableName: true,
  timestamps: false,
  createdAt: false,
  updatedAt: false,
});

export { Simulator };
