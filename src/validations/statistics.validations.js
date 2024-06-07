import Joi from 'joi';

export const projectsStatisticsGetQuerySchema = Joi.object()
  .keys({
    dateRangeStart: Joi.date(),
    dateRangeEnd: Joi.date(),
  })
  .with('dateRangeStart', 'dateRangeEnd')
  .with('dateRangeEnd', 'dateRangeStart');
