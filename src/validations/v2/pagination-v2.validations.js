import Joi from 'joi';

export const paginationSchema = {
  page: Joi.number().integer().min(1).required().messages({
    'number.base': 'page must be a number',
    'number.integer': 'page must be an integer',
    'number.min': 'page must be at least 1',
    'any.required': 'page is required',
  }),
  limit: Joi.number().integer().min(1).max(1000).required().messages({
    'number.base': 'limit must be a number',
    'number.integer': 'limit must be an integer',
    'number.min': 'limit must be at least 1',
    'number.max': 'limit must not exceed 1000',
    'any.required': 'limit is required',
  }),
};
