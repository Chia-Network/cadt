'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';

import { Project } from '../projects';

class RelatedProject extends Model {
  static associate() {
    RelatedProject.belongsTo(Project);
  }
}

RelatedProject.init(
  {
    id: {
      type: Sequelize.NUMBER,
      primaryKey: true,
    },
    relatedProjectType: Sequelize.STRING,
    registry: Sequelize.STRING,
    note: Sequelize.STRING,
    owner: Sequelize.STRING,
    projectId: Sequelize.NUMBER,
    createdAt: Sequelize.DATE,
    updatedAt: Sequelize.DATE,
  },
  {
    sequelize,
    modelName: 'RelatedProjects',
  },
);

export { RelatedProject };
