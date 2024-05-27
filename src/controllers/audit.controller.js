import { Audit } from '../models';

import {
  paginationParams,
  optionallyPaginatedResponse,
} from '../utils/helpers';
import _ from 'lodash';
export const findAll = async (req, res) => {
  try {
    let { page, limit, orgUid, order } = req.query;

    let pagination = paginationParams(page, limit);

    const auditResults = await Audit.findAndCountAll({
      where: { orgUid },
      order: [['onchainConfirmationTimeStamp', order || 'DESC']],
      ...pagination,
    });

    return res.json(optionallyPaginatedResponse(auditResults, page, limit));
  } catch (error) {
    res.status(400).json({
      message: 'Can not retrieve audit data',
      error: error.message,
      success: false,
    });
  }
};

export const findConflicts = async (req, res) => {
  try {
    return res.json(await Audit.findConflicts());
  } catch (error) {
    res.status(400).json({
      message: 'Can not retrieve audit data',
      error: error.message,
      success: false,
    });
  }
};

export const resetToGeneration = async (req, res) => {
  try {
    const { generation, orgUid } = req.body;

    const result = await Audit.resetToGeneration(generation, orgUid);
    if (_.isNil(result)) {
      throw new Error('query failed');
    }
    return res.json({
      message: result
        ? 'reset to generation ' + String(generation)
        : 'no matching records',
      recordsDeleted: result,
      success: true,
    });
  } catch (error) {
    res.status(400).json({
      message: 'failed to change generation',
      error: error.message,
      success: false,
    });
  }
};

export const resetToDate = async (req, res) => {
  try {
    const { date, orgUid } = req.body;

    const result = orgUid
      ? await Audit.resetOrgToDate(date, orgUid)
      : await Audit.resetToDate(date);
    if (_.isNil(result)) {
      throw new Error('query failed');
    }
    return res.json({
      message: result ? 'reset to date ' + String(date) : 'no matching records',
      recordsDeleted: result,
      success: true,
    });
  } catch (error) {
    res.status(400).json({
      message: 'failed to reset to date',
      error: error.message,
      success: false,
    });
  }
};
