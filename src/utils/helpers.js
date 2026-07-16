'use strict';

import _ from 'lodash';

import { isPluralized } from './string-utils.js';
import { formatModelAssociationName } from './model-utils.js';
import packageJson from '../../package.json' with { type: 'json' };

export const convertToMySQLDatetime = (date) => {
  const originalDate = new Date(date);
  originalDate.setMilliseconds(0);
  const formattedDate = originalDate
    .toISOString()
    .replace('T', ' ')
    .replace('Z', '')
    .split('.')[0];
  return formattedDate;
};

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

// `raw: true` rows return DATE columns as the dialect's stored value (SQLite
// hands back a "YYYY-MM-DD HH:mm:ss.SSS +00:00" string) instead of a Date,
// which would serialize differently from the prior Sequelize-instance ISO-8601
// output. Re-normalize the given fields in place so the wire format is
// unchanged. Mutates rows; unparseable/absent values are left as-is.
export const normalizeRawTimestamps = (rows, fields) => {
  for (const row of rows) {
    for (const field of fields) {
      const value = row[field];
      if (value == null) continue;
      const date = value instanceof Date ? value : new Date(value);
      if (!Number.isNaN(date.getTime())) {
        row[field] = date.toISOString();
      }
    }
  }
  return rows;
};

export const normalizeApiTimestampFields = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeApiTimestampFields(item));
  }

  if (value instanceof Date || value === null || typeof value !== 'object') {
    return value;
  }

  if (typeof value.toJSON === 'function' && value.dataValues) {
    return normalizeApiTimestampFields(value.toJSON());
  }

  if (Object.prototype.toString.call(value) !== '[object Object]') {
    return value;
  }

  const normalized = { ...value };
  for (const [key, item] of Object.entries(value)) {
    if (key === 'diff') {
      continue;
    }

    if (
      Array.isArray(item)
      || item?.dataValues
      || (
        Object.prototype.toString.call(item) === '[object Object]'
        && (item.created_at !== undefined || item.updated_at !== undefined)
      )
    ) {
      normalized[key] = normalizeApiTimestampFields(item);
    }
  }

  if (normalized.createdAt === undefined && normalized.created_at !== undefined) {
    normalized.createdAt = normalized.created_at;
  }
  if (normalized.updatedAt === undefined && normalized.updated_at !== undefined) {
    normalized.updatedAt = normalized.updated_at;
  }

  delete normalized.created_at;
  delete normalized.updated_at;

  return normalized;
};

/**
 *
 * @param userColumns {string[]}
 * @param foreignKeys {{ model: Object, pluralize: boolean }[]}
 * @param parentModel {Object} - Optional parent model to look up association aliases
 * @return {{include: unknown[], attributes: *}}
 */
export const columnsToInclude = (userColumns, foreignKeys, parentModel = null) => {
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
        // Find the correct association alias from the parent model's associations
        let alias = include.model.name + 's'; // fallback to default

        // Known mappings for ProjectV2 associations (fallback if association lookup fails)
        const projectV2ModelToAliasMap = {
          LocationV2: 'locations',
          EstimationV2: 'estimations',
          RatingV2: 'ratings',
          CoBenefitV2: 'coBenefits',
        };

        if (parentModel && parentModel.associations) {
          // Look through parent model's associations to find one that matches this model
          for (const [assocName, assoc] of Object.entries(parentModel.associations)) {
            // Check if this association targets the model we're looking for
            // Sequelize stores the target model in assoc.target
            const targetModel = assoc.target;
            if (targetModel && (targetModel === include.model || (targetModel.name && targetModel.name === include.model.name))) {
              alias = assocName;
              break;
            }
          }
        }

        // Fallback: if parentModel is ProjectV2 and we have a known mapping, use it
        if (alias === include.model.name + 's' && parentModel && parentModel.name === 'ProjectV2') {
          if (projectV2ModelToAliasMap[include.model.name]) {
            alias = projectV2ModelToAliasMap[include.model.name];
          }
        }

        return {
          model: include.model,
          as: alias,
        };
      }
      return include.model;
    }),
  };
};

export const getDataModelVersion = () => {
  const version = packageJson.version;
  const majorVersion = version.split('.')[0];
  return `v${majorVersion}`;
};

/**
 * the issuance table does not allow the verificationBody to be null. by requirement this field is nullable.
 * this function defines null or undefined verificationBody for all issuances that exist in a staged record
 * @param stagedItem from the staging table
 */
export const updateNilVerificationBodyAsEmptyString = (stagedItem) => {
  try {
    if (stagedItem?.data) {
      const data = JSON.parse(stagedItem.data);
      data?.forEach((changeRecord) => {
        if (stagedItem?.table === 'Projects') {
          changeRecord?.issuances?.forEach((issuance) => {
            if (!issuance?.verificationBody) {
              issuance.verificationBody = '';
            }
          });
        } else if (stagedItem?.table === 'Units') {
          if (data?.issuance && !data.issuance?.verificationBody) {
            data.issuance.verificationBody = '';
          }
        }
      });
      stagedItem.data = JSON.stringify(data);
    }
  } catch {
    return;
  }
};

/**
 * merges the source into the target without altering the data already present in target
 * @param target {object}
 * @param source {object}
 * @returns {void}
 */
export function mergeObjects(target, source) {
  if (typeof target !== 'object' || target === null) {
    return;
  }
  if (typeof source !== 'object' || source === null) {
    return;
  }

  for (let key of Object.keys(source)) {
    if (typeof source[key] === 'object' && source[key] !== null) {
      if (
        !(key in target) ||
        typeof target[key] !== 'object' ||
        target[key] === null
      ) {
        target[key] = {};
      }
      // Recursively merge the structure
      mergeObjects(target[key], source[key]);
    } else {
      // If it's a primitive in source and doesn't exist in target, copy it
      if (!(key in target)) {
        target[key] = source[key];
      }
    }
  }
}
