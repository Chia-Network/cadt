'use strict';

import _ from 'lodash';
import { uuid as uuidv4 } from 'uuidv4';
import { Sequelize } from 'sequelize';
import xlsx from 'node-xlsx';

import { Staging, Unit, Label, Issuance, Organization } from '../models';

import {
  columnsToInclude,
  optionallyPaginatedResponse,
  paginationParams,
} from '../utils/helpers';

import {
  assertOrgIsHomeOrg,
  assertUnitRecordExists,
  assertCsvFileInRequest,
  assertHomeOrgExists,
  assertNoPendingCommits,
  assertRecordExistance,
  assertIfReadOnlyMode,
} from '../utils/data-assertions';

import { createUnitRecordsFromCsv } from '../utils/csv-utils';
import {
  collapseTablesData,
  createXlsFromSequelizeResults,
  sendXls,
  tableDataFromXlsx,
  updateTableWithData,
  transformMetaUid,
} from '../utils/xls';

import {
  genericFilterRegex,
  genericSortColumnRegex,
  isArrayRegex,
} from '../utils/string-utils';

import { formatModelAssociationName } from '../utils/model-utils.js';
import { logger } from '../config/logger.cjs';

export const create = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertNoPendingCommits();
    await assertHomeOrgExists();

    const newRecord = _.cloneDeep(req.body);

    // When creating new unitd assign a uuid to is so
    // multiple organizations will always have unique ids
    const uuid = uuidv4();

    newRecord.warehouseUnitId = uuid;
    newRecord.timeStaged = Math.floor(Date.now() / 1000);
    newRecord.serialNumberBlock = `${newRecord.unitBlockStart}-${newRecord.unitBlockEnd}`;

    // All new units are assigned to the home orgUid
    const { orgUid } = await Organization.getHomeOrg();
    newRecord.orgUid = orgUid;

    if (newRecord.labels) {
      const promises = newRecord.labels.map(async (childRecord) => {
        if (childRecord.id) {
          // if we are reusing a record, make sure it exists
          await assertRecordExistance(Label, childRecord.id);
        } else {
          childRecord.id = uuidv4();
        }

        childRecord.orgUid = orgUid;
        childRecord.label_unit = {};
        childRecord.label_unit.id = uuidv4();
        childRecord.label_unit.orgUid = orgUid;
        childRecord.label_unit.warehouseUnitId = uuid;
        childRecord.label_unit.labelId = childRecord.id;

        return childRecord;
      });

      await Promise.all(promises);
    }

    if (newRecord.issuance) {
      if (newRecord.issuance.id) {
        // if we are reusing a record, make sure it exists
        await assertRecordExistance(Issuance, newRecord.issuance.id);
        newRecord.issuanceId = newRecord.issuance.id;
        delete newRecord.issuance;
      } else {
        newRecord.issuance.id = uuidv4();
        newRecord.issuance.orgUid = orgUid;
      }
    }

    const stagedData = {
      uuid,
      action: 'INSERT',
      table: Unit.stagingTableName,
      data: JSON.stringify([newRecord]),
    };

    await Staging.create(stagedData);

    res.json({
      message: 'Unit staged successfully',
      uuid,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Unit Insert Failed to stage.',
      error: error.message,
    });
  }
};

export const findAll = async (req, res) => {
  try {
    let {
      page,
      limit,
      columns,
      orgUid,
      search,
      xls,
      order,
      marketplaceIdentifiers,
      hasMarketplaceIdentifier,
      includeProjectInfoInSearch = false,
      filter,
    } = req.query;

    if (!page) {
      let redirectUrl = `${req.baseUrl}?page=1&limit=10`;

      if (Object.keys(req.query).length > 0) {
        redirectUrl = redirectUrl.concat(
          '&',
          Object.keys(req.query)
            .map((key) => `${key}=${req.query[key]}`)
            .join('&'),
        );
      }

      // Redirect to the modified URL
      return res.redirect(301, redirectUrl);
    }

    let where = orgUid != null && orgUid !== 'all' ? { orgUid } : undefined;

    if (filter) {
      if (!where) {
        where = {};
      }

      const matches = filter.match(genericFilterRegex);
      // check if the value param is an array so we can parse it
      const valueMatches = matches[2].match(isArrayRegex);
      where[matches[1]] = {
        [Sequelize.Op[matches[3]]]: valueMatches
          ? JSON.parse(matches[2])
          : matches[2],
      };
    }

    const includes = Unit.getAssociatedModels();

    if (columns) {
      // Remove any unsupported columns
      columns = columns.filter((col) =>
        Unit.defaultColumns
          .concat(includes.map(formatModelAssociationName))
          .includes(col),
      );
    } else {
      columns = Unit.defaultColumns.concat(
        includes.map(formatModelAssociationName),
      );
    }

    // If only FK fields have been specified, select just ID
    if (!columns.length) {
      columns = ['warehouseUnitId'];
    }

    let pagination = { page: undefined, limit: undefined };

    if (search) {
      const ftsResults = await Unit.fts(
        search,
        orgUid,
        pagination,
        Unit.defaultColumns,
        includeProjectInfoInSearch,
      );

      const mappedResults = ftsResults.rows.map((ftsResult) =>
        _.get(ftsResult, 'dataValues.warehouseUnitId'),
      );

      if (!where) {
        where = {};
      }

      where.warehouseUnitId = {
        [Sequelize.Op.in]: mappedResults,
      };
    }

    if (marketplaceIdentifiers) {
      if (!where) {
        where = {};
      }

      where.marketplaceIdentifier = {
        [Sequelize.Op.in]: _.flatten([marketplaceIdentifiers]),
      };
    } else if (
      typeof hasMarketplaceIdentifier === 'boolean' &&
      hasMarketplaceIdentifier === true
    ) {
      if (!where) {
        where = {};
      }

      where.marketplaceIdentifier = {
        [Sequelize.Op.not]: null,
      };
    } else if (
      typeof hasMarketplaceIdentifier === 'boolean' &&
      hasMarketplaceIdentifier === false
    ) {
      if (!where) {
        where = {};
      }

      where.marketplaceIdentifier = {
        [Sequelize.Op.eq]: null,
      };
    }

    // default to DESC
    let resultOrder = [['timeStaged', 'DESC']];

    if (order?.match(genericSortColumnRegex)) {
      const matches = order.match(genericSortColumnRegex);
      resultOrder = [[matches[1], matches[2]]];
    } else {
      // backwards compatibility for old order usage
      if (order && order === 'SERIALNUMBER') {
        resultOrder = [['serialNumberBlock', 'ASC']];
      } else if (order && order === 'ASC') {
        resultOrder = [['timeStaged', 'ASC']];
      }
    }

    const results = await Unit.findAndCountAll({
      where,
      distinct: true,
      order: resultOrder,
      ...columnsToInclude(columns, includes),
      ...paginationParams(page, limit),
    });

    const response = optionallyPaginatedResponse(results, page, limit);

    if (!xls) {
      return res.json(response);
    } else {
      return sendXls(
        Unit.name,
        createXlsFromSequelizeResults({
          rows: response,
          model: Unit,
          toStructuredCsv: false,
        }),
        res,
      );
    }
  } catch (error) {
    console.trace(error);
    res.status(400).json({
      message: 'Error retrieving units',
      error: error.message,
    });
  }
};

export const findOne = async (req, res) => {
  try {
    res.json(
      await Unit.findByPk(req.query.warehouseUnitId, {
        include: Unit.getAssociatedModels().map((association) => {
          if (association.pluralize) {
            return {
              model: association.model,
              as: association.model.name + 's',
            };
          }

          return association.model;
        }),
      }),
    );
  } catch (error) {
    res.status(400).json({
      message: 'Cant find Unit.',
      error: error.message,
    });
  }
};

export const updateFromXLS = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertHomeOrgExists();
    await assertNoPendingCommits();

    if (!req.file) {
      throw new Error('File Not Received');
    }

    const xlsxParsed = transformMetaUid(xlsx.parse(req.file.buffer));
    const stagedDataItems = tableDataFromXlsx(xlsxParsed, Unit);
    const collapsedData = collapseTablesData(stagedDataItems, Unit);

    await updateTableWithData(collapsedData, Unit);

    res.json({
      message: 'Updates from xlsx added to staging',
    });
  } catch (error) {
    logger.error('Batch Upload Failed.', error);
    res.status(400).json({
      message: 'Batch Upload Failed.',
      error: error.message,
    });
  }
};

export const update = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertHomeOrgExists();
    await assertNoPendingCommits();

    const originalRecord = await assertUnitRecordExists(
      req.body.warehouseUnitId,
    );

    await assertOrgIsHomeOrg(originalRecord.orgUid);

    const updatedRecord = _.cloneDeep(req.body);

    // All new units are assigned to the home orgUid
    const { orgUid } = await Organization.getHomeOrg();
    updatedRecord.orgUid = orgUid;
    updatedRecord.serialNumberBlock = `${updatedRecord.unitBlockStart}-${updatedRecord.unitBlockEnd}`;

    if (updatedRecord.labels) {
      const promises = updatedRecord.labels.map(async (childRecord) => {
        if (childRecord.id) {
          await assertRecordExistance(Label, childRecord.id);
        } else {
          childRecord.id = uuidv4();
        }

        if (!childRecord.orgUid) {
          childRecord.orgUid = orgUid;
        }

        if (!childRecord.label_unit) {
          childRecord.label_unit = {};
          childRecord.label_unit.id = uuidv4();
          childRecord.label_unit.orgUid = orgUid;
          childRecord.label_unit.warehouseUnitId =
            updatedRecord.warehouseUnitId;
          childRecord.label_unit.labelId = childRecord.id;
        }

        return childRecord;
      });

      await Promise.all(promises);
    }

    if (updatedRecord.issuance) {
      if (updatedRecord.issuance.id) {
        // if we are reusing a record, make sure it exists
        await assertRecordExistance(Issuance, updatedRecord.issuance.id);
        updatedRecord.issuanceId = updatedRecord.issuance.id;
        updatedRecord.issuance.orgUid = orgUid;
      } else {
        updatedRecord.issuance.id = uuidv4();
        updatedRecord.issuance.orgUid = orgUid;
      }
    } else {
      updatedRecord.issuance = originalRecord.issuance;
      updatedRecord.issuanceId = null;
    }

    // merge the new record into the old record
    let stagedRecord = Array.isArray(updatedRecord)
      ? updatedRecord
      : [updatedRecord];

    const stagedData = {
      uuid: req.body.warehouseUnitId,
      action: 'UPDATE',
      table: Unit.stagingTableName,
      data: JSON.stringify(stagedRecord),
    };

    await Staging.upsert(stagedData);

    res.json({
      message: 'Unit update added to staging',
    });
  } catch (err) {
    res.status(400).json({
      message: 'Error updating new unit',
      error: err.message,
    });
  }
};

export const destroy = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertHomeOrgExists();
    await assertNoPendingCommits();

    const originalRecord = await assertUnitRecordExists(
      req.body.warehouseUnitId,
    );

    await assertOrgIsHomeOrg(originalRecord.orgUid);

    const stagedData = {
      uuid: req.body.warehouseUnitId,
      action: 'DELETE',
      table: Unit.stagingTableName,
    };

    await Staging.upsert(stagedData);
    res.json({
      message: 'Unit deleted successfully',
    });
  } catch (err) {
    res.status(400).json({
      message: 'Error deleting new unit',
      error: err.message,
    });
  }
};

export const split = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertHomeOrgExists();
    await assertNoPendingCommits();

    const originalRecord = await assertUnitRecordExists(
      req.body.warehouseUnitId,
    );

    await assertOrgIsHomeOrg(originalRecord.orgUid);

    let totalSplitCount = 0;

    const splitRecords = await Promise.all(
      req.body.records.map(async (record, index) => {
        const newRecord = _.cloneDeep(originalRecord);

        if (index > 0) {
          newRecord.warehouseUnitId = uuidv4();
        }

        newRecord.unitCount = record.unitCount;
        totalSplitCount += record.unitCount;

        newRecord.serialNumberBlock = `${record.unitBlockStart}-${record.unitBlockEnd}`;
        newRecord.unitBlockStart = record.unitBlockStart;
        newRecord.unitBlockEnd = record.unitBlockEnd;

        if (record.marketplaceIdentifier) {
          newRecord.marketplaceIdentifier = record.marketplaceIdentifier;
        }

        if (record.marketplace) {
          newRecord.marketplace = record.marketplace;
        }

        if (record.unitOwner) {
          newRecord.unitOwner = record.unitOwner;
        }

        if (record.unitStatus) {
          newRecord.unitStatus = record.unitStatus;
        }

        if (record.countryJurisdictionOfOwner) {
          newRecord.countryJurisdictionOfOwner =
            record.countryJurisdictionOfOwner;
        }

        if (record.inCountryJurisdictionOfOwner) {
          newRecord.inCountryJurisdictionOfOwner =
            record.inCountryJurisdictionOfOwner;
        }

        return newRecord;
      }),
    );

    if (totalSplitCount !== originalRecord.unitCount) {
      throw new Error(
        `Your total split coount is ${totalSplitCount} units and the original record is ${originalRecord.unitCount} units`,
      );
    }

    const stagedData = {
      uuid: req.body.warehouseUnitId,
      action: 'UPDATE',
      commited: false,
      table: Unit.stagingTableName,
      data: JSON.stringify(splitRecords),
    };

    await Staging.upsert(stagedData);

    res.json({
      message: 'Unit split successful',
    });
  } catch (error) {
    res.status(400).json({
      message: 'Error splitting unit',
      error: error.message,
    });
  }
};

export const batchUpload = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertHomeOrgExists();
    await assertNoPendingCommits();

    const csvFile = assertCsvFileInRequest(req);
    await createUnitRecordsFromCsv(csvFile);

    res.json({
      message:
        'CSV processing complete, your records have been added to the staging table.',
    });
  } catch (error) {
    logger.error('Batch Upload Failed.', error);
    res.status(400).json({
      message: 'Batch Upload Failed.',
      error: error.message,
    });
  }
};
