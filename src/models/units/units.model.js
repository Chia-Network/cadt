'use strict';

import Sequelize from 'sequelize';
import { sequelize } from '../database';
import {CoBenefit, ProjectLocation, Qualification, RelatedProject, Vintage} from '../../models';
import ModelTypes from './units.modeltypes.cjs';
import rxjs from 'rxjs';

const { Model } = Sequelize;

const virtualColumns = {
  unitBlockStart: {
    type: Sequelize.VIRTUAL,
    get() {
      const rawValue = this.getDataValue('serialNumberBlock');
      return rawValue.split('-')[0];
    },
    set(value) {
      throw new Error('Do not try to set the `unitBlockStart` value!');
    },
  },
  unitBlockEnd: {
    type: Sequelize.VIRTUAL,
    get() {
      const rawValue = this.getDataValue('serialNumberBlock');
      return rawValue.split('-')[1];
    },
  },
  unitCount: {
    type: Sequelize.VIRTUAL,
    get() {
      const rawValue = this.getDataValue('serialNumberBlock');
      const blocks = rawValue.split('-');
      const blockStart = Number(blocks[0].split(/(\d+)/)[1]);
      const blockEnd = Number(blocks[1].split(/(\d+)/)[1]);
      return blockEnd - blockStart;
    },
  },
};

class Unit extends Model {
  static changes = new rxjs.Subject();
  static defaultColumns = Object.keys(
    Object.assign({}, ModelTypes, virtualColumns),
  );

  static associate() {
    Unit.hasOne(Vintage);

    // https://gist.github.com/elliette/20ddc4e827efd9d62bc98752e7a62610#some-important-addendums
    Unit.belongsToMany(Qualification, {
      through: 'qualification_unit',
      as: 'qualifications',
    });
  }

  static async create(values, options) {
    const createResult = await super.create(values, options);
    const { orgUid } = createResult;

    Unit.changes.next(['units', orgUid]);

    return createResult;
  }

  static async destroy(values) {
    const record = await super.findOne(values.where);
    const { orgUid } = record.dataValues;

    Unit.changes.next(['units', orgUid]);

    return super.destroy(values);
  }
  
  static async fts(searchStr, orgUid, pagination, columns = []) {
    const dialect = sequelize.getDialect();
    
    const handlerMap = {
      sqlite: Unit.findAllSqliteFts,
      mysql: Unit.findAllMySQLFts,
    };
    
    return handlerMap[dialect](
      searchStr,
      orgUid,
      pagination,
      columns
        .filter((col) => ![
          'createdAt',
          'updatedAt',
          'unitBlockStart',
          'unitBlockEnd',
          'unitCount'].includes(col))
    );
  }
  
  static async findAllMySQLFts(searchStr, orgUid, pagination, columns = []) {
    const { offset, limit } = pagination;
    
    let fields = '*';
    if (columns.length) {
      fields = columns.join(', ');
    }
    
    let sql = `
    SELECT ${fields} FROM units WHERE MATCH (
        unitOwnerOrgUid,
        countryJuridictionOfOwner,
        inCountryJuridictionOfOwner,
        serialNumberBlock,
        unitIdentifier,
        unitType,
        intendedBuyerOrgUid,
        marketplace,
        tags,
        unitStatus,
        unitTransactionType,
        unitStatusReason,
        tokenIssuanceHash,
        marketplaceIdentifier,
        unitsIssuanceLocation,
        unitRegistryLink,
        unitMarketplaceLink,
        cooresponingAdjustmentDeclaration,
        correspondingAdjustmentStatus
    ) AGAINST ":search"
    `;
    
    if (orgUid) {
      sql = `${sql} AND orgUid = :orgUid`;
    }
    
    const replacements = { search: searchStr, orgUid };
    
    const count = (
      await sequelize.query(sql, {
        model: Unit,
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
        model: Unit,
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
    
    let sql = `SELECT ${fields} FROM units_fts WHERE units_fts MATCH :search`;
    
    if (orgUid) {
      sql = `${sql} AND orgUid = :orgUid`;
    }
    
    const replacements = { search: `${searchStr}*`, orgUid };
    
    const count = (
      await sequelize.query(sql, {
        model: Unit,
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
        model: Unit,
        mapToModel: true, // pass true here if you have any mapped fields
        replacements: { ...replacements, ...{ offset, limit } },
      }),
    };
  }
}

Unit.init(Object.assign({}, ModelTypes, virtualColumns), {
  sequelize,
  modelName: 'unit',
  foreignKey: 'unitId',
});

export { Unit };
