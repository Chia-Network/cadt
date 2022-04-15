'use strict';

import _ from 'lodash';
import Sequelize from 'sequelize';
import * as rxjs from 'rxjs';
import {
  sequelize,
  safeMirrorDbHandler,
  sanitizeSqliteFtsQuery,
} from '../../database';
import { Label, Issuance, Staging } from '../../models';
import { UnitMirror } from './units.model.mirror';
import ModelTypes from './units.modeltypes.cjs';
import { transformSerialNumberBlock } from '../../utils/helpers';
import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls';
import { unitsUpdateSchema } from '../../validations/index.js';
import { getDeletedItems } from '../../utils/model-utils.js';

const { Model } = Sequelize;

const virtualFields = {
  unitBlockStart: {
    type: Sequelize.VIRTUAL,
    get() {
      const serialNumberBlock = this.getDataValue('serialNumberBlock');
      if (!serialNumberBlock) {
        return undefined;
      }
      const serialNumberPattern = this.getDataValue('serialNumberPattern');
      const [unitBlockStart] = transformSerialNumberBlock(
        serialNumberBlock,
        serialNumberPattern,
      );

      return unitBlockStart;
    },
  },
  unitBlockEnd: {
    type: Sequelize.VIRTUAL,
    get() {
      const serialNumberBlock = this.getDataValue('serialNumberBlock');
      if (!serialNumberBlock) {
        return undefined;
      }

      const serialNumberPattern = this.getDataValue('serialNumberPattern');
      const [, unitBlockEnd] = transformSerialNumberBlock(
        serialNumberBlock,
        serialNumberPattern,
      );

      return unitBlockEnd;
    },
  },
  unitCount: {
    type: Sequelize.VIRTUAL,
    get() {
      const serialNumberBlock = this.getDataValue('serialNumberBlock');
      if (!serialNumberBlock) {
        return undefined;
      }

      const serialNumberPattern = this.getDataValue('serialNumberPattern');
      const [, , unitCount] = transformSerialNumberBlock(
        serialNumberBlock,
        serialNumberPattern,
      );

      return unitCount;
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

    const deletedRecords = await getDeletedItems(
      updateRecords,
      primaryKeyMap,
      Unit,
      'unit',
    );

    const insertXslsSheets = createXlsFromSequelizeResults({
      rows: insertRecords,
      model: Unit,
      toStructuredCsv: true,
    });

    const updateXslsSheets = createXlsFromSequelizeResults({
      rows: updateRecords,
      model: Unit,
      toStructuredCsv: true,
    });

    const deleteXslsSheets = createXlsFromSequelizeResults({
      rows: deletedRecords,
      model: Unit,
      toStructuredCsv: true,
    });

    if (deleteXslsSheets.labels?.data.length > 1) {
      const warehouseProjectIdIndex =
        deleteXslsSheets.labels.data[0].indexOf('warehouseProjectId');
      if (warehouseProjectIdIndex >= 0) {
        for (
          let index = deleteXslsSheets.labels.data.length - 1;
          index > 0;
          --index
        ) {
          if (
            deleteXslsSheets.labels.data[index][warehouseProjectIdIndex] != null
          ) {
            deleteXslsSheets.labels.data.splice(index, 1);
          }
        }
      }

      if (deleteXslsSheets.labels.data.length === 1) {
        delete deleteXslsSheets.labels;
      }
    }

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

Unit.init(Object.assign({}, ModelTypes, virtualFields), {
  sequelize,
  modelName: 'unit',
  timestamps: true,
});

export { Unit };
