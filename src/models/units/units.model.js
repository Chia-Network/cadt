'use strict';

import _ from 'lodash';
import Sequelize from 'sequelize';
import * as rxjs from 'rxjs';
import {
  sequelize,
  safeMirrorDbHandler,
  sanitizeSqliteFtsQuery,
} from '../database';
import { Label, Issuance, Staging } from '../../models';
import { UnitMirror } from './units.model.mirror';
import ModelTypes from './units.modeltypes.cjs';

import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls';
import { unitsUpdateSchema } from '../../validations/index.js';
import { columnsToInclude } from '../../utils/helpers.js';

const { Model } = Sequelize;

const virtualFields = {
  unitBlockStart: {
    type: Sequelize.VIRTUAL,
    get() {
      const rawValue = this.getDataValue('serialNumberBlock');
      if (!rawValue) {
        return undefined;
      }
      return rawValue.split('-')[0];
    },
  },
  unitBlockEnd: {
    type: Sequelize.VIRTUAL,
    get() {
      const rawValue = this.getDataValue('serialNumberBlock');
      if (!rawValue) {
        return undefined;
      }
      return rawValue.split('-')[1];
    },
  },
  unitCount: {
    type: Sequelize.VIRTUAL,
    get() {
      const rawValue = this.getDataValue('serialNumberBlock');
      if (!rawValue) {
        return undefined;
      }
      const blocks = rawValue.split('-');
      const blockStart = Number(blocks[0].split(/(\d+)/)[1]);
      const blockEnd = Number(blocks[1].split(/(\d+)/)[1]);
      return blockEnd - blockStart;
    },
  },
};

class Unit extends Model {
  static stagingTableName = 'Units';
  static changes = new rxjs.Subject();
  static validateImport = unitsUpdateSchema;
  static virtualFieldList = virtualFields;

  static defaultColumns = Object.keys(
    Object.assign({}, ModelTypes, virtualFields),
  );

  static getAssociatedModels = () => [
    {
      model: Label,
      pluralize: true,
    },
    {
      model: Issuance,
      pluralize: false,
    },
  ];

  static associate() {
    Unit.belongsTo(Issuance, {
      sourceKey: 'issuanceId',
      foreignKey: 'issuanceId',
    });

    // https://gist.github.com/elliette/20ddc4e827efd9d62bc98752e7a62610#some-important-addendums
    Unit.belongsToMany(Label, {
      foreignKey: 'warehouseUnitId',
      through: 'label_unit',
      as: 'labels',
    });

    safeMirrorDbHandler(() => {
      UnitMirror.belongsTo(Issuance, {
        sourceKey: 'issuanceId',
        foreignKey: 'issuanceId',
      });

      // https://gist.github.com/elliette/20ddc4e827efd9d62bc98752e7a62610#some-important-addendums
      UnitMirror.belongsToMany(Label, {
        foreignKey: 'warehouseUnitId',
        through: 'label_unit',
        as: 'labels',
      });
    });
  }

  static async create(values, options) {
    safeMirrorDbHandler(() => UnitMirror.create(values, options));

    const createResult = await super.create(values, options);
    const { orgUid } = createResult;

    Unit.changes.next(['units', orgUid]);

    return createResult;
  }

  static async upsert(values, options) {
    safeMirrorDbHandler(() => UnitMirror.upsert(values, options));
    const upsertResult = await super.upsert(values, options);

    const { orgUid } = values;

    Unit.changes.next(['projects', orgUid]);

    return upsertResult;
  }

  static async destroy(values, options) {
    safeMirrorDbHandler(() => UnitMirror.destroy(values, options));

    const record = await super.findOne(values.where);

    if (record) {
      const { orgUid } = record.dataValues;
      Unit.changes.next(['units', orgUid]);
    }

    return super.destroy(values, options);
  }

  static async fts(searchStr, orgUid, pagination, columns = []) {
    const dialect = sequelize.getDialect();

    const handlerMap = {
      sqlite: Unit.findAllSqliteFts,
      mysql: Unit.findAllMySQLFts,
    };

    // Check if we need to include the virtual field dep
    for (const col of Object.keys(virtualFields)) {
      if (columns.includes(col)) {
        if (!columns.includes('serialNumberBlock')) {
          columns.push('serialNumberBlock');
        }
        break;
      }
    }

    return handlerMap[dialect](
      searchStr,
      orgUid,
      pagination,
      columns.filter(
        (col) =>
          ![
            'createdAt',
            'updatedAt',
            'unitBlockStart',
            'unitBlockEnd',
            'unitCount',
          ].includes(col),
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
    SELECT ${fields} FROM units WHERE MATCH (
        unitOwner,
        countryJurisdictionOfOwner,
        inCountryJurisdictionOfOwner,
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
        correspondingAdjustmentStatus,
        timeStaged
    ) AGAINST ':search' 
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

    searchStr = sanitizeSqliteFtsQuery(searchStr);

    if (searchStr === '*') {
      // * isn't a valid matcher on its own. return empty set
      return {
        count: 0,
        rows: [],
      };
    }

    if (searchStr.startsWith('+')) {
      searchStr = searchStr.replace('+', ''); // If query starts with +, replace it
    }

    let sql = `SELECT ${fields} FROM units_fts WHERE units_fts MATCH :search`;

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

  static async generateChangeListFromStagedData(stagedData) {
    const [insertRecords, updateRecords, deleteChangeList] =
      Staging.seperateStagingDataIntoActionGroups(stagedData, 'Units');

    const primaryKeyMap = {
      unit: 'warehouseUnitId',
      labels: 'id',
      label_units: 'id',
      issuances: 'id',
    };

    const deletedRecords = await getDeletedItems(updateRecords, primaryKeyMap);

    const insertXslsSheets = createXlsFromSequelizeResults({
      rows: insertRecords,
      model: Unit,
      hex: false,
      toStructuredCsv: true,
      excludeOrgUid: false,
      isUserFriendlyFormat: false,
    });

    const updateXslsSheets = createXlsFromSequelizeResults({
      rows: updateRecords,
      model: Unit,
      hex: false,
      toStructuredCsv: true,
      excludeOrgUid: false,
      isUserFriendlyFormat: false,
    });

    const deleteXslsSheets = createXlsFromSequelizeResults({
      rows: deletedRecords,
      model: Unit,
      hex: false,
      toStructuredCsv: true,
      excludeOrgUid: false,
      isUserFriendlyFormat: false,
    });

    const insertChangeList = await transformFullXslsToChangeList(
      insertXslsSheets,
      'insert',
      primaryKeyMap,
    );

    const updateChangeList = await transformFullXslsToChangeList(
      updateXslsSheets,
      'update',
      primaryKeyMap,
    );

    const deletedAssociationsChangeList = await transformFullXslsToChangeList(
      deleteXslsSheets,
      'delete',
      primaryKeyMap,
    );

    return {
      units: [
        ..._.get(insertChangeList, 'unit', []),
        ..._.get(updateChangeList, 'unit', []),
        ...deleteChangeList,
      ],
      labels: [
        ..._.get(insertChangeList, 'labels', []),
        ..._.get(updateChangeList, 'labels', []),
        ..._.get(deletedAssociationsChangeList, 'labels', []),
      ],
      issuances: [
        ..._.get(insertChangeList, 'issuances', []),
        ..._.get(updateChangeList, 'issuances', []),
        ..._.get(deletedAssociationsChangeList, 'issuances', []),
      ],
      labelUnits: [
        ..._.get(insertChangeList, 'label_units', []),
        ..._.get(updateChangeList, 'label_units', []),
        ..._.get(deletedAssociationsChangeList, 'label_units', []),
      ],
    };
  }
}

/**
 * Finds the deleted sub-items (e.g. labels)
 * @param updatedItems {Array<Object>} - The projects updated by the user
 * @param primaryKeyMap {Object} - Object map containing the primary keys for all tables
 */
async function getDeletedItems(updatedItems, primaryKeyMap) {
  const updatedUnitIds = updatedItems
    .map((record) => record[primaryKeyMap['unit']])
    .filter(Boolean);

  let originalProjects = [];
  if (updatedUnitIds.length > 0) {
    const includes = Unit.getAssociatedModels();

    const columns = [primaryKeyMap['unit']].concat(
      includes.map(
        (include) => `${include.model.name}${include.pluralize ? 's' : ''}`,
      ),
    );

    const query = {
      ...columnsToInclude(columns, includes),
    };

    const op = Sequelize.Op;
    originalProjects = await Unit.findAll({
      where: {
        [primaryKeyMap['unit']]: {
          [op.in]: updatedUnitIds,
        },
      },
      ...query,
    });
  }

  const associatedColumns = Unit.getAssociatedModels().map(
    (association) =>
      `${association.model.name}${association.pluralize ? 's' : ''}`,
  );

  return originalProjects.map((originalItem) => {
    const result = { ...originalItem.dataValues };

    const updatedItem = updatedItems.find(
      (item) =>
        item[primaryKeyMap['unit']] === originalItem[primaryKeyMap['unit']],
    );
    if (updatedItem == null) return;

    associatedColumns.forEach((column) => {
      if (originalItem[column] == null || !Array.isArray(originalItem[column]))
        return;
      if (updatedItem[column] == null || !Array.isArray(updatedItem[column]))
        return;

      result[column] = [...originalItem[column]];
      for (let index = originalItem[column].length - 1; index >= 0; --index) {
        const item = originalItem[column][index];
        if (
          updatedItem[column].findIndex(
            (searchedItem) =>
              searchedItem[primaryKeyMap[column]] ===
              item[primaryKeyMap[column]],
          ) >= 0
        )
          result[column].splice(index, 1);
      }
    });
    return result;
  });
}

Unit.init(Object.assign({}, ModelTypes, virtualFields), {
  sequelize,
  modelName: 'unit',
  timestamps: true,
});

export { Unit };
