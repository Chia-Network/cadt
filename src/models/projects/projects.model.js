'use strict';
import Sequelize from 'sequelize';
const { DataTypes, Model } = Sequelize;
import { sequelize } from '../database';

class Project extends Model {}

Project.init(
  {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV1,
      primaryKey: true,
    },
    id_origin: DataTypes.STRING,
    warehouse_project_id: DataTypes.STRING,
    registry_current: DataTypes.STRING,
    registry_origin: DataTypes.STRING,
    name: DataTypes.STRING,
    link: DataTypes.STRING,
    developer: DataTypes.STRING,
    sector: DataTypes.STRING,
    type: DataTypes.STRING,
    ndc_covered: DataTypes.BOOLEAN,
    ndc_linkage: DataTypes.STRING,
    status: DataTypes.STRING,
    status_date: DataTypes.STRING,
    unit_metric: DataTypes.STRING,
    methodology: DataTypes.STRING,
    methodology_version: DataTypes.STRING,
    validation_approach: DataTypes.STRING,
    validation_date: DataTypes.STRING,
    estimated_annual_average_emission_reduction: DataTypes.STRING,
  },
  { sequelize, modelName: 'project' },
);

export { Project };
