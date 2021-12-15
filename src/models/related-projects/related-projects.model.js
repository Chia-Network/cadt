'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';

import ModelTypes from './related-projects.modeltypes.cjs';

import { Project } from '../projects';

class RelatedProject extends Model {
  static associate() {
    RelatedProject.belongsTo(Project, {
      onDelete: 'CASCADE',
      foreignKey: {
        allowNull: false,
      },
    });
  }
}

RelatedProject.init(ModelTypes, {
  sequelize,
  modelName: 'relatedProject',
});

export { RelatedProject };
