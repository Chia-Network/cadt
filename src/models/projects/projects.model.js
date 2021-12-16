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

import ModelTypes from './projects.modeltypes.cjs';

class Project extends Model {
  static associate() {
    Project.hasMany(RelatedProject);
    Project.hasMany(Vintage);
    Project.hasMany(Qualification);
    Project.hasMany(Rating);
    Project.hasMany(CoBenefit);
    Project.hasMany(ProjectLocation);
  }

  static findAllMySQLFts(queryStr) {
    const sql = `SELECT * FROM projects WHERE MATCH(
        warehouseProjectId, currentRegistry, registryOfOrigin, program, projectName,
        projectLink, projectDeveloper, sector, projectType, NDCLinkage, projectStatus,
        unitMetric, methodology, methodologyVersion, validationApproach, projectTag,
        estimatedAnnualAverageEmissionReduction, owner
    ) AGAINST ":search" ORDER BY relevance DESC`;

    return sequelize.query(sql, {
      model: Project,
      replacements: { search: queryStr },
      mapToModel: true, // pass true here if you have any mapped fields
    });
  }

  static findAllSqliteFts(queryStr) {
    const sql = `SELECT * FROM projects WHERE 
                    warehouseProjectId MATCH ":search" OR
                    currentRegistry MATCH ":search" OR
                    registryOfOrigin MATCH ":search" OR
                    program MATCH ":search" OR
                    projectName MATCH ":search" OR
                    projectLink MATCH ":search" OR
                    projectDeveloper MATCH ":search" OR
                    sector MATCH ":search" OR
                    projectType MATCH ":search" OR
                    NDCLinkage MATCH ":search" OR
                    projectStatus MATCH ":search" OR
                    unitMetric MATCH ":search" OR
                    methodology MATCH ":search" OR
                    methodologyVersion MATCH ":search" OR
                    validationApproach MATCH ":search" OR
                    projectTag MATCH ":search" OR
                    estimatedAnnualAverageEmissionReduction MATCH ":search" OR
                    ORDER BY rank DESC`;

    return sequelize.query(sql, {
      model: Project,
      replacements: { search: queryStr },
      mapToModel: true, // pass true here if you have any mapped fields
    });
  }
}

Project.init(ModelTypes, {
  sequelize,
  modelName: 'project',
  foreignKey: 'projectId',
});

export { Project };
