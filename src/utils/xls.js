import _ from 'lodash';

import xlsx from 'node-xlsx';
import stream from 'stream';

import { logger } from '../config/logger.cjs';

import { Staging, Organization, LabelUnit, ModelKeys } from './../models';

import { sequelize } from '../database';
import { assertOrgIsHomeOrg } from './data-assertions';
import { encodeHex } from './datalayer-utils';

import { isPluralized } from './string-utils.js';
import { formatModelAssociationName } from './model-utils.js';
import { uuid as uuidv4 } from 'uuidv4';

const associations = (model) =>
  model.getAssociatedModels().map((model) => model.model);

const capitalize = ([firstLetter, ...restOfWord]) =>
  firstLetter.toUpperCase() + restOfWord.join('');

export const sendXls = (name, bytes, response) => {
  const readStream = new stream.PassThrough();
  readStream.end(bytes);

  response.set(
    'Content-disposition',
    'attachment; filename=' + name + 's' + '.xlsx',
  );
  response.set('Content-Type', 'text/plain');

  readStream.pipe(response);
};

/**
 * Generates either an XLS or the non-built data behind the XLS (the list of rows in plain JS object)
 * @param rows {Object[]} - The items to add into the XLS
 * @param model {Object} - The class model to work on (e.g. Unit or Project)
 * @param toStructuredCsv {Boolean} - Whether to generate an XLS/CSV
 */
export function createXlsFromSequelizeResults({
  rows,
  model,
  toStructuredCsv = false,
}) {
  // TODO MariusD: Test with null values

  const rowsClone = JSON.parse(JSON.stringify(rows)); // Sadly this is the best way to simplify sequelize's return shape

  const uniqueColumns = buildColumnMap(rowsClone);

  const excludedColumns = getExcludedColumns(rowsClone);

  if (!toStructuredCsv) {
    // Remove auto-generated columns that don't make sense to the user
    const columnsToRemove = ['createdAt', 'updatedAt', 'timeStaged'];
    uniqueColumns.columns.forEach((columns, key, map) => {
      let indexesToRemove = [];

      columnsToRemove.forEach((columnToRemove) => {
        indexesToRemove.push(
          columns.findIndex((column) => column === columnToRemove),
        );
      });

      indexesToRemove = indexesToRemove.filter((index) => index >= 0);

      // Sort the indexes in reverse order
      indexesToRemove.sort((first, second) => {
        return second - first;
      });

      if (indexesToRemove.length > 0) {
        const newColumns = [...columns];

        indexesToRemove.forEach((index) => {
          newColumns.splice(index, 1);
        });

        map.set(key, newColumns);
      }
    });
  }

  const columnTransformations = {
    [model.name]: {
      issuance: 'issuanceId',
    },
  };

  const primaryKey = {
    [model.name]: model.primaryKeyAttributes[0],
    default: 'id',
  };

  const initialValue = {};

  const xlsData = rowsClone.reduce((aggregatedData, row) => {
    return buildObjectXlsData({
      item: row,
      name: model.name,
      uniqueColumns: uniqueColumns,
      excludedColumns: excludedColumns,
      columnsMapKey: null,
      columnTransformations: columnTransformations,
      primaryKeyMap: primaryKey,
      primaryKeyValue: null,
      parentPropName: null,
      shouldPluralizeSheetName: false,
      aggregatedData: aggregatedData,
    });
  }, initialValue);

  return toStructuredCsv ? xlsData : xlsx.build(Object.values(xlsData));
}

/**
 * Recursively builds the XLS data for a single item. This function could be returned from an {@ref Array.reduce} function.
 * @param item {Object | Object[]} - The item to build the XLS data for
 * @param name {string} - The name of the parent property for this item or a custom name. Used to generate the sheet name and to get the available transformations, primary key and other mappings
 * @param uniqueColumns {{ columns: Map<string, string>, topLevelKey: string }} - The list of all columns/props for each property name (retrieved using {@ref buildColumnMap}
 * @param excludedColumns {string[]} - The list of columns that should be excluded from the xls
 * @param columnsMapKey {string} - The key from {@param uniqueColumns} that contains the list of columns/props for the current item
 * @param columnTransformations {Object} - The mapping for column/prop name transformation for all items and sub-objects (mapped with the {@param name} prop)
 * @param primaryKeyMap {Object} - The mapping for the name of the primary key for all items and sub-objects (mapped with the {@param name} prop)
 * @param primaryKeyValue {unknown} - The value of the prop corresponding to the primary key for the parent item
 * @param parentPropName {string} - The prop name of the parent object (the name of the prop that the parent item is bound to. The parent of the parent)
 * @param shouldPluralizeSheetName {boolean} - Whether the sheet name should be expressed as plural or not
 * @param aggregatedData {Object} - The object containing the resulting XLS data. Will also be returned back, to be able to use this function inside the {@ref Array.reduce} function
 * @return The XLS data for a single item
 */
function buildObjectXlsData({
  item,
  name,
  uniqueColumns,
  excludedColumns,
  columnsMapKey,
  columnTransformations,
  primaryKeyMap,
  primaryKeyValue,
  parentPropName,
  shouldPluralizeSheetName,
  aggregatedData,
}) {
  // There are too many exceptions and special rules
  const columnsWithSpecialTreatment = { unit: ['issuance'] };

  const sheetName =
    !shouldPluralizeSheetName || isPluralized(name) ? name : `${name}s`;
  const primaryKeyProp = primaryKeyMap[name] ?? primaryKeyMap['default'];

  const columns =
    uniqueColumns.columns.get(columnsMapKey ?? uniqueColumns.topLevelKey) ?? [];
  const transformations =
    columnTransformations[name ?? uniqueColumns.topLevelKey] ?? {};

  // Special case for Unit issuance. This shouldn't exist, but it has far too many special cases.
  columnsWithSpecialTreatment[name]?.forEach((specialColumn) => {
    if (excludedColumns.includes(specialColumn)) {
      const specialColumnIndex = excludedColumns.indexOf(specialColumn);
      if (specialColumnIndex >= 0) {
        excludedColumns.splice(specialColumnIndex, 1);
      }
    }
  });

  // Insert a new sheet if needed
  if (aggregatedData[sheetName] == null) {
    aggregatedData[sheetName] = {
      name: isPluralized(name) ? name : `${name}s`,
      data: [
        columns
          .filter((colName) => !excludedColumns.includes(colName))
          .map((colName) => transformations[colName] ?? colName),
      ],
    };

    // If the primary key value of the parent item was sent, also add the name of the parent key name, suffixed by 'Id'
    if (primaryKeyValue != null) {
      let singularIdName = (
        isPluralized(parentPropName)
          ? parentPropName.slice(0, -1)
          : parentPropName
      )
        .replace('_', '')
        .concat('Id');
      if (aggregatedData[sheetName].data[0].includes(singularIdName)) {
        singularIdName = (isPluralized(name) ? name.slice(0, -1) : name)
          .replace('_', '')
          .concat('Id');
      }

      aggregatedData[sheetName].data[0].push(singularIdName);
    }
  }

  const xlsRowData = [];

  columns.forEach((column) => {
    const itemValue = item[column];

    // Recursively call this same function for all child items
    if (itemValue != null && typeof itemValue === 'object') {
      const primaryKeyName =
        columnsWithSpecialTreatment[name] == null ||
        !columnsWithSpecialTreatment[name].includes(column)
          ? primaryKeyProp
          : primaryKeyMap[column] ?? primaryKeyMap['default'];

      if (!Array.isArray(itemValue)) {
        const primaryKeyValue =
          columnsWithSpecialTreatment[name] == null ||
          !columnsWithSpecialTreatment[name].includes(column)
            ? item[primaryKeyName]
            : itemValue[primaryKeyName];

        buildObjectXlsData({
          item: itemValue,
          name: column,
          uniqueColumns: uniqueColumns,
          excludedColumns: [],
          columnsMapKey: column,
          aggregatedData: aggregatedData,
          primaryKeyMap: primaryKeyMap,
          primaryKeyValue: primaryKeyValue,
          parentPropName: name,
          shouldPluralizeSheetName: true,
          columnTransformations: columnTransformations,
        });
      } else {
        itemValue.forEach((val) => {
          const primaryKeyValue =
            columnsWithSpecialTreatment[name] == null ||
            !columnsWithSpecialTreatment[name].includes(column)
              ? item[primaryKeyName]
              : val[primaryKeyName];

          if (val != null && typeof val === 'object') {
            buildObjectXlsData({
              item: val,
              name: column,
              uniqueColumns: uniqueColumns,
              excludedColumns: [],
              columnsMapKey: column,
              aggregatedData: aggregatedData,
              primaryKeyMap: primaryKeyMap,
              primaryKeyValue: primaryKeyValue,
              parentPropName: name,
              shouldPluralizeSheetName: true,
              columnTransformations: columnTransformations,
            });
          }
        });
      }

      if (
        parentPropName == null &&
        (columnsWithSpecialTreatment[name] == null ||
          !columnsWithSpecialTreatment[name].includes(column))
      ) {
        return;
      }
    }

    if (itemValue != null && typeof itemValue === 'object') {
      // Add the id of the child item as well if the child item is an object
      const valuePrimaryKeyProp =
        primaryKeyMap[column] ?? primaryKeyMap['default'];
      xlsRowData.push(itemValue[valuePrimaryKeyProp]);
    } else if (!excludedColumns.includes(column)) {
      // Add the value of current item to the sheet if the item is not an object
      xlsRowData.push(itemValue);
    }
  });

  // Also add the primary key value of the parent item
  if (primaryKeyValue != null) {
    xlsRowData.push(primaryKeyValue);
  }

  if (xlsRowData.length) {
    aggregatedData[sheetName].data.push(xlsRowData);
  }

  return aggregatedData;
}

export const createXlsFromSequelizeResults_old = ({
  rows,
  model,
  toStructuredCsv = false,
  excludeOrgUid = false,
  isUserFriendlyFormat = true,
}) => {
  rows = JSON.parse(JSON.stringify(rows)); // Sadly this is the best way to simplify sequelize's return shape

  let columnsInResults = [];
  const associationColumnsMap = new Map();

  if (rows.length > 0) {
    columnsInResults = Object.keys(rows[0]);

    rows.forEach((row, index) => {
      if (index === 0) {
        return;
      }

      Object.keys(row).forEach((key) => {
        if (!columnsInResults.includes(key)) columnsInResults.push(key);
      });
    });
  }

  const associations = model.getAssociatedModels();
  const associationNames = associations.map(
    (association) => `${association.model.name}s`,
  );

  const columnsInMainSheet = columnsInResults.filter(
    (column) =>
      !associationNames.includes(column) &&
      (!excludeOrgUid || column !== 'orgUid'),
  );

  const associatedModelColumns = columnsInResults.filter((column) =>
    associations
      .map((association) => `${association.model.name}s`)
      .includes(column),
  );

  // Create a map with the union of all keys of each association item on any row (the columns may differ, e.g. one item added, one updated)
  if (rows.length > 0) {
    associatedModelColumns.forEach((column) => {
      rows.forEach((row) => {
        if (row[column] == null || typeof row[column] !== 'object') {
          return;
        }

        if (Array.isArray(row[column])) {
          row[column].forEach((item) => {
            if (item != null && typeof item === 'object') {
              getObjectColumns(item, column, associationColumnsMap);
            }
          });
        } else {
          getObjectColumns(row[column], column, associationColumnsMap);
        }
      });
    });
  }

  const initialReduceValue = {};
  initialReduceValue[model.name] = {
    name: model.name + 's',
    data: [
      columnsInMainSheet.map((colName) =>
        colName === 'issuance' ? 'issuanceId' : colName,
      ), // todo make this generic
    ],
  };

  const xlsData = rows.reduce((sheets, row) => {
    let mainXlsRow = [];

    // Populate main sheet values
    columnsInMainSheet.forEach((columnName) => {
      const rowValue =
        isUserFriendlyFormat && row[columnName] == null
          ? 'null'
          : row[columnName];

      if (rowValue != null && Object.keys(rowValue).includes('id')) {
        if (!Object.keys(sheets).includes(columnName + 's')) {
          sheets[columnName + 's'] = {
            name: columnName + 's',
            data: [
              Object.keys(rowValue).concat([
                model.name.split('_').join('') + 'Id',
              ]),
            ],
          };
        }
        sheets[columnName + 's'].data.push(
          Object.values(rowValue)
            .map((val1) => val1)
            .concat([rowValue.id]),
        );
      }

      mainXlsRow.push(rowValue);
    });

    if (mainXlsRow.length) {
      sheets[model.name].data.push(mainXlsRow);
    }

    // Populate associated data sheets
    associatedModelColumns.forEach((column) => {
      if (!Array.isArray(row[column])) {
        return;
      }

      row[column].forEach((value) => {
        const xlsRow = [];

        if (!Object.keys(sheets).includes(column)) {
          sheets[column] = {
            name: column,
            data: [Object.keys(value).concat([model.name + 'Id'])],
          };
        }

        (associationColumnsMap.get(column) ?? Object.keys(value)).forEach(
          (column) => {
            const rowValue =
              isUserFriendlyFormat && value[column] == null
                ? 'null'
                : value[column];

            if (rowValue != null && typeof rowValue === 'object') {
              if (!Object.keys(sheets).includes(column + 's')) {
                const columns =
                  associationColumnsMap.get(column) ?? Object.keys(rowValue);

                sheets[column + 's'] = {
                  name: column + 's',
                  data: [columns.concat([column.split('_').join('') + 'Id'])],
                };
              }

              if (rowValue != null) {
                const columns =
                  associationColumnsMap.get(column) ?? Object.keys(rowValue);
                sheets[column + 's'].data.push(
                  columns
                    .map((currentCol) => rowValue[currentCol])
                    .concat([value.id]),
                );
              }
            }

            xlsRow.push(rowValue);
          },
        );

        if (xlsRow.length > 0) {
          if ((model.primaryKeyAttributes?.length ?? 0) > 0) {
            xlsRow.push(row[model.primaryKeyAttributes[0]]);
          }

          sheets[column].data.push(xlsRow);
        }
      });
    });

    return sheets;
  }, initialReduceValue);

  if (!toStructuredCsv) {
    return xlsx.build(Object.values(xlsData));
  } else {
    return xlsData;
  }
};

export const tableDataFromXlsx = (xlsx, model) => {
  // Todo recursion
  const modelAssociations = [...associations(model), model];

  return xlsx.reduce((stagingData, { data, name }) => {
    let dataModel = modelAssociations.find((model) => {
      const modelName = name.slice(0, -1);
      const assocModelName = modelName.split('_');
      if (assocModelName.length > 1) {
        assocModelName[1] = capitalize(assocModelName[1]);
      }
      return (
        model.name === name.slice(0, -1) ||
        model.name === assocModelName.join('')
      );
    });

    if (model.name === 'unit' && dataModel === undefined) {
      // todo clean this up
      dataModel = LabelUnit;
    }

    const columnNames = data.shift();
    data.forEach((dataRow) => {
      if (stagingData[dataModel.name] == null) {
        stagingData[dataModel.name] = { model: dataModel, data: [] };
      }

      const row = {};
      dataRow.forEach((columnData, index) => {
        if (columnData === 'null') {
          columnData = null;
        }

        row[columnNames[index]] = columnData;
      });

      delete row.orgUid;
      stagingData[dataModel.name].data.push(row);
    });

    return stagingData;
  }, {});
};

export const collapseTablesData = (tableData, model) => {
  const collapsed = { [model.name]: tableData[model.name] };

  let associations = model.getAssociatedModels();

  collapsed[model.name]?.data?.forEach((data, index) => {
    const tableRowData =
      tableData[model.name]?.data != null
        ? tableData[model.name]?.data[index]
        : null;

    if (
      tableRowData != null &&
      tableRowData[model.primaryKeyAttributes[0]] == null
    ) {
      tableRowData[model.primaryKeyAttributes[0]] = uuidv4();
    }

    associations.forEach((association) => {
      if (
        !Object.prototype.hasOwnProperty.call(tableData, association.model.name)
      ) {
        return;
      }

      const dataKey = formatModelAssociationName(association);
      const foundRecord = tableData[association.model.name]?.data?.find(
        (row) => {
          let found = false;

          if (association.model.name === 'issuance' && !association.pluralize) {
            if (
              row[model.name + 'Id'] === data[association.model.name + 'Id']
            ) {
              found = true;
              delete row[model.name + 'Id'];
            }
          } else {
            let comparedToData = null;
            const primaryKey =
              tableData[model.name]?.model?.primaryKeyAttributes[0];

            if (tableRowData != null && primaryKey != null) {
              comparedToData = tableRowData[primaryKey];
            }

            if (row[model.name + 'Id'] === comparedToData) {
              found = true;
              delete row[model.name + 'Id'];
            }

            if (
              row['warehouseProjectId'] === comparedToData ||
              row['warehouseUnitId'] === comparedToData
            ) {
              found = true;
              delete row[model.name + 'Id'];
            }
          }

          return found;
        },
      );
      data[dataKey] = foundRecord;
    });
  });

  collapsed[model.name]?.data?.forEach((data, index) => {
    associations.forEach((association) => {
      if (association.model.name !== 'label') {
        return;
      }

      const tableUnitData = tableData['label_unit']?.data?.find((row) => {
        if (tableData[model.name]?.data == null) {
          return false;
        }

        if (
          tableData[model.name].data[index]?.labels != null &&
          !Array.isArray(tableData[model.name].data[index].labels)
        ) {
          tableData[model.name].data[index].labels = [
            tableData[model.name].data[index].labels,
          ];
        }

        return tableData[model.name].data[index]?.labels
          ?.map((label) => label.id)
          .includes(row['labelunitId']);
      });

      const dataKey = formatModelAssociationName(association);

      if (data[dataKey] != null) {
        if (data[dataKey].length > 0) {
          data[dataKey][0]['label_unit'] = tableUnitData;
        }

        if (data.labels != null && !Array.isArray(data.labels)) {
          data.labels = [data.labels];
        }

        data.labels = data.labels?.map((label) => {
          if (label.label_unit?.labelunitId != null) {
            delete label.label_unit.labelunitId;
          }

          return label;
        });
      }
    });
  });

  return collapsed;
};

/**
 * Sets or deletes the model key from the children specified in {@param removeModelKeyInChildren}
 * @param modelAssociations - The associations object for the current model
 * @param item - The item to remove the model keys from
 * @param removeModelKeyInChildren - The list of association names to process
 * @param model - The model used
 * @param setKey - Whether to set the model key to children or to delete them (false = delete)
 */
function updateModelChildIds(
  modelAssociations,
  item,
  removeModelKeyInChildren,
  model,
  setKey,
) {
  modelAssociations.forEach((association) => {
    if (!association.pluralize) return;

    const key = formatModelAssociationName(association);
    if (item[key] != null) {
      if (!Array.isArray(item[key])) {
        item[key] = [item[key]];
      }

      if (removeModelKeyInChildren.includes(key)) {
        item[key].forEach((childData) => {
          if (setKey) {
            childData[model.primaryKeyAttributes[0]] =
              item[model.primaryKeyAttributes[0]];
          } else {
            delete childData[model.primaryKeyAttributes[0]];
          }
        });
      }
    }
  });
}

export const updateTableWithData = async (tableData, model) => {
  if (!['project', 'unit'].includes(model.name)) {
    throw 'Bulk import is only supported for projects and units'; // Technically, updateTableWithData can support any model
  }
  const modelAssociations = model.getAssociatedModels();

  const removeModelKeyInChildren =
    model.name === 'project'
      ? [
          'projectLocations',
          'coBenefits',
          'relatedProjects',
          'projectRatings',
          'estimations',
        ]
      : [];

  // using a transaction ensures either everything is uploaded or everything fails
  await sequelize.transaction(async () => {
    const { orgUid } = await Organization.getHomeOrg();

    await Promise.all(
      Object.values(tableData).map(async (data) => {
        if (
          data.data == null ||
          data.model == null ||
          !Array.isArray(data.data)
        ) {
          return;
        }

        await Promise.all(
          data.data.map(async (row) => {
            const existingRecord = await data.model.findByPk(
              row[data.model.primaryKeyAttributes[0]],
            );

            const exists = Boolean(existingRecord);

            // Stripping out issuanceId if its included. Need to take another look at this
            if (data.model.name === 'unit') {
              delete row['issuanceId'];
            }
            updateModelChildIds(
              modelAssociations,
              row,
              removeModelKeyInChildren,
              model,
              false,
            );

            const validation = data.model.validateImport?.validate(row);

            updateModelChildIds(
              modelAssociations,
              row,
              removeModelKeyInChildren,
              model,
              true,
            );

            if (exists) {
              // Assert the original record is a record your allowed to modify
              await assertOrgIsHomeOrg(existingRecord.orgUid);
            } else {
              // Assign the newly created record to this home org
              row.orgUid = orgUid;
            }

            // merge the new record into the old record
            let stagedRecord = Array.isArray(row) ? row : [row];

            stagedRecord = stagedRecord.map((record) => {
              return Object.keys(record).reduce((syncedRecord, key) => {
                syncedRecord[key] = record[key];
                return syncedRecord;
              }, existingRecord?.dataValues ?? {});
            });

            if (!validation.error) {
              await Staging.upsert({
                uuid: row[model.primaryKeyAttributes[0]],
                action: exists ? 'UPDATE' : 'INSERT',
                table: model.stagingTableName,
                data: JSON.stringify(stagedRecord),
              });
            } else {
              validation.error.message += ' on ' + model.name;
              throw validation.error;
            }
          }),
        );
      }),
    );
  });
};

const checkArrayOfArrays = (a) => {
  return a.every(function (x) {
    return Array.isArray(x);
  });
};

export const transformFullXslsToChangeList = async (
  xsls,
  action,
  primaryKeyNames,
) => {
  try {
    const models = Object.keys(primaryKeyNames);
    const changeList = {};

    await Promise.all(
      models.map(async (key) => {
        let sheet = xsls[key];
        if (sheet) {
          const headerRow = sheet.data[0];
          const primaryKeyIndex = headerRow.findIndex((item) => {
            return item === primaryKeyNames[key];
          });

          if (!changeList[key]) {
            changeList[key] = [];
          }

          // filter out the header row
          await Promise.all(
            _.tail(sheet.data).map(async (row) => {
              const rows = checkArrayOfArrays(row) ? row : [row];
              await Promise.all(
                rows.map(async (r) => {
                  const dataLayerKey = encodeHex(
                    `${key}|${r[primaryKeyIndex]}`,
                  );

                  if (['update', 'insert'].includes(action)) {
                    let isUpdate = await ModelKeys[key].findByPk(
                      r[primaryKeyIndex],
                    );

                    if (isUpdate) {
                      const alreadyPushed = changeList[key].find(
                        (change) =>
                          change.action === 'delete' &&
                          change.key === dataLayerKey,
                      );

                      if (!alreadyPushed) {
                        changeList[key].push({
                          action: 'delete',
                          key: dataLayerKey,
                        });
                      }
                    }
                    changeList[key].push({
                      action: 'insert',
                      key: dataLayerKey,
                      value: encodeHex(
                        JSON.stringify(_.zipObject(headerRow, r)),
                      ),
                    });
                  } else {
                    changeList[key].push({
                      action: action,
                      key: dataLayerKey,
                      value: encodeHex(
                        JSON.stringify(_.zipObject(headerRow, r)),
                      ),
                    });
                  }
                }),
              );
            }),
          );
        }
      }),
    );

    return changeList;
  } catch (error) {
    logger.error(
      'Error transformFullXslsToChangeList: ${error.message}',
      error,
    );
  }
};

/**
 * Returns a Map and the top level key name with all unique columns (props) on the items themselves and any child object they contain.
 * The values are string arrays containing the column names.
 * The key of the map is the name of the column (prop) as found in the parent object. The main items property are under a key named 'top level'.
 * @example { id, subItem: { subId }} will return: { columns: [ 'top level': [ 'id', 'subItem' ], 'subItem': [ 'subId' ]], topLevelKey: 'top level' }
 * @param items {Object[] | Object} - The items to go through and extract the columns
 * @returns {{ columns: Map<string, string>, topLevelKey: string }}
 */
function buildColumnMap(items) {
  const result = new Map();
  const topLevelKey = 'top level';

  if (items == null || typeof items !== 'object') {
    return {
      columns: result,
      topLevelKey: topLevelKey,
    };
  }

  if (Array.isArray(items)) {
    getArrayColumns(items, topLevelKey, result);
  } else {
    getObjectColumns(items, topLevelKey, result);
  }

  return {
    columns: result,
    topLevelKey: topLevelKey,
  };
}

/**
 * Populates the association map with the union of columns from all the objects having the same property name
 * @param item {Object} - The item to look into
 * @param propertyName {string} - The name of the property, as defined in the parent object (will be the key for the map)
 * @param columnsMap {Map<string, Array<string>>} - The map to populate
 */
function getObjectColumns(item, propertyName, columnsMap) {
  if (item == null || typeof item !== 'object') {
    return;
  }

  if (!Array.isArray(item)) {
    const currentProperties = columnsMap.get(propertyName) ?? [];

    Object.entries(item).forEach(([column, value]) => {
      if (Array.isArray(value)) {
        getArrayColumns(value, column, columnsMap);
      } else if (typeof value === 'object') {
        getObjectColumns(value, column, columnsMap);
      }

      if (!currentProperties.includes(column)) {
        currentProperties.push(column);
      }
    });

    columnsMap.set(propertyName, currentProperties);
  }
}

/**
 * Iterates through the array and populates the association map with the union of columns from all the objects having the same property name
 * @param items {unknown[]} - The items to look into
 * @param propertyName {string} - The name of the property, as defined in the parent object (will be the key for the map)
 * @param columnsMap {Map<string, Array<string>>} - The map to populate
 */
function getArrayColumns(items, propertyName, columnsMap) {
  if (items == null || typeof items !== 'object' || !Array.isArray(items)) {
    return;
  }

  items.forEach((value) => {
    if (value == null) {
      return;
    }

    if (Array.isArray(value)) {
      getArrayColumns(value, propertyName, columnsMap);
      return;
    }

    if (typeof value === 'object') {
      getObjectColumns(value, propertyName, columnsMap);
    }
  });
}

/**
 * Builds the list of columns that should be excluded from the xls (props that have objects as values)
 * @param items {Object[] | Object} - The items to go through and extract the columns
 * @returns string[] - The list of columns to be excluded from xls
 */
function getExcludedColumns(items) {
  if (items == null) return [];
  const itemsList = Array.isArray(items) ? items : [items];

  const excludedColumns = [];
  itemsList.forEach((item) => {
    Object.entries(item).forEach(([column, value]) => {
      if (
        value != null &&
        typeof value === 'object' &&
        !excludedColumns.includes(column)
      ) {
        excludedColumns.push(column);
      }
    });
  });

  return excludedColumns;
}

// Converts the metaUids to actual Uids
export const transformMetaUid = (xlsxParsed) => {
  let xlsxParseSerialized = JSON.stringify(xlsxParsed, 2, 2);
  const metaUids = _.uniq(
    [...xlsxParseSerialized.matchAll(/(NEW-[0-9])/g)].map((item) => item[0]),
  );
  metaUids.forEach((metaId) => {
    const uuid = uuidv4();
    xlsxParseSerialized = xlsxParseSerialized.replace(
      new RegExp(metaId, 'g'),
      uuid,
    );
  });

  return JSON.parse(xlsxParseSerialized);
};
