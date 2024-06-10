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

    if (!dateRangeStart && !dateRangeEnd && !ytd) {
      const result = await Statistics.getProjectStatistics();

      res.json({
        data: result,
        success: true,
      });
    } else if (ytd) {
      const result = await Statistics.getDateRangeProjectStatistics(
        startOfYear(new Date()),
        endOfYear(new Date()),
      );

      res.json({
        data: result,
        success: true,
      });
    } else if (startDate && endDate) {
      const result = await Statistics.getDateRangeProjectStatistics(
        startDate,
        endDate,
      );

      res.json({
        data: result,
        success: true,
      });
    } else {
      throw new Error('invalid date query params');
    }
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
      throw new Error('a home organization must exist to use this resource');
    }

    const { set, dateRangeStart, dateRangeEnd, ytd } = req.query;

    const startDate = new Date(dateRangeStart);
    const endDate = new Date(dateRangeEnd);

    if (set === 'issuedAuthorizedNdc') {
      if (!dateRangeStart && !dateRangeEnd && !ytd) {
        const result = await Statistics.getIssuedAuthorizedNdcTonsCo2();

        res.json({
          data: result,
          success: true,
        });
      } else if (ytd) {
        const result = await Statistics.getDateRangeIssuedAuthorizedNdcTonsCo2(
          startOfYear(new Date()),
          endOfYear(new Date()),
        );

        res.json({
          data: result,
          success: true,
        });
      } else if (startDate && endDate) {
        const result = await Statistics.getDateRangeIssuedAuthorizedNdcTonsCo2(
          startDate,
          endDate,
        );

        res.json({
          data: result,
          success: true,
        });
      } else {
        throw new Error('invalid query params');
      }
    } else if (set === 'retiredBuffer') {
      if (!dateRangeStart && !dateRangeEnd && !ytd) {
        const result = await Statistics.getRetiredBufferTonsCo2();

        res.json({
          data: result,
          success: true,
        });
      } else if (ytd) {
        const result = await Statistics.getDateRangeRetiredBufferTonsCo2(
          startOfYear(new Date()),
          endOfYear(new Date()),
        );

        res.json({
          data: result,
          success: true,
        });
      } else if (startDate && endDate) {
        const result = await Statistics.getDateRangeRetiredBufferTonsCo2(
          startDate,
          endDate,
        );

        res.json({
          data: result,
          success: true,
        });
      } else {
        throw new Error('invalid query params');
      }
    } else {
      throw new Error('missing "set" query parameter');
    }
  } catch (error) {
    res.status(400).json({
      message: error.message,
      success: false,
    });
  }
};

export const carbonByMethodology = async (req, res) => {
  try {
    const homeOrg = await Organization.getHomeOrg();
    if (!homeOrg?.orgUid) {
      throw new Error('a home organization must exist to use this resource');
    }

    // Your actual logic to get the carbonByMethodology data will go here.
    // This is an example placeholder.
    const placeholderCarbonByMethodology =
      'This is your carbonByMethodology data.';

    res.json({ carbonByMethodology: placeholderCarbonByMethodology });
  } catch (err) {
    res.status(500).json({
      message: 'Error retrieving Carbon by Methodology Data',
      error: err.message,
    });
  }
};
