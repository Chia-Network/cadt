'use strict';

import _ from 'lodash';
import { Sequelize, Model } from 'sequelize';
import { sequelizeV2, safeMirrorDbHandlerV2 } from '../../database/v2/index.js';
import { ProgramV2Mirror } from './program-v2.model.mirror.js';
import StagingV2 from './staging-v2.model.js';
import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls.js';

class ProgramV2 extends Model {
  static async create(values, options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await ProgramV2Mirror.create(values, mirrorOptions);
    });
    const result = await super.create(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async bulkCreate(values, options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await ProgramV2Mirror.bulkCreate(values, mirrorOptions);
    });
    const result = await super.bulkCreate(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async update(values, options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await ProgramV2Mirror.update(values, mirrorOptions);
    });
    const result = await super.update(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async upsert(values, options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await ProgramV2Mirror.upsert(values, mirrorOptions);
    });
    const result = await super.upsert(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async destroy(options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await ProgramV2Mirror.destroy(mirrorOptions);
    });
    const result = await super.destroy(options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static associate(models) {
    // Program has many Projects
    ProgramV2.hasMany(models.ProjectV2, {
      foreignKey: 'cadTrustProgramId',
      as: 'projects',
    });
  }

  /**
   * Generates changelist from staged data for ProgramV2 model
   * @param {Array} stagedData - Array of staging records
   * @param {string} comment - Comment for the commit
   * @param {string} author - Author of the commit
   * @param {string} registryId - Registry store ID (passed in for performance)
   * @param {boolean} isUpdateComment - Whether comment already exists in datalayer
   * @param {boolean} isUpdateAuthor - Whether author already exists in datalayer
   * @returns {Object} Changelist object with program changes
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
      (record) => record.table === 'program',
    );
    if (!hasStagedData) {
      return {
        program: [],
      };
    }

    const [insertRecords, updateRecords, deleteChangeList] =
      await StagingV2.seperateStagingDataIntoActionGroups(stagedData, 'program');

    const primaryKeyMap = {
      program: 'cad_trust_program_id',
    };

    // PERFORMANCE: Models without children skip getDeletedItems()
    // No child tables, so deletedRecords is always empty

    // Convert records to Excel format (only if records exist)
    const insertXslsSheets =
      insertRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: insertRecords,
            model: ProgramV2,
            toStructuredCsv: true,
          })
        : null;

    const updateXslsSheets =
      updateRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: updateRecords,
            model: ProgramV2,
            toStructuredCsv: true,
          })
        : null;

    // Map sheet names from model.name (e.g., "ProgramV2") to table name (e.g., "program")
    // This is needed because createXlsFromSequelizeResults uses model.name as the key,
    // but transformFullXslsToChangeList expects keys matching primaryKeyMap
    const mapSheetNames = (xslsSheets, modelName, tableName) => {
      if (!xslsSheets || !xslsSheets[modelName]) {
        return xslsSheets;
      }
      const mapped = { ...xslsSheets };
      mapped[tableName] = mapped[modelName];
      delete mapped[modelName];
      return mapped;
    };

    // Convert Excel to changelist (only if Excel sheets were created)
    // Pass V2 model map for checking existing records
    const modelMap = {
      program: ProgramV2,
    };

    const insertChangeList = insertXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(insertXslsSheets, ProgramV2.name, 'program'),
          'insert',
          primaryKeyMap,
          modelMap,
        )
      : {};

    const updateChangeList = updateXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(updateXslsSheets, ProgramV2.name, 'program'),
          'update',
          primaryKeyMap,
          modelMap,
        )
      : {};

    return {
      program: [
        ..._.get(insertChangeList, 'program', []),
        ..._.get(updateChangeList, 'program', []),
        ...deleteChangeList,
      ],
    };
  }
}

ProgramV2.init(
  {
    cadTrustProgramId: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      unique: true,
      field: 'cad_trust_program_id',
      defaultValue: Sequelize.UUIDV4,
    },
    programName: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'program_name',
    },
    programRegistry: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'program_registry',
    },
    programRegistryActivityId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'program_registry_activity_id',
    },
    programRegistryProgramId: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'program_registry_program_id',
    },
    programDescription: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'program_description',
    },
    orgUid: {
      type: Sequelize.STRING(64),
      allowNull: true,
      field: 'org_uid',
    },
  },
  {
    sequelize: sequelizeV2,
    modelName: 'ProgramV2',
    tableName: 'program',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { ProgramV2 };
