'use strict';

import _ from 'lodash';
import { uuid as uuidv4 } from 'uuidv4';
import { Sequelize } from 'sequelize';

import { Staging, Unit, Label, Issuance, Organization } from '../models';

import {
  columnsToInclude,
  optionallyPaginatedResponse,
  paginationParams,
  createSerialNumberStr,
} from '../utils/helpers';

import {
  assertOrgIsHomeOrg,
  assertUnitRecordExists,
  assertSumOfSplitUnitsIsValid,
  assertCsvFileInRequest,
  assertHomeOrgExists,
  assertNoPendingCommits,
  assertRecordExistance,
  assertDataLayerAvailable,
  assertIfReadOnlyMode,
} from '../utils/data-assertions';

import { createUnitRecordsFromCsv } from '../utils/csv-utils';
import {
  collapseTablesData,
  createXlsFromSequelizeResults,
  sendXls,
  tableDataFromXlsx,
  updateTableWithData,
} from '../utils/xls';
import xlsx from 'node-xlsx';
import { formatModelAssociationName } from '../utils/model-utils.js';

export const create = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertDataLayerAvailable();
    await assertNoPendingCommits();
    await assertHomeOrgExists();

    const newRecord = _.cloneDeep(req.body);

    // When creating new unitd assign a uuid to is so
    // multiple organizations will always have unique ids
    const uuid = uuidv4();

    newRecord.warehouseUnitId = uuid;
    newRecord.timeStaged = Math.floor(Date.now() / 1000);

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
    await assertDataLayerAvailable();

    let { page, limit, columns, orgUid, search, xls } = req.query;
    let where = orgUid != null && orgUid !== 'all' ? { orgUid } : undefined;

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

    let results;
    let pagination = paginationParams(page, limit);

    if (xls) {
      pagination = { page: undefined, limit: undefined };
    }

    if (search) {
      const ftsResults = await Unit.fts(
        search,
        orgUid,
        pagination,
        Unit.defaultColumns,
      );

      const mappedResults = ftsResults.rows.map((ftsResult) =>
        _.get(ftsResult, 'dataValues.warehouseUnitId'),
      );

      if (!where) {
        where = {};
      }

      where.warehouseProjectId = {
        [Sequelize.Op.in]: mappedResults,
      };
    }

    if (!results) {
      results = await Unit.findAndCountAll({
        where,
        distinct: true,
        order: [['timeStaged', 'DESC']],
        ...columnsToInclude(columns, includes),
        ...paginationParams(page, limit),
      });
    }

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
    await assertDataLayerAvailable();
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
    await assertDataLayerAvailable();
    await assertHomeOrgExists();
    await assertNoPendingCommits();

    const { files } = req;

    if (!files || !files.xlsx) {
      throw new Error('File Not Received');
    }

    const xlsxParsed = xlsx.parse(files.xlsx.data);
    const stagedDataItems = tableDataFromXlsx(xlsxParsed, Unit);
    await updateTableWithData(collapseTablesData(stagedDataItems, Unit), Unit);

    res.json({
      message: 'Updates from xlsx added to staging',
    });
  } catch (error) {
    res.status(400).json({
      message: 'Batch Upload Failed.',
      error: error.message,
    });
  }
};

export const update = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertDataLayerAvailable();
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
        delete updatedRecord.issuance;
      } else {
        updatedRecord.issuance.id = uuidv4();
        updatedRecord.issuance.orgUid = orgUid;
      }
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
    await assertDataLayerAvailable();
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
    await assertDataLayerAvailable();
    await assertHomeOrgExists();
    await assertNoPendingCommits();

    const originalRecord = await assertUnitRecordExists(
      req.body.warehouseUnitId,
    );

    await assertOrgIsHomeOrg(originalRecord.orgUid);

    const { unitBlockStart } = assertSumOfSplitUnitsIsValid(
      originalRecord.serialNumberBlock,
      new RegExp(originalRecord.serialNumberPattern),
      req.body.records,
    );

    let lastAvailableUnitBlock = unitBlockStart;

    const splitRecords = await Promise.all(
      req.body.records.map(async (record, index) => {
        const newRecord = _.cloneDeep(originalRecord);

        if (index > 0) {
          newRecord.warehouseUnitId = uuidv4();
        }

        newRecord.unitCount = record.unitCount;

        const newUnitBlockStart = lastAvailableUnitBlock;
        lastAvailableUnitBlock += Number(record.unitCount);
        const newUnitBlockEnd = lastAvailableUnitBlock;
        // move to the next available block
        lastAvailableUnitBlock += 1;

        newRecord.serialNumberBlock = createSerialNumberStr(
          originalRecord.serialNumberBlock,
          newUnitBlockStart,
          newUnitBlockEnd,
        );

        if (record.unitOwner) {
          newRecord.unitOwner = record.unitOwner;
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
    await assertDataLayerAvailable();
    await assertHomeOrgExists();
    await assertNoPendingCommits();

    const csvFile = assertCsvFileInRequest(req);
    await createUnitRecordsFromCsv(csvFile);

    res.json({
      message:
        'CSV processing complete, your records have been added to the staging table.',
    });
  } catch (error) {
    res.status(400).json({
      message: 'Batch Upload Failed.',
      error: error.message,
    });
  }
};
