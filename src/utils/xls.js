import {sequelize} from "../models/database.js";
import {Project} from "../models/index.js";

import xlsx from 'node-xlsx';
import stream from "stream";

export const sendXls = (name, bytes, response) => {
  const readStream = new stream.PassThrough();
  readStream.end(bytes);
  
  response.set('Content-disposition', 'attachment; filename=' + name + '.xls');
  response.set('Content-Type', 'text/plain');
  
  readStream.pipe(response);
}

export const encodeValue = (value, hex = false) => {
  if (hex) {
    try {
      return Buffer.from(value).toString('hex');
    } catch(e) {
      return "";
    }
    
  } else {
    return value;
  }
}

export const createXlsFromSequelizeResults = (rows, model, hex = false, csv = false) => {
  rows = JSON.parse(JSON.stringify(rows)); // Sadly this is the best way to simplify sequelize's return shape
  
  let columnsInResults = [];
  
  if (rows.length) {
    // All rows look the same.. grab the first result to determine xls schema
    columnsInResults = Object.keys(rows[0]);
  }
  
  let associations = model.getAssociatedModels();
  const columnsInMainSheet = columnsInResults.filter(col => !associations.map(a => a.name + 's').includes(col));
  const associatedModels = columnsInResults.filter(col => associations.map(a => a.name + 's').includes(col));
  
  const initialReduceValue = {}
  initialReduceValue[model.name] = { name: model.name + 's', data: [columnsInMainSheet] }
  
  const xlsData = rows.reduce((sheets, row) => {
    let mainXlsRow = [];
  
    // Populate main sheet values
    for (const [mainColName, mainCol] of columnsInMainSheet.entries()) {
      if (!associations.map(singular => singular + 's').includes(mainColName)) {
        if (row[mainCol] === null) {
          row[mainCol] = 'null';
        }
        mainXlsRow.push(encodeValue(row[mainCol], hex));
      }
    }
  
    if (mainXlsRow.length) {
      sheets[model.name].data.push(mainXlsRow);
    }
    
    // Populate associated data sheets
    for (const associatedModel of associatedModels) {
      for (const [columnName, columnValue] of Object.entries(row)) {
        if (!columnsInMainSheet.includes(columnName) && columnName === associatedModel) {
          if (Array.isArray(columnValue)) {
            // one to many
            for (const [_i, assocColVal] of columnValue.entries()) {
              const xlsRow = [];
              if (!Object.keys(sheets).includes(associatedModel)) {
                sheets[associatedModel] = { name: associatedModel, data: [Object.keys(assocColVal).concat(['projectId'])], };
              }
              for (const v of Object.values(assocColVal).map(col => col === null ? 'null': col)) {
                xlsRow.push(encodeValue(v, hex));
              }
              if (xlsRow.length > 0) {
                xlsRow.push(encodeValue(row[model.name + 'Id'], hex));
                sheets[associatedModel].data.push(xlsRow);
              }
            }
          }
        }
      }
    }
    
    return sheets;
  }, initialReduceValue);
  
  if (!csv) {
    return xlsx.build(Object.values(xlsData));
  } else {
    return Object.values(xlsData).map(({data}) => data);
  }
  
}

