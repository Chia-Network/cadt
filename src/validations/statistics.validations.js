import Joi from 'joi';

export const projectsStatisticsGetQuerySchema = Joi.object()
  .keys({
    status: Joi.boolean(),
    hostRegistry: Joi.boolean(),
  })
  .xor('status', 'hostRegistry');

export const tonsCo2StatisticsGetQuerySchema = Joi.object()
  .keys({
    unitStatus: Joi.string(),
    unitStatusList: Joi.array()
      .items(Joi.string())
      .min(1)
      .invalid(Joi.string().pattern(/^(?!.*\ball\b).*$/i)),
    vintageYearRangeStart: Joi.number().min(1900).max(5000),
    vintageYearRangeEnd: Joi.number().min(1900).max(5000),
    vintageYear: Joi.number().min(1900).max(5000),
    unitType: Joi.string(),
    unitTypeList: Joi.array()
      .items(Joi.string())
      .min(1)
      .invalid(Joi.string().pattern(/^(?!.*\ball\b).*$/i)),
  })
  .with('vintageYearRangeStart', 'vintageYearRangeEnd')
  .with('vintageYearRangeEnd', 'vintageYearRangeStart')
  .oxor('vintageYear', 'vintageYearRangeStart')
  .oxor('vintageYear', 'vintageYearRangeEnd')
  .oxor('unitStatus', 'unitStatusList')
  .oxor('unitType', 'unitTypeList');

export const issuedCarbonByMethodologySchema = Joi.object()
  .keys({
    methodology: Joi.string(),
    methodologyList: Joi.array().items(Joi.string()).min(1),
    vintageYearRangeStart: Joi.date(),
    vintageYearRangeEnd: Joi.date(),
    vintageYear: Joi.date(),
  })
  .with('vintageYearRangeStart', 'vintageYearRangeEnd')
  .with('vintageYearRangeEnd', 'vintageYearRangeStart')
  .oxor('vintageYear', 'vintageYearRangeStart')
  .oxor('vintageYear', 'vintageYearRangeEnd')
  .oxor('methodology', 'methodologyList');

export const issuedCarbonByProjectTypeSchema = Joi.object()
  .keys({
    projectType: Joi.string(),
    projectTypeList: Joi.array().items(Joi.string()).min(1),
    vintageYearRangeStart: Joi.number().min(1900).max(2100),
    vintageYearRangeEnd: Joi.number().min(1900).max(2100),
    vintageYear: Joi.number().min(1900).max(2100),
  })
  .with('vintageYearRangeStart', 'vintageYearRangeEnd')
  .with('vintageYearRangeEnd', 'vintageYearRangeStart')
  .oxor('vintageYear', 'vintageYearRangeStart')
  .oxor('vintageYear', 'vintageYearRangeEnd')
  .oxor('projectType', 'projectTypeList');
