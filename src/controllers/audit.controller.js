import { Audit } from '../models';

import {
  paginationParams,
  optionallyPaginatedResponse,
} from '../utils/helpers';

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
      message: 'Can not retreive audit data',
      error: error.message,
    });
  }
};

export const findConflicts = async (req, res) => {
  try {
    return res.json(await Audit.findConflicts());
  } catch (error) {
    res.status(400).json({
      message: 'Can not retreive audit data',
      error: error.message,
    });
  }
};
