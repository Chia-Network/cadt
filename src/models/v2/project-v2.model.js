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
import { keyValueToChangeList } from '../../utils/datalayer-utils.js';
import { LocationV2 } from './location-v2.model.js';
import { EstimationV2 } from './estimation-v2.model.js';
import { RatingV2 } from './rating-v2.model.js';
import { CoBenefitV2 } from './co-benefit-v2.model.js';

class ProjectV2 extends Model {
  static associate(models) {
    // Project belongs to Program
    ProjectV2.belongsTo(models.ProgramV2, {
      foreignKey: 'cadTrustProgramId',
      as: 'program',
    });

    // Project has many Locations
    ProjectV2.hasMany(models.LocationV2, {
      foreignKey: 'cadTrustProjectId',
      as: 'locations',
    });

    // Project has many Estimations
    ProjectV2.hasMany(models.EstimationV2, {
      foreignKey: 'cadTrustProjectId',
      as: 'estimations',
    });

    // Project has many Ratings
    ProjectV2.hasMany(models.RatingV2, {
      foreignKey: 'cadTrustProjectId',
      as: 'ratings',
    });

    // Project has many CoBenefits
    ProjectV2.hasMany(models.CoBenefitV2, {
      foreignKey: 'cadTrustProjectId',
      as: 'coBenefits',
    });

    // Note: Other associations will be added when those models are implemented
    // - Project has many Validations
    // - Project has many Verifications
  }

  /**
   * Returns associated models for ProjectV2
   * Used by getDeletedItems to identify child records
   * @returns {Array} Array of associated model objects
   */
  static getAssociatedModels = () => [
    { model: LocationV2, pluralize: true },
    { model: EstimationV2, pluralize: true },
    { model: RatingV2, pluralize: true },
    { model: CoBenefitV2, pluralize: true },
  ];

  /**
   * Generates changelist from staged data for ProjectV2 model
   * @param {Array} stagedData - Array of staging records
   * @param {string} comment - Comment for the commit
   * @param {string} author - Author of the commit
   * @param {string} registryId - Registry store ID (passed in for performance)
   * @param {boolean} isUpdateComment - Whether comment already exists in datalayer
   * @param {boolean} isUpdateAuthor - Whether author already exists in datalayer
   * @returns {Object} Changelist object with project and child table changes
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
      (record) => record.table === 'project',
    );
    if (!hasStagedData) {
      return {
        project: [],
        location: [],
        estimation: [],
        rating: [],
        co_benefit: [],
      };
    }

    const [insertRecords, updateRecords, deleteChangeList] =
      StagingV2.seperateStagingDataIntoActionGroups(stagedData, 'project');

    const primaryKeyMap = {
      project: 'cad_trust_project_id',
      location: 'cad_trust_location_id',
      estimation: 'cad_trust_estimation_id',
      rating: 'cad_trust_rating_id',
      co_benefit: 'cad_trust_co_benefit_id',
    };

    // PERFORMANCE: Only call getDeletedItems() if UPDATE records exist
    const deletedRecords =
      updateRecords.length > 0
        ? await getDeletedItems(
            updateRecords,
            primaryKeyMap,
            ProjectV2,
            'project',
          )
        : [];

    // Convert records to Excel format (only if records exist)
    const insertXslsSheets =
      insertRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: insertRecords,
            model: ProjectV2,
            toStructuredCsv: true,
          })
        : null;

    const updateXslsSheets =
      updateRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: updateRecords,
            model: ProjectV2,
            toStructuredCsv: true,
          })
        : null;

    const deleteXslsSheets =
      deletedRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: deletedRecords,
            model: ProjectV2,
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

    // PERFORMANCE: Use passed-in metadata instead of fetching
    // Generate comment and author changelist (only from first model that processes it)
    const commentChangeList = keyValueToChangeList(
      'comment',
      `{"comment": "${comment}"}`,
      isUpdateComment,
    );

    const authorChangeList = keyValueToChangeList(
      'author',
      `{"author": "${author}"}`,
      isUpdateAuthor,
    );

    return {
      project: [
        ..._.get(insertChangeList, 'project', []),
        ..._.get(updateChangeList, 'project', []),
        ...deleteChangeList,
      ],
      location: [
        ..._.get(insertChangeList, 'location', []),
        ..._.get(updateChangeList, 'location', []),
        ..._.get(deletedAssociationsChangeList, 'location', []),
      ],
      estimation: [
        ..._.get(insertChangeList, 'estimation', []),
        ..._.get(updateChangeList, 'estimation', []),
        ..._.get(deletedAssociationsChangeList, 'estimation', []),
      ],
      rating: [
        ..._.get(insertChangeList, 'rating', []),
        ..._.get(updateChangeList, 'rating', []),
        ..._.get(deletedAssociationsChangeList, 'rating', []),
      ],
      co_benefit: [
        ..._.get(insertChangeList, 'co_benefit', []),
        ..._.get(updateChangeList, 'co_benefit', []),
        ..._.get(deletedAssociationsChangeList, 'co_benefit', []),
      ],
      comment: commentChangeList,
      author: authorChangeList,
    };
  }
}

ProjectV2.init(
  {
    cadTrustProjectId: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      unique: true,
      field: 'cad_trust_project_id',
    },
    projectRegistryName: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'project_registry_name',
    },
    projectId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'project_id',
    },
    projectCreditingProgram: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'project_crediting_program',
    },
    projectName: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'project_name',
    },
    projectLink: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'project_link',
    },
    projectDescription: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'project_description',
    },
    projectSector: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'project_sector',
    },
    projectType: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'project_type',
    },
    projectSubtype: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'project_subtype',
    },
    projectStatus: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'project_status',
    },
    projectStatusDate: {
      type: Sequelize.DATEONLY,
      allowNull: true,
      field: 'project_status_date',
    },
    projectUnitMetric: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'project_unit_metric',
    },
    cadTrustReferenceProjectId: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'cad_trust_reference_project_id',
    },
    cadTrustProgramId: {
      type: Sequelize.STRING(36),
      allowNull: true,
      field: 'cad_trust_program_id',
    },
  },
  {
    sequelize: sequelizeV2,
    modelName: 'ProjectV2',
    tableName: 'project',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { ProjectV2 };
