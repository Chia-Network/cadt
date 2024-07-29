import { Audit } from '../models/index.js';
import _ from 'lodash';
import {
  paginationParams,
  optionallyPaginatedResponse,
} from '../utils/helpers.js';
import { assertIfReadOnlyMode } from '../utils/data-assertions.js';

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
    await assertIfReadOnlyMode();
    const { generation, orgUid } = req.body;

    const result = await Audit.resetToGeneration(generation, orgUid);
    if (_.isNil(result)) {
      throw new Error('query failed');
    }
    return res.json({
      message: result
        ? 'reset to generation ' + String(generation)
        : 'no matching records',
      success: true,
    });
  } catch (error) {
    if (error.message === 'SQLITE_BUSY: database is locked') {
      res.status(400).json({
        message: 'failed to change generation',
        error: 'cadt is currently syncing, please try again later',
        success: false,
      });
    } else {
      res.status(400).json({
        message: 'failed to change generation',
        error: error.message,
        success: false,
      });
    }
  }
};

export const resetToDate = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    const { date, orgUid, includeHomeOrg } = req.body;

    const result = orgUid
      ? await Audit.resetOrgToDate(date, orgUid)
      : await Audit.resetToDate(date, includeHomeOrg);
    if (_.isNil(result)) {
      throw new Error('query failed');
    }
    return res.json({
      message: result ? 'reset to date ' + String(date) : 'no matching records',
      success: true,
    });
  } catch (error) {
    if (error.message === 'SQLITE_BUSY: database is locked') {
      res.status(400).json({
        message: 'failed to reset to date',
        error: 'cadt is currently syncing, please try again later',
        success: false,
      });
    } else {
      res.status(400).json({
        message: 'failed to reset to date',
        error: error.message,
        success: false,
      });
    }
  }
};
