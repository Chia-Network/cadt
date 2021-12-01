'use strict';
import Sequelize from 'sequelize';
const { DataTypes, Model } = Sequelize;
import { sequelize } from '../database';

class Qualification extends Model { }

Qualification.init({
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV1,
    primaryKey: true,
  },
  project_id: DataTypes.STRING,
  qualification_type: DataTypes.STRING,
  label: DataTypes.STRING,
  crediting_start_date: DataTypes.STRING,
  crediting_end_date: DataTypes.STRING,
  validity_start_date: DataTypes.STRING,
  validity_end_date: DataTypes.STRING,
  unit_quality: DataTypes.STRING,
  qualification_link: DataTypes.STRING,
}, { sequelize, modelName: 'qualification' });

export { Qualification };
