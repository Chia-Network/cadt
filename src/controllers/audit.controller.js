import { Audit } from '../models';
import _ from 'lodash';
import {
  paginationParams,
  optionallyPaginatedResponse,
  normalizeRawTimestamps,
} from '../utils/helpers';
import { getCachedCount } from '../utils/audit-count-cache.js';
import { assertIfReadOnlyMode } from '../utils/data-assertions.js';

export const findAll = async (req, res) => {
  try {
    const { page, limit, orgUid, order, excludeChange } = req.query;

    const pagination = paginationParams(page, limit);
    const where = { orgUid };

    const queryOptions = {
      where,
      order: [['onchainConfirmationTimeStamp', order || 'DESC']],
      ...pagination,
      raw: true,
    };

    if (excludeChange) {
      queryOptions.attributes = { exclude: ['change'] };
    }

    const rows = await Audit.findAll(queryOptions);
    normalizeRawTimestamps(rows, ['createdAt', 'updatedAt']);

    // Only the paginated response needs a total; cache it so deep pagination
    // does not re-run an identical COUNT(*) on every page.
    const count = page && limit
      ? await getCachedCount(`v1:${orgUid}`, () => Audit.count({ where }))
      : rows.length;

    return res.json(optionallyPaginatedResponse({ count, rows }, page, limit));
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
