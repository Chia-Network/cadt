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
    warehouseProjectId: Sequelize.STRING,
    projectID: Sequelize.STRING,
    currentRegistry: Sequelize.STRING,
    registryOfOrigin: Sequelize.STRING,
    originProjectId: Sequelize.STRING,
    program: Sequelize.STRING,
    projectName: Sequelize.STRING,
    projectLink: Sequelize.STRING,
    projectDeveloper: Sequelize.STRING,
    sector: Sequelize.STRING,
    projectType: Sequelize.STRING,
    coveredByNDC: Sequelize.INTEGER,
    NDCLinkage: Sequelize.STRING,
    projectStatus: Sequelize.STRING,
    projectStatusDate: Sequelize.DATE,
    unitMetric: Sequelize.STRING,
    methodology: Sequelize.STRING,
    methodologyVersion: Sequelize.NUMBER,
    validationApproach: Sequelize.STRING,
    validationDate: Sequelize.DATE,
    projectTag: Sequelize.STRING,
    estimatedAnnualAverageEmissionReduction: Sequelize.STRING,
    owner: Sequelize.STRING,
    createdAt: Sequelize.DATE,
    updatedAt: Sequelize.DATE,
  },
  { sequelize, modelName: 'Projects', foreignKey: 'projectId' },
);

export { Project };
