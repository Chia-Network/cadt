'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';
import { Project } from '../projects';

import ModelTypes from './projects.modeltypes.cjs';

class ProjectLocation extends Model {
  static associate() {
    ProjectLocation.hasMany(Project);
  }
}

ProjectLocation.init(ModelTypes, {
  sequelize,
  modelName: 'projectLocation',
});

export { ProjectLocation };
