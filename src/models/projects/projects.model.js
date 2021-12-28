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
import { optionallyPaginatedResponse } from "../../controllers/helpers.js";

class Project extends Model {
  static associate() {
    Project.hasMany(RelatedProject);
    Project.hasMany(Vintage);
    Project.hasMany(Qualification);
    Project.hasMany(Rating);
    Project.hasMany(CoBenefit);
    Project.hasMany(ProjectLocation);
  }

  static async findAllMySQLFts(searchStr, orgUid, pagination) {
    const { offset, limit } = pagination;
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

    sql = `${sql} ORDER BY relevance DESC LIMIT :limit OFFSET :offset`;

    const count = await Project.count()

    return {
      count,
      rows: await sequelize.query(sql, {
        model: Project,
        replacements: { search: searchStr, orgUid },
        mapToModel: true, // pass true here if you have any mapped fields
        offset,
        limit,
      })
    };
  }

  static findAllSqliteFts(searchStr, orgUid, pagination ) {
    const { offset, limit } = pagination;
    let sql = `SELECT * FROM projects_fts WHERE projects_fts MATCH :search`;

    if (orgUid) {
      sql = `${sql} AND orgUid = :orgUid`;
    }

    sql = `${sql} ORDER BY rank DESC LIMIT :limit OFFSET :offset`;

    return sequelize.query(sql, {
      model: Project,
      replacements: { search: `${searchStr}*`, orgUid },
      mapToModel: true, // pass true here if you have any mapped fields
      offset,
      limit,
    });
  }
}

Project.init(ModelTypes, {
  sequelize,
  modelName: 'project',
  foreignKey: 'projectId',
});

export { Project };
