import _ from 'lodash';

import xlsx from 'node-xlsx';
import stream from 'stream';

import { Staging, Organization, LabelUnit } from './../models';
import { sequelize } from '../models/database';
import { assertOrgIsHomeOrg } from '../utils/data-assertions';

const associations = (model) =>
  model.getAssociatedModels().map((model) => {
    if (typeof model === 'object') {
      return model.model;
    } else {
      return model;
    }
  });

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

export const encodeValue = (value, hex = false) => {
  // Todo: address this elsewhere (hide these columns). This is a quick fix for complex relationships in xlsx
  if (typeof value === 'object') {
    value = '';
  }
  
  if (hex) {
    try {
      return Buffer.from(value).toString('hex');
    } catch (e) {
      return '';
    }
  } else {
    return value;
  }
};

export const createXlsFromSequelizeResults = (
  // todo recursion
  rows,
  model,
  hex = false,
  toStructuredCsv = false,
  excludeOrgUid = false,
) => {
  rows = JSON.parse(JSON.stringify(rows)); // Sadly this is the best way to simplify sequelize's return shape

  let columnsInResults = [];

  if (rows.length) {
    // All rows look the same.. grab the first result to determine xls schema
    columnsInResults = Object.keys(rows[0]);
  }

  let associations = model.getAssociatedModels().map((model) => {
    if (typeof model === 'object') {
      return model.model;
    } else {
      return model;
    }
  });
  const columnsInMainSheet = columnsInResults.filter(
    (col) => !associations.map((a) => a.name + 's').includes(col),
  );
  const associatedModels = columnsInResults.filter((col) =>
    associations.map((a) => a.name + 's').includes(col),
  );

  const initialReduceValue = {};
  initialReduceValue[model.name] = {
    name: model.name + 's',
    data: [
      columnsInMainSheet.filter((colName) => {
        return !(excludeOrgUid && colName === 'orgUid');
      }),
    ],
  };

  const xlsData = rows.reduce((sheets, row) => {
    let mainXlsRow = [];

    // Populate main sheet values
    for (const [i, mainColName] of columnsInMainSheet.entries()) {
      if (row[mainColName] === null) {
        row[mainColName] = 'null';
      }

      if (
        Object.keys(row).includes(mainColName) &&
        Object.keys(row[mainColName]).includes('id')
      ) {
        if (!Object.keys(sheets).includes(mainColName + 's')) {
          sheets[mainColName + 's'] = {
            name: mainColName + 's',
            data: [
              Object.keys(row[mainColName]).concat([
                model.name.split('_').join('') + 'Id',
              ]),
            ],
          };
        }
        sheets[mainColName + 's'].data.push(
          Object.values(row[mainColName])
            .map((val1) => encodeValue(val1, hex))
            .concat([encodeValue(row[mainColName].id, hex)]),
        );
      }
      if (!associations.map((singular) => singular + 's').includes(i)) {
        // Todo: change to colNames[i], but also filter column headings first (for skipping assoc cols)
        if (row[mainColName] === null) {
          row[mainColName] = 'null';
        }
        if (!(excludeOrgUid && mainColName === 'orgUid')) {
          mainXlsRow.push(encodeValue(row[mainColName], hex));
        }
      }
    }

    if (mainXlsRow.length) {
      sheets[model.name].data.push(mainXlsRow);
    }

    // Populate associated data sheets
    for (const associatedModel of associatedModels) {
      for (const [columnName, columnValue] of Object.entries(row)) {
        if (
          !columnsInMainSheet.includes(columnName) &&
          columnName === associatedModel
        ) {
          if (Array.isArray(columnValue)) {
            // one to many
            // eslint-disable-next-line
            for (const [_i, assocColVal] of columnValue.entries()) {
              const xlsRow = [];
              if (!Object.keys(sheets).includes(associatedModel)) {
                sheets[associatedModel] = {
                  name: associatedModel,
                  data: [Object.keys(assocColVal).concat([model.name + 'Id'])],
                };
              }
              const colNames = Object.keys(assocColVal);
              for (const [i, v] of Object.values(assocColVal)
                .map((col) => (col === null ? 'null' : col))
                .entries()) {
                if (typeof v === 'object') {
                  if (!Object.keys(sheets).includes(colNames[i] + 's')) {
                    sheets[colNames[i] + 's'] = {
                      name: colNames[i] + 's',
                      data: [
                        Object.keys(v).concat([
                          colNames[i].split('_').join('') + 'Id',
                        ]),
                      ],
                    };
                  }
                  sheets[colNames[i] + 's'].data.push(
                    Object.values(v)
                      .map((val1) => encodeValue(val1, hex))
                      .concat([encodeValue(assocColVal.id, hex)]),
                  );
                }
                xlsRow.push(encodeValue(v, hex));
              }
              if (xlsRow.length > 0) {
                xlsRow.push(
                  encodeValue(row[model.primaryKeyAttributes[0]], hex),
                );
                sheets[associatedModel].data.push(xlsRow);
              }
            }
          }
        }
      }
    }

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
  return xlsx.reduce((stagingData, { data, name }) => {
    let dataModel = [...associations(model), model].find((m) => {
      const modelName = name.slice(0, -1);
      const assocModelName = modelName.split('_');
      if (assocModelName.length > 1) {
        assocModelName[1] = capitalize(assocModelName[1]);
      }
      return m.name === name.slice(0, -1) || m.name === assocModelName.join('');
    });

    if (model.name === 'unit' && dataModel === undefined) {
      // todo clean this up
      dataModel = LabelUnit;
    }

    const columnNames = data.shift();
    for (const [, dataRow] of data.entries()) {
      if (!Object.keys(stagingData).includes(dataModel.name)) {
        stagingData[dataModel.name] = { model: dataModel, data: [] };
      }
      const row = {};
      for (let [columnIndex, columnData] of dataRow.entries()) {
        if (columnData === 'null') {
          columnData = null;
        }
        // Ignore virtual fields
        if (
          !Object.keys(model.virtualFieldList).includes(
            columnNames[columnIndex],
          )
        ) {
          row[columnNames[columnIndex]] = columnData;
        }
      }
      delete row.orgUid;
      stagingData[dataModel.name].data.push(row);
    }
    return stagingData;
  }, {});
};

export const collapseTablesData = (tableData, model) => {
  // Todo recursion
  const collapsed = { [model.name]: tableData[model.name] };

  let associations = model.getAssociatedModels().map((model) => {
    if (typeof model === 'object') {
      return model.model;
    } else {
      return model;
    }
  });

  for (const [i] of collapsed[model.name].data.entries()) {
    for (const { name: association } of associations) {
      // To account for 1st level custom mappings, need to handle one-off per associated field.
      // You can possibly roll these up into one handler by adding to the includes() target,
      // but most likely will need a custom handler per non-simple mapping.
      if (['issuance'].includes(association)) {
        // Todo: make generic
        collapsed[model.name].data[i][association] = tableData[
          association
        ].data.find((row) => {
          let found = false;

          if (
            row[model.name + 'Id'] ===
            collapsed[model.name].data[i][association + 'Id']
          ) {
            found = true;
            delete row[model.name + 'Id'];
          }
          return found;
        });
      } else {
        collapsed[model.name].data[i][association + 's'] = tableData[
          association
        ].data.filter((row) => {
          let found = false;
          if (
            row[model.name + 'Id'] ===
            tableData[model.name].data[i][
              tableData[model.name].model.primaryKeyAttributes[0]
            ]
          ) {
            delete row[model.name + 'Id'];
            found = true;
          }
          return found;
        });
      }
    }
  }

  // Put any handlers for nested complex mappings here.
  for (const [i] of collapsed[model.name].data.entries()) {
    for (const { name: association } of associations) {
      if (['label'].includes(association)) {
        // Todo: make generic
        const tData = tableData['label_unit'].data.find((row) => {
          return tableData[model.name].data[i].labels
            .map((l) => l.id)
            .includes(row['labelunitId']);
        });

        collapsed[model.name].data[i][association + 's'][0]['label_unit'] =
          tData;

        collapsed[model.name].data[i].labels = collapsed[model.name].data[
          i
        ].labels.map((l) => {
          delete l.label_unit.labelunitId;
          return l;
        });
      }
    }
  }

  return collapsed;
};

export const updateTableWithData = async (tableData, model) => {
  if (!['project', 'unit'].includes(model.name)) {
    throw 'Bulk import is only supported for projects and units'; // Technically, updateTableWithData can support any model
  }
  // using a transaction ensures either everything is uploaded or everything fails
  await sequelize.transaction(async () => {
    const { orgUid } = await Organization.getHomeOrg();

    for (let [, { model, data }] of Object.values(tableData).entries()) {
      for (let row of data) {
        const existingRecord = await model.findByPk(
          row[model.primaryKeyAttributes[0]],
        );

        const exists = Boolean(existingRecord);

        // Stripping out issuanceId if its included. Need to take another look at this
        if (model.name === 'unit') {
          delete row['issuanceId'];
        }

        const validation = model.validateImport.validate(row);

        if (exists) {
          // Assert the original record is a record your allowed to modify
          await assertOrgIsHomeOrg(existingRecord.orgUid);
        } else {
          // Assign the newly created record to this home org
          row.orgUid = orgUid;
        }

        if (!validation.error) {
          await Staging.upsert({
            uuid: data[model.primaryKeyAttributes[0]],
            action: exists ? 'UPDATE' : 'INSERT',
            table: model.tableName,
            data: JSON.stringify(row),
          });
        } else {
          validation.error.message += ' on ' + model.name;
          throw validation.error;
        }
      }
    }
  });
};

const checkArrayOfArrays = (a) => {
  return a.every(function (x) {
    return Array.isArray(x);
  });
};

export const transformFullXslsToChangeList = (
  xsls,
  action,
  primaryKeyNames,
) => {
  const models = Object.keys(primaryKeyNames);
  const changeList = {};

  models.forEach((key) => {
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
      _.tail(sheet.data).forEach((row) => {
        const rows = checkArrayOfArrays(row) ? row : [row];
        return rows.forEach((r) => {
          const dataLayerKey = Buffer.from(
            `${key}_${r[primaryKeyIndex]}`,
          ).toString('hex');

          if (action === 'update') {
            changeList[key].push(
              {
                action: 'delete',
                key: dataLayerKey,
              },
              {
                action: 'insert',
                key: dataLayerKey,
                value: Buffer.from(
                  JSON.stringify(_.zipObject(headerRow, r)),
                ).toString('hex'),
              },
            );
          } else {
            changeList[key].push({
              action: action,
              key: dataLayerKey,
              value: Buffer.from(
                JSON.stringify(_.zipObject(headerRow, r)),
              ).toString('hex'),
            });
          }
        });
      });
    }
  });

  return changeList;
};
