'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';

import ModelTypes from './projects.modeltypes.cjs';

import { Project } from '../projects';

class RelatedProject extends Model {
  static associate() {
    RelatedProject.belongsTo(Project);
  }
}

RelatedProject.init(ModelTypes, {
  sequelize,
  modelName: 'relatedProject',
});

export { RelatedProject };
