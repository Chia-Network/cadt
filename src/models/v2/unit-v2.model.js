'use strict';

import _ from 'lodash';
import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';
import StagingV2 from './staging-v2.model.js';
import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls.js';
import { getDeletedItems } from '../../utils/model-utils.js';
import { UnitLabelV2 } from './unit-label-v2.model.js';

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
