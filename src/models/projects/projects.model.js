'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';

import { RelatedProject } from './../related-projects';
import { Vintage } from './../vintages';
import { Qualification } from './../qualifications';
import { ProjectLocation } from './../locations';
import { Rating } from './../ratings';
import { CoBenefit } from './../co-benefits';

class Project extends Model {
  static associate() {
    Project.hasMany(RelatedProject);
    Project.hasMany(Vintage);
    Project.hasMany(Qualification);
    Project.hasMany(Rating);
    Project.hasMany(CoBenefit);
    Project.hasMany(ProjectLocation);
  }
}

Project.init(
  {
    id: {
      type: Sequelize.NUMBER,
      primaryKey: true,
    },
    uuid: Sequelize.STRING,
    currentRegistry: Sequelize.STRING,
    registryOfOrigin: Sequelize.STRING,
    originProjectId: Sequelize.NUMBER,
    program: Sequelize.STRING,
    warehouseProjectId: Sequelize.NUMBER,
    projectName: Sequelize.STRING,
    projectLink: Sequelize.STRING,
    projectDeveloper: Sequelize.STRING,
    sector: Sequelize.STRING,
    projectType: Sequelize.STRING,
    coveredByNDC: Sequelize.STRING,
    NDCLinkage: Sequelize.STRING,
    projectStatus: Sequelize.STRING,
    projectStatusDate: Sequelize.DATE,
    unitMetric: Sequelize.STRING,
    methodology: Sequelize.STRING,
    methodologyVersion: Sequelize.STRING,
    validationApproach: Sequelize.STRING,
    validationDate: Sequelize.DATE,
    projectTag: Sequelize.STRING,
    estimatedAnnualAverageEmmisionReduction: Sequelize.STRING,
    owner: Sequelize.STRING,
    createdAt: Sequelize.DATE,
    updatedAt: Sequelize.DATE,
  },
  { sequelize, modelName: 'Projects', foreignKey: 'projectId' },
);

export { Project };
