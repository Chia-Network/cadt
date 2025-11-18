'use strict';

import _ from 'lodash';
import { Sequelize, Model } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';
import csv from 'csvtojson';
import xlsx from 'node-xlsx';
import { sequelizeV2 } from '../../database/v2/index.js';
import StagingV2 from './staging-v2.model.js';
import OrganizationsV2 from './organizations-v2.model.js';
import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
  transformMetaUid,
  tableDataFromXlsx,
  collapseTablesData,
} from '../../utils/xls.js';
import { getDeletedItems } from '../../utils/model-utils.js';
import { UnitLabelV2 } from './unit-label-v2.model.js';
import { logger } from '../../config/logger.js';

class UnitV2 extends Model {
  static associate(models) {
    // Unit belongs to Issuance
    UnitV2.belongsTo(models.IssuanceV2, {
      foreignKey: 'cadTrustIssuanceId',
      as: 'issuance',
    });

    // Unit has many UnitLabels (many-to-many with Label)
    UnitV2.hasMany(models.UnitLabelV2, {
      foreignKey: 'cadTrustUnitId',
      as: 'unitLabels',
    });
  }

  /**
   * Returns associated models for UnitV2
   * Used by getDeletedItems to identify child records
   * @returns {Array} Array of associated model objects
   */
  static getAssociatedModels = () => [{ model: UnitLabelV2, pluralize: true }];

  /**
   * Generates changelist from staged data for UnitV2 model
   * @param {Array} stagedData - Array of staging records
   * @param {string} comment - Comment for the commit
   * @param {string} author - Author of the commit
   * @param {string} registryId - Registry store ID (passed in for performance)
   * @param {boolean} isUpdateComment - Whether comment already exists in datalayer
   * @param {boolean} isUpdateAuthor - Whether author already exists in datalayer
   * @returns {Object} Changelist object with unit and child table changes
   */
  static async generateChangeListFromStagedData(
    stagedData,
    comment,
    author,
    registryId,
    isUpdateComment,
    isUpdateAuthor,
  ) {
    // PERFORMANCE: Early exit if no staged records for this model
    const hasStagedData = stagedData.some(
      (record) => record.table === 'unit',
    );
    if (!hasStagedData) {
      return {
        unit: [],
        unit_label: [],
      };
    }

    const [insertRecords, updateRecords, deleteChangeList] =
      StagingV2.seperateStagingDataIntoActionGroups(stagedData, 'unit');

    const primaryKeyMap = {
      unit: 'cad_trust_unit_id',
      unit_label: 'id', // Join table uses 'id' as primary key (virtual field)
    };

    // PERFORMANCE: Only call getDeletedItems() if UPDATE records exist
    const deletedRecords =
      updateRecords.length > 0
        ? await getDeletedItems(
            updateRecords,
            primaryKeyMap,
            UnitV2,
            'unit',
          )
        : [];

    // Convert records to Excel format (only if records exist)
    const insertXslsSheets =
      insertRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: insertRecords,
            model: UnitV2,
            toStructuredCsv: true,
          })
        : null;

    const updateXslsSheets =
      updateRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: updateRecords,
            model: UnitV2,
            toStructuredCsv: true,
          })
        : null;

    const deleteXslsSheets =
      deletedRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: deletedRecords,
            model: UnitV2,
            toStructuredCsv: true,
          })
        : null;

    // Convert Excel to changelist (only if Excel sheets were created)
    const insertChangeList = insertXslsSheets
      ? await transformFullXslsToChangeList(
          insertXslsSheets,
          'insert',
          primaryKeyMap,
        )
      : {};

    const updateChangeList = updateXslsSheets
      ? await transformFullXslsToChangeList(
          updateXslsSheets,
          'update',
          primaryKeyMap,
        )
      : {};

    const deletedAssociationsChangeList = deleteXslsSheets
      ? await transformFullXslsToChangeList(
          deleteXslsSheets,
          'delete',
          primaryKeyMap,
        )
      : {};

    return {
      unit: [
        ..._.get(insertChangeList, 'unit', []),
        ..._.get(updateChangeList, 'unit', []),
        ...deleteChangeList,
      ],
      unit_label: [
        ..._.get(insertChangeList, 'unit_label', []),
        ..._.get(updateChangeList, 'unit_label', []),
        ..._.get(deletedAssociationsChangeList, 'unit_label', []),
      ],
    };
  }

  /**
   * Split a unit into multiple units
   * @param {string} unitId - The cadTrustUnitId of the unit to split
   * @param {Array} records - Array of split records with unitCount, unitBlockStart, unitBlockEnd, etc.
   * @returns {Promise<void>}
   * @throws {Error} If unit doesn't exist, doesn't belong to home org, or split count doesn't match
   */
  static async split(unitId, records) {
    try {
      // Get original unit
      const originalRecord = await UnitV2.findByPk(unitId);
      if (!originalRecord) {
        throw new Error(`Unit with cadTrustUnitId ${unitId} does not exist`);
      }

      // Verify it belongs to home org
      const homeOrg = await OrganizationsV2.getHomeOrg();
      if (!homeOrg) {
        throw new Error('No home organization found');
      }

      let totalSplitCount = 0;

      // Create split records
      const splitRecords = await Promise.all(
        records.map(async (record, index) => {
          const newRecord = originalRecord.toJSON();

          // First record keeps original ID, others get new UUIDs
          if (index > 0) {
            newRecord.cadTrustUnitId = uuidv4();
          }

          // Update unit count and blocks
          newRecord.unitCount = record.unitCount;
          totalSplitCount += parseFloat(record.unitCount) || 0;

          // Handle both camelCase field names (unitBlockStart/unitBlockEnd from API)
          // and snake_case (unit_start_block/unit_end_block from database)
          const blockStart = record.unitBlockStart || record.unit_start_block;
          const blockEnd = record.unitBlockEnd || record.unit_end_block;

          if (blockStart && blockEnd) {
            newRecord.unitSerialId = `${blockStart}-${blockEnd}`;
            newRecord.unitStartBlock = blockStart;
            newRecord.unitEndBlock = blockEnd;
          }

          // Update optional fields if provided
          if (record.unitCurrentOwner !== undefined) {
            newRecord.unitCurrentOwner = record.unitCurrentOwner;
          }
          if (record.unitStatus !== undefined) {
            newRecord.unitStatus = record.unitStatus;
          }
          if (record.unitStatusReason !== undefined) {
            newRecord.unitStatusReason = record.unitStatusReason;
          }
          if (record.unitStatusDate !== undefined) {
            newRecord.unitStatusDate = record.unitStatusDate;
          }

          // Remove timestamps (handled automatically)
          delete newRecord.createdAt;
          delete newRecord.updatedAt;

          return newRecord;
        }),
      );

      // Validate total split count matches original
      const originalCount = parseFloat(originalRecord.unitCount) || 0;
      if (Math.abs(totalSplitCount - originalCount) > 0.0001) {
        throw new Error(
          `Total split count (${totalSplitCount}) does not match original unit count (${originalCount})`,
        );
      }

      // Create staging record with UPDATE action
      const stagedData = {
        uuid: unitId,
        action: 'UPDATE',
        table: 'unit',
        data: JSON.stringify(splitRecords),
      };

      await StagingV2.create(stagedData);

      logger.info(`Unit ${unitId} split into ${splitRecords.length} units`);
    } catch (error) {
      logger.error('Error splitting unit:', error);
      throw new Error(`Failed to split unit: ${error.message}`);
    }
  }

  /**
   * Update units from XLSX file
   * @param {Buffer} fileBuffer - XLSX file buffer
   * @returns {Promise<void>}
   * @throws {Error} If XLSX parsing or staging fails
   */
  static async updateFromXLS(fileBuffer) {
    try {
      // Parse XLSX file
      const xlsxParsed = transformMetaUid(xlsx.parse(fileBuffer));

      // Extract table data from XLSX
      const stagedDataItems = tableDataFromXlsx(xlsxParsed, UnitV2);

      // Collapse table data
      const collapsedData = collapseTablesData(stagedDataItems, UnitV2);

      // Update table with data (creates staging records)
      await UnitV2.updateTableWithDataV2(collapsedData);

      logger.info('Units updated from XLSX file');
    } catch (error) {
      logger.error('Error updating units from XLSX:', error);
      throw new Error(`Failed to update units from XLSX: ${error.message}`);
    }
  }

  /**
   * Batch upload units from CSV file
   * Parses CSV and creates staging records
   * @param {Object} csvFile - CSV file object with data buffer
   * @returns {Promise<void>}
   * @throws {Error} If CSV parsing or staging fails
   */
  static async batchUpload(csvFile) {
    const buffer = csvFile.data;
    const stream = Readable.from(buffer.toString('utf8'));

    const recordsToCreate = [];

    return new Promise((resolve, reject) => {
      csv()
        .fromStream(stream)
        .subscribe(async (newRecord) => {
          let action = 'UPDATE';

          // Convert camelCase to snake_case for V2
          const unitId = newRecord.cadTrustUnitId || newRecord.cad_trust_unit_id;

          if (unitId) {
            // Check if unit exists
            const possibleExistingRecord = await UnitV2.findByPk(unitId);

            if (!possibleExistingRecord) {
              reject(
                new Error(
                  `Unit with cadTrustUnitId ${unitId} does not exist`,
                ),
              );
              return;
            }

            // Verify it belongs to home org (for updates)
            const homeOrg = await OrganizationsV2.getHomeOrg();
            if (!homeOrg) {
              reject(new Error('No home organization found'));
              return;
            }
          } else {
            // New unit - generate UUID
            newRecord.cadTrustUnitId = uuidv4();
            const homeOrg = await OrganizationsV2.getHomeOrg();
            if (!homeOrg) {
              reject(new Error('No home organization found'));
              return;
            }
            action = 'INSERT';
          }

          // Update unit properties (handle serial ID from blocks)
          if (newRecord.unitStartBlock && newRecord.unitEndBlock) {
            newRecord.unitSerialId = `${newRecord.unitStartBlock}-${newRecord.unitEndBlock}`;
          }

          const stagedData = {
            uuid: newRecord.cadTrustUnitId,
            action: action,
            table: 'unit',
            data: JSON.stringify([newRecord]),
          };

          recordsToCreate.push(stagedData);
        })
        .on('error', (error) => {
          reject(error);
        })
        .on('done', async () => {
          if (recordsToCreate.length) {
            await StagingV2.bulkCreate(recordsToCreate, {
              logging: (msg) => logger.info(msg),
            });

            resolve();
          } else {
            reject(new Error('There were no valid records to parse'));
          }
        });
    });
  }

  /**
   * V2-compatible version of updateTableWithData
   * Creates staging records for XLSX imports
   * @param {Object} tableData - Collapsed table data from XLSX
   * @returns {Promise<void>}
   */
  static async updateTableWithDataV2(tableData) {
    const modelAssociations = UnitV2.getAssociatedModels();

    const removeModelKeyInChildren = [
      'unitLabels',
    ];

    // Use V2 transaction
    await sequelizeV2.transaction(async () => {
      const homeOrg = await OrganizationsV2.getHomeOrg();
      if (!homeOrg) {
        throw new Error('No home organization found');
      }

      await Promise.all(
        Object.values(tableData).map(async (data) => {
          // Skip if data structure is invalid
          if (
            !data ||
            data.data == null ||
            data.model == null ||
            !Array.isArray(data.data)
          ) {
            return;
          }

          await Promise.all(
            data.data
              .filter((row) => !_.isEmpty(row))
              .map(async (row) => {
                // Convert camelCase to snake_case for V2 primary key
                const primaryKeyField = 'cadTrustUnitId';
                const existingRecord = await UnitV2.findByPk(
                  row[primaryKeyField],
                );

                const exists = Boolean(existingRecord);

                // Handle child records
                await UnitV2.updateModelChildIdsV2(
                  modelAssociations,
                  row,
                  removeModelKeyInChildren,
                  UnitV2,
                  false,
                );

                // Update unit properties (handle serial ID from blocks)
                if (row.unitStartBlock && row.unitEndBlock) {
                  row.unitSerialId = `${row.unitStartBlock}-${row.unitEndBlock}`;
                }

                // Merge with existing record if it exists
                let stagedRecord = Array.isArray(row) ? row : [row];
                stagedRecord = stagedRecord.map((record) => {
                  return Object.keys(record).reduce((syncedRecord, key) => {
                    syncedRecord[key] = record[key];
                    return syncedRecord;
                  }, existingRecord?.dataValues ?? {});
                });

                // Create staging record
                const stagedData = {
                  uuid: row[primaryKeyField],
                  action: exists ? 'UPDATE' : 'INSERT',
                  table: 'unit',
                  data: JSON.stringify(stagedRecord),
                };

                await StagingV2.create(stagedData);
              }),
          );
        }),
      );
    });
  }

  /**
   * Helper to update child record IDs (V2 version)
   * @private
   */
  static async updateModelChildIdsV2(
    modelAssociations,
    row,
    removeModelKeyInChildren,
    model,
    setKey,
  ) {
    // Map model names to association keys (camelCase)
    const modelToKeyMap = {
      UnitLabelV2: 'unitLabels',
    };

    // Map model names to primary key fields
    const modelToPrimaryKeyMap = {
      UnitLabelV2: 'cadTrustUnitLabelId',
    };

    modelAssociations.forEach((association) => {
      const modelName = association.model.name;
      const childKey = modelToKeyMap[modelName];
      const primaryKeyField = modelToPrimaryKeyMap[modelName];

      if (childKey && row[childKey] && Array.isArray(row[childKey])) {
        row[childKey].forEach((child) => {
          if (setKey) {
            // Set the unit ID on child records
            if (!child.cadTrustUnitId && row.cadTrustUnitId) {
              child.cadTrustUnitId = row.cadTrustUnitId;
            }
          } else {
            // Remove or update child record IDs
            if (removeModelKeyInChildren.includes(childKey)) {
              // Generate ID if missing
              if (!child[primaryKeyField]) {
                child[primaryKeyField] = uuidv4();
              }
            }
          }
        });
      }
    });
  }
}

UnitV2.init(
  {
    cadTrustUnitId: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      unique: true,
      field: 'cad_trust_unit_id',
    },
    unitSerialId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'unit_serial_id',
    },
    unitStartBlock: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'unit_start_block',
    },
    unitEndBlock: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'unit_end_block',
    },
    unitCount: {
      type: Sequelize.DECIMAL,
      allowNull: true,
      field: 'unit_count',
    },
    unitType: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'unit_type',
    },
    unitVintageYear: {
      type: Sequelize.INTEGER,
      allowNull: false,
      field: 'unit_vintage_year',
    },
    unitStatus: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'unit_status',
    },
    unitStatusReason: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'unit_status_reason',
    },
    unitStatusDate: {
      type: Sequelize.DATEONLY,
      allowNull: true,
      field: 'unit_status_date',
    },
    unitRetirementDetail: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'unit_retirement_detail',
    },
    unitRetirementBeneficiary: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'unit_retirement_beneficiary',
    },
    unitRetirementBeneficiaryId: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'unit_retirement_beneficiary_id',
    },
    unitLink: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'unit_link',
    },
    unitMetric: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'unit_metric',
    },
    unitCurrentOwner: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'unit_current_owner',
    },
    unitItmosReferenceId: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'unit_itmos_reference_id',
    },
    cadTrustIssuanceId: {
      type: Sequelize.STRING(36),
      allowNull: false,
      field: 'cad_trust_issuance_id',
    },
  },
  {
    sequelize: sequelizeV2,
    modelName: 'UnitV2',
    tableName: 'unit',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { UnitV2 };
