'use strict';

import _ from 'lodash';

import { isPluralized } from './string-utils.js';
import { formatModelAssociationName } from './model-utils.js';
import { fileLoader } from './file-loader';

export const paginationParams = (page, limit) => {
  if (page === undefined || limit === undefined) {
    return {
      offset: undefined,
      limit: undefined,
    };
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
  };
};

export const optionallyPaginatedResponse = ({ count, rows }, page, limit) => {
  if (page) {
    return {
      page,
      pageCount: Math.ceil(count / (limit || 15)),
      data: rows,
    };
  } else {
    return rows;
  }
};

/**
 *
 * @param userColumns {string[]}
 * @param foreignKeys {{ model: Object, pluralize: boolean }[]}
 * @return {{include: unknown[], attributes: *}}
 */
export const columnsToInclude = (userColumns, foreignKeys) => {
  // TODO MariusD: simplify
  const attributeModelMap = foreignKeys.map(formatModelAssociationName);

  const filteredIncludes = _.intersection(userColumns, attributeModelMap).map(
    (fk) =>
      foreignKeys.find((model) => {
        return (
          model.model.name === fk ||
          (isPluralized(fk) &&
            model.model.name === fk.substring(0, fk.length - 1))
        );
      }),
  );

  return {
    attributes: userColumns.filter(
      (column) => !attributeModelMap.includes(column),
    ),
    include: filteredIncludes.map((include) => {
      if (include.pluralize) {
        return {
          model: include.model,
          as: include.model.name + 's',
        };
      }
      return include.model;
    }),
  };
};

export const getDataModelVersion = () => {
  const packageJson = fileLoader('package.json');
  const version = packageJson.version;
  const majorVersion = version.split('.')[0];
  return `v${majorVersion}`;
};
