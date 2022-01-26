import _ from 'lodash';

import { Staging } from './../models';

import xlsx from 'node-xlsx';
import stream from 'stream';

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
  rows,
  model,
  hex = false,
  toStructuredCsv = false,
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
    data: [columnsInMainSheet],
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
        mainXlsRow.push(encodeValue(row[mainColName], hex));
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
  return xlsx.reduce((stagingData, { data, name }) => {
    const dataModel = [...associations(model), model].find((m) => {
      const modelName = name.slice(0, -1);
      const assocModelName = modelName.split('_');
      if (assocModelName.length > 1) {
        assocModelName[1] = capitalize(assocModelName[1]);
      }
      return m.name === name.slice(0, -1) || m.name === assocModelName.join('');
    });
    if (dataModel) {
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
          row[columnNames[columnIndex]] = columnData;
        }
        stagingData[dataModel.name].data.push(row);
      }
    }
    return stagingData;
  }, {});
};

export const updateTablesWithData = async (tableData) => {
  const allStaged = [];

  for (let [, { model, data }] of Object.values(tableData).entries()) {
    for (let row of data) {
      const exists =
        Object.keys(row).includes(model.primaryKeyAttributes[0]) &&
        row[model.primaryKeyAttributes[0]].length &&
        Boolean(await model.findByPk(row[model.primaryKeyAttributes[0]]));

      allStaged.push({
        uuid: data[model.primaryKeyAttributes[0]],
        action: exists ? 'UPDATE' : 'INSERT',
        table: model.tableName,
        row,
      });
    }
  }

  await Staging.bulkCreate(allStaged);
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

      changeList[key] = [];

      sheet.data.forEach((row) => {
        const rows = checkArrayOfArrays(row) ? row : [row];
        return (
          rows
            // filter out the header row
            .filter((r) => r[primaryKeyIndex] !== headerRow[primaryKeyIndex])
            .forEach((r) => {
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
            })
        );
      });
    }
  });

  return changeList;
};
