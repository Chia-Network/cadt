'use strict';
import Sequelize from 'sequelize';
import rxjs from 'rxjs';

const { Model } = Sequelize;

import { sequelize } from '../database';

import { RelatedProject } from './../related-projects';
import { Vintage } from './../vintages';
import { Qualification } from './../qualifications';
import { ProjectLocation } from './../locations';
import { Rating } from './../ratings';
import { CoBenefit } from './../co-benefits';

import ModelTypes from './projects.modeltypes.cjs';
import { optionallyPaginatedResponse } from '../../controllers/helpers.js';

class Project extends Model {
  static changes = new rxjs.Subject();

  static associate() {
    Project.hasMany(RelatedProject);
    Project.hasMany(Vintage);
    Project.hasMany(Qualification);
    Project.hasMany(Rating);
    Project.hasMany(CoBenefit);
    Project.hasMany(ProjectLocation);
  }

  static async create(values, options) {
    const createResult = await super.create(values, options);

    const { orgUid } = values;

    Project.changes.next(['projects', orgUid]);

    return createResult;
  }

  static async destroy(values) {
    const { id: projectId } = values.where;
    const { orgUid } = await super.findOne(projectId);

    const destroyResult = await super.destroy(values);

    Project.changes.next(['projects', orgUid]);

    return destroyResult;
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

    const replacements = { search: searchStr, orgUid };

    const count = (
      await sequelize.query(sql, {
        model: Project,
        mapToModel: true, // pass true here if you have any mapped fields
        replacements,
      })
    ).length;

    if (limit && offset) {
      sql = `${sql} ORDER BY relevance DESC LIMIT :limit OFFSET :offset`;
    }

    return {
      count,
      rows: await sequelize.query(sql, {
        model: Project,
        replacements: { ...replacements, ...{ offset, limit } },
        mapToModel: true, // pass true here if you have any mapped fields
        offset,
        limit,
      }),
    };
  }

  static async findAllSqliteFts(searchStr, orgUid, pagination) {
    const { offset, limit } = pagination;

    searchStr = searchStr = searchStr.replaceAll('-', '+');

    let sql = `SELECT * FROM projects_fts WHERE projects_fts MATCH :search`;

    if (orgUid) {
      sql = `${sql} AND orgUid = :orgUid`;
    }

    const replacements = { search: `${searchStr}*`, orgUid };

    const count = (
      await sequelize.query(sql, {
        model: Project,
        mapToModel: true, // pass true here if you have any mapped fields
        replacements,
      })
    ).length;

    if (limit && offset) {
      sql = `${sql} ORDER BY rank DESC LIMIT :limit OFFSET :offset`;
    }

    return {
      count,
      rows: await sequelize.query(sql, {
        model: Project,
        mapToModel: true, // pass true here if you have any mapped fields
        replacements: { ...replacements, ...{ offset, limit } },
      }),
    };
  }
}

Project.init(ModelTypes, {
  sequelize,
  modelName: 'project',
  foreignKey: 'projectId',
});

export { Project };
