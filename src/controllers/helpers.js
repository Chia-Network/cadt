'use strict';

import _ from "lodash";

export const paginationParams = (page, limit) => {
  if (page === undefined || limit === undefined) {
    return {
      offset: undefined,
      limit: undefined,
    }
  }
  
  if (page < 1) {
    page = 1;
  }

  if (limit < 1) {
    limit = 1;
  }

  return {
    limit: limit ? limit : 15,
    offset: (page ? page - 1 : 0) * limit,
  }
}

export const optionallyPaginatedResponse = ({count, rows}, page, limit) => {
  if (page) {
    return {
      page,
      pageCount: Math.ceil(count / (limit || 15)),
      data: rows,
    }
  } else {
    return rows;
  }
}

export const columnsToInclude = (userColumns, foreignKeys) => {
  const attributeModelMap = foreignKeys.map(relationship => relationship.name + 's');
  return {
    attributes: userColumns.filter(
      column => !attributeModelMap.includes(column)
    ),
    include: _.intersection(
      userColumns,
      attributeModelMap,
    ).map(fk => foreignKeys.find(model => {
      return model.name === fk.substring(0, fk.length - 1);
    }))
  }
}
