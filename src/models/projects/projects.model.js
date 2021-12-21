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

  static findAllMySQLFts(searchStr, orgUid) {
    let sql = `
    SELECT * FROM projects WHERE MATCH (
        warehouseProjectId,
        currentRegistry,
        registryOfOrigin,
        program,
        projectName,
        projectLink,
        projectDeveloper,
        sector,
        projectType,
        NDCLinkage,
        projectStatus,
        unitMetric,
        methodology,
        methodologyVersion,
        validationApproach,
        projectTag,
        estimatedAnnualAverageEmissionReduction
    ) AGAINST ":search"
    `;

    if (orgUid) {
      sql = `${sql} AND orgUid = :orgUid`;
    }

    sql = `${sql} ORDER BY relevance DESC`;

    return sequelize.query(sql, {
      model: Project,
      replacements: { search: searchStr, orgUid },
      mapToModel: true, // pass true here if you have any mapped fields
    });
  }

  static findAllSqliteFts(searchStr, orgUid) {
    let sql = `SELECT * FROM projects_fts WHERE projects_fts MATCH :search`;

    if (orgUid) {
      sql = `${sql} AND orgUid = :orgUid`;
    }

    sql = `${sql} ORDER BY rank DESC`;

    return sequelize.query(sql, {
      model: Project,
      replacements: { search: `${searchStr}*`, orgUid },
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
