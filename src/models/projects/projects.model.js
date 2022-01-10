'use strict';
import Sequelize from 'sequelize';
import rxjs from 'rxjs';
const { Model } = Sequelize;

import { sequelize } from '../database';

import { RelatedProject } from './../related-projects';
import { Vintage } from './../vintages';
import { Qualification } from './../qualifications';
import { ProjectLocation } from './../locations';
import { CoBenefit } from './../co-benefits';

import ModelTypes from './projects.modeltypes.cjs';

class Project extends Model {
  static changes = new rxjs.Subject();
  static defaultColumns = Object.keys(ModelTypes);

  static associate() {
    Project.hasMany(ProjectLocation);
    Project.hasMany(Qualification);
    Project.hasMany(Vintage);
    Project.hasMany(CoBenefit);
    Project.hasMany(RelatedProject);
  }

  static async create(values, options) {
    const createResult = await super.create(values, options);

    const { orgUid } = values;

    Project.changes.next(['projects', orgUid]);

    return createResult;
  }

  static async destroy(values) {
    const record = await super.findOne(values.where);
    const { orgUid } = record.dataValues;

    Project.changes.next(['projects', orgUid]);

    return super.destroy(values);
  }

  static async fts(searchStr, orgUid, pagination, columns = []) {
    const dialect = sequelize.getDialect();

    const handlerMap = {
      sqlite: Project.findAllSqliteFts,
      mysql: Project.findAllMySQLFts,
    };

    return handlerMap[dialect](
      searchStr,
      orgUid,
      pagination,
      columns
        .filter((col) => !['createdAt', 'updatedAt'].includes(col))
        .filter(
          (col) =>
            ![
              ProjectLocation,
              Qualification,
              Vintage,
              CoBenefit,
              RelatedProject,
            ]
              .map((model) => model.name + 's')
              .includes(col),
        ),
    );
  }

  static async findAllMySQLFts(searchStr, orgUid, pagination, columns = []) {
    const { offset, limit } = pagination;

    let fields = '*';
    if (columns.length) {
      fields = columns.join(', ');
    }

    let sql = `
    SELECT ${fields} FROM projects WHERE MATCH (
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

  static async findAllSqliteFts(searchStr, orgUid, pagination, columns = []) {
    const { offset, limit } = pagination;

    let fields = '*';
    if (columns.length) {
      fields = columns.join(', ');
    }

    searchStr = searchStr = searchStr.replaceAll('-', '+');

    let sql = `SELECT ${fields} FROM projects_fts WHERE projects_fts MATCH :search`;

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
