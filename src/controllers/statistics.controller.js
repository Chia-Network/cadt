import { Organization, Statistics } from '../models/index.js';

export const projects = async (req, res) => {
  try {
    const homeOrg = await Organization.getHomeOrg();
    if (!homeOrg?.orgUid) {
      throw new Error('a home organization must exist to use this resource');
    }

    const { status, hostRegistry } = req.query;

    let result;
    if (status) {
      result = await Statistics.getProjectStatusCounts();
    } else if (hostRegistry) {
      result = await Statistics.getProjectHostRegistryCounts();
    } else {
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

export const tonsCo2 = async (req, res) => {
  try {
    const homeOrg = await Organization.getHomeOrg();
    if (!homeOrg?.orgUid) {
      throw new Error('A home organization must exist to use this resource');
    }

    const {
      unitStatus,
      unitStatusList,
      unitType,
      unitTypeList,
      vintageYear,
      vintageYearRangeStart,
      vintageYearRangeEnd,
    } = req.query;

    const unitStatusArr = unitStatus ? [unitStatus] : unitStatusList;
    const unitTypeArr = unitType ? [unitType] : unitTypeList;

    const firstYear = Number.parseInt(
      vintageYear ? vintageYear : vintageYearRangeStart,
    );
    const lastYear = Number.parseInt(
      vintageYear ? vintageYear : vintageYearRangeEnd,
    );

    const result = await Statistics.getTonsCo2(
      unitStatusArr,
      unitTypeArr,
      firstYear,
      lastYear,
    );

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

    const {
      vintageYearRangeStart,
      vintageYearRangeEnd,
      vintageYear,
      methodology,
      methodologyList,
    } = req.query;

    const methodologyArr = methodology ? [methodology] : methodologyList;

    const firstYear = vintageYear ? vintageYear : vintageYearRangeStart;
    const lastYear = vintageYear ? vintageYear : vintageYearRangeEnd;

    let result;
    if (!vintageYearRangeStart && !vintageYearRangeEnd && !vintageYear) {
      result = await Statistics.getTonsCo2ByMethodology(methodologyArr);
    } else if (firstYear && lastYear) {
      result = await Statistics.getTonsCo2ByMethodology(
        methodologyArr,
        firstYear,
        lastYear,
      );
    } else {
      throw new Error('invalid date query params');
    }

    res.json({
      data: {
        issuedTonsCo2: result,
      },
      success: true,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
      success: false,
    });
  }
};

export const issuedCarbonByProjectType = async (req, res) => {
  try {
    const homeOrg = await Organization.getHomeOrg();
    if (!homeOrg?.orgUid) {
      throw new Error('a home organization must exist to use this resource');
    }

    const {
      vintageYearRangeStart,
      vintageYearRangeEnd,
      vintageYear,
      projectType,
      projectTypeList,
    } = req.query;

    const projectTypeArr = projectType ? [projectType] : projectTypeList;

    const firstYear = vintageYear ? vintageYear : vintageYearRangeStart;
    const lastYear = vintageYear ? vintageYear : vintageYearRangeEnd;

    let result;
    if (!vintageYearRangeStart && !vintageYearRangeEnd && !vintageYear) {
      result = await Statistics.getTonsCo2ByProjectType(projectTypeArr);
    } else if (firstYear && lastYear) {
      result = await Statistics.getTonsCo2ByProjectType(
        projectTypeArr,
        firstYear,
        lastYear,
      );
    } else {
      throw new Error('invalid date query params');
    }

    res.json({
      data: {
        issuedTonsCo2: result,
      },
      success: true,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
      success: false,
    });
  }
};
