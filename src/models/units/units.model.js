'use strict';

import _ from 'lodash';
import Sequelize from 'sequelize';
import * as rxjs from 'rxjs';
import {
  sequelize,
  safeMirrorDbHandler,
  sanitizeSqliteFtsQuery,
} from '../../database';
import { Label, Issuance, Staging, Organization } from '../../models';
import { UnitMirror } from './units.model.mirror';
import ModelTypes from './units.modeltypes.cjs';

import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls';
import { keyValueToChangeList } from '../../utils/datalayer-utils';
import { unitsUpdateSchema } from '../../validations/index.js';
import { getDeletedItems } from '../../utils/model-utils.js';
import dataLayer from '../../datalayer';

const { Model } = Sequelize;

class Unit extends Model {
  static stagingTableName = 'Units';
  static changes = new rxjs.Subject();
  static validateImport = unitsUpdateSchema;

  static defaultColumns = Object.keys(Object.assign({}, ModelTypes));

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
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await UnitMirror.create(values, mirrorOptions);
    });

    const createResult = await super.create(values, options);
    const { orgUid } = createResult;

    Unit.changes.next(['units', orgUid]);

    return createResult;
  }

  static async upsert(values, options) {
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await UnitMirror.upsert(values, mirrorOptions);
    });

    const upsertResult = await super.upsert(values, options);

    const { orgUid } = values;

    Unit.changes.next(['projects', orgUid]);

    return upsertResult;
  }

  static async destroy(options) {
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await UnitMirror.destroy(mirrorOptions);
    });

    Unit.changes.next(['units']);
    return super.destroy(options);
  }

  static async fts(
    searchStr,
    orgUid,
    pagination,
    columns = [],
    includeProjectInfo = false,
  ) {
    const dialect = sequelize.getDialect();

    const handlerMap = {
      sqlite: Unit.findAllSqliteFts,
      mysql: Unit.findAllMySQLFts,
    };

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
      includeProjectInfo,
    );
  }

  static async findAllMySQLFts(
    userSearchInput,
    orgUid,
    pagination,
    columns = [],
  ) {
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

    console.log('searchTerm', userSearchInput);

    const replacements = { search: userSearchInput, orgUid };

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

  static async findAllSqliteFts(
    userSearchInput,
    orgUid,
    pagination,
    columns = [],
    includeProjectInfo = false,
  ) {
    const { offset, limit } = pagination;

    let fields = '*';
    if (columns.length) {
      fields = columns.join(', ');
    }

    userSearchInput = sanitizeSqliteFtsQuery(userSearchInput);

    if (userSearchInput === '*') {
      // * isn't a valid matcher on its own. return empty set
      return {
        count: 0,
        rows: [],
      };
    }

    if (userSearchInput.startsWith('+')) {
      userSearchInput = userSearchInput.replace('+', ''); // If query starts with +, replace it
    }

    let sql = `
    SELECT ${fields} 
      FROM units_fts
      WHERE units_fts MATCH :search
    UNION
    SELECT ${fields} 
      FROM units_fts
      WHERE units_fts MATCH :search2
    `;

    if (includeProjectInfo) {
      sql = `SELECT units_fts.*
          FROM units_fts
          WHERE units_fts MATCH :search1
      UNION
      SELECT units_fts.*
          FROM units_fts
          WHERE units_fts MATCH :search3
      UNION
      SELECT units_fts.*
          FROM units_fts
          INNER JOIN issuances on units_fts.issuanceId = issuances.id
          INNER JOIN projects_fts on issuances.warehouseProjectId = projects_fts.warehouseProjectId
          WHERE projects_fts MATCH :search2
      `;
    }

    if (orgUid) {
      sql = `${sql} AND units_fts.orgUid = :orgUid`;
    }

    // doing a union search with an 0x is a hack to allow us to search against assetIds easier
    let replacements = {
      search: userSearchInput,
      search2: `0x${userSearchInput}`,
      orgUid,
    };
    if (includeProjectInfo) {
      replacements = {
        search1: userSearchInput,
        search2: userSearchInput,
        search3: `0x${userSearchInput}`,
        orgUid,
      };
    }

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

  static async generateChangeListFromStagedData(stagedData, comment, author) {
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

    const { registryId } = await Organization.getHomeOrg();
    const currentDataLayer = await dataLayer.getCurrentStoreData(registryId);
    const currentComment = currentDataLayer.filter(
      (kv) => kv.key === 'comment',
    );
    const isUpdateComment = currentComment.length > 0;
    const commentChangeList = keyValueToChangeList(
      'comment',
      `{"comment": "${comment}"}`,
      isUpdateComment,
    );

    const currentAuthor = currentDataLayer.filter((kv) => kv.key === 'author');
    const isUpdateAuthor = currentAuthor.length > 0;
    const authorChangeList = keyValueToChangeList(
      'author',
      `{"author": "${author}"}`,
      isUpdateAuthor,
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
      comment: commentChangeList,
      author: authorChangeList,
    };
  }
}

Unit.init(ModelTypes, {
  sequelize,
  modelName: 'unit',
  timestamps: true,
});

export { Unit };
