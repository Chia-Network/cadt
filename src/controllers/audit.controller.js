import { Audit } from '../models';

import {
  paginationParams,
  optionallyPaginatedResponse,
} from '../utils/helpers';

export const findAll = async (req, res) => {
  try {
    let { page, limit, orgUid } = req.query;

    let pagination = paginationParams(page, limit);

    const auditResults = await Audit.findAndCountAll({
      where: { orgUid },
      ...pagination,
    });

    console.log(auditResults);

    return res.json(optionallyPaginatedResponse(auditResults, page, limit));
  } catch (error) {
    res.status(400).json({
      message: 'Can not retreive issuances',
      error: error.message,
    });
  }
};
