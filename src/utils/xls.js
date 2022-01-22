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

export const createXlsFromSequelizeResults = (rows, model) => {
  rows = JSON.parse(JSON.stringify(rows)); // Sadly this is the best way to simplify sequelize's return shape
  console.log(typeof rows)
  
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
    // Populate main sheet values
    let xlsRow = [];
    for (const mainCol of columnsInMainSheet) {
      if (!Object.keys(sheets).includes(model.name)) {
        sheets[model.name] = { name: model.name + 's', data: [columnsInMainSheet] }; // Column headings
      }
      
      xlsRow.push(row[mainCol]);
    }
    
    // Populate associated data sheets
    for (const associatedModel of associatedModels) {
      xlsRow = [];
      // Column headings for associated sheets will be available for associated sheets once its referenced by a row
      if (!Object.keys(sheets).includes(associatedModel) && row[associatedModel].length) {
        sheets[associatedModel] = {
          name: associatedModel,
          data: [
            columnsInResults.filter(col => Object.keys(row).includes(col))
          ],
        };
      }
      
      for (const [columnName, columnValue] of Object.entries(row)) {
        if (!columnsInMainSheet.includes(columnName)) {
          xlsRow.push(columnValue);
        }
      }
  
      sheets[associatedModel].data.push(xlsRow);
    }
    
    return sheets;
  }, initialReduceValue);
  
  return xlsx.build(Object.values(xlsData));
}

