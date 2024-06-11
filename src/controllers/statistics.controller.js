import { Organization, Statistics } from '../models/index.js';
import { startOfYear, endOfYear } from 'date-fns';

export const projects = async (req, res) => {
  try {
    const homeOrg = await Organization.getHomeOrg();
    if (!homeOrg?.orgUid) {
      throw new Error('a home organization must exist to use this resource');
    }

    const { dateRangeStart, dateRangeEnd, ytd } = req.query;

    const startDate = new Date(dateRangeStart);
    const endDate = new Date(dateRangeEnd);

    let result;
    if (!dateRangeStart && !dateRangeEnd && !ytd) {
      result = await Statistics.getProjectStatistics();
    } else if (ytd) {
      result = await Statistics.getDateRangeProjectStatistics(
        startOfYear(new Date()),
        endOfYear(new Date()),
      );
    } else if (startDate && endDate) {
      result = await Statistics.getDateRangeProjectStatistics(
        startDate,
        endDate,
      );
    } else {
      throw new Error('invalid date query params');
    }

    res.json({
      data: result,
      success: true,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
      success: false,
    });
  }
};

export const tonsCo2 = async (req, res) => {
  try {
    const homeOrg = await Organization.getHomeOrg();
    if (!homeOrg?.orgUid) {
      throw new Error('A home organization must exist to use this resource');
    }

    const { set, dateRangeStart, dateRangeEnd, ytd } = req.query;

    const startDate = new Date(dateRangeStart);
    const endDate = new Date(dateRangeEnd);

    let result = null;
    if (set === 'issuedAuthorizedNdc') {
      if (!dateRangeStart && !dateRangeEnd && !ytd) {
        result = await Statistics.getIssuedAuthorizedNdcTonsCo2();
      } else if (ytd) {
        result = await Statistics.getDateRangeIssuedAuthorizedNdcTonsCo2(
          startOfYear(new Date()),
          endOfYear(new Date()),
        );
      } else if (startDate && endDate) {
        result = await Statistics.getDateRangeIssuedAuthorizedNdcTonsCo2(
          startDate,
          endDate,
        );
      }
    } else if (set === 'retiredBuffer') {
      if (!dateRangeStart && !dateRangeEnd && !ytd) {
        result = await Statistics.getRetiredBufferTonsCo2();
      } else if (ytd) {
        result = await Statistics.getDateRangeRetiredBufferTonsCo2(
          startOfYear(new Date()),
          endOfYear(new Date()),
        );
      } else if (startDate && endDate) {
        result = await Statistics.getDateRangeRetiredBufferTonsCo2(
          startDate,
          endDate,
        );
      }
    } else {
      throw new Error('missing "set" query parameter');
    }

    if (!result) {
      throw new Error('invalid query params');
    }

    res.json({
      data: result,
      success: true,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
      success: false,
    });
  }
};

export const issuedCarbonByMethodology = async (req, res) => {
  try {
    const homeOrg = await Organization.getHomeOrg();
    if (!homeOrg?.orgUid) {
      throw new Error('a home organization must exist to use this resource');
    }

    const { dateRangeStart, dateRangeEnd, ytd } = req.query;

    const startDate = new Date(dateRangeStart);
    const endDate = new Date(dateRangeEnd);

    let result;
    if (!dateRangeStart && !dateRangeEnd && !ytd) {
      result = await Statistics.getProjectStatistics();
    } else if (ytd) {
      result = await Statistics.getDateRangeProjectStatistics(
        startOfYear(new Date()),
        endOfYear(new Date()),
      );
    } else if (startDate && endDate) {
      result = await Statistics.getDateRangeProjectStatistics(
        startDate,
        endDate,
      );
    } else {
      throw new Error('invalid date query params');
    }

    res.json({
      data: result,
      success: true,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
      success: false,
    });
  }
};
