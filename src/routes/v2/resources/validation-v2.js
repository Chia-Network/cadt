import express from 'express';
import joiExpress from 'express-joi-validation';
import Joi from 'joi';
import * as ValidationV2Controller from '../../../controllers/v2/validation-v2.controller.js';
import { paginationSchema } from '../../../validations/v2/pagination-v2.validations.js';

const validator = joiExpress.createValidator({ passError: true });
const ValidationV2Router = express.Router();

const validationGetSchema = Joi.object({
  ...paginationSchema,
  columns: Joi.alternatives().try(
    Joi.string(),
    Joi.array().items(Joi.string()),
  ).optional(),
  orgUid: Joi.string().optional(),
  createdByOrgUid: Joi.string().optional(),
});

// CRUD routes for validation
ValidationV2Router.post('/', ValidationV2Controller.create);
ValidationV2Router.get('/', validator.query(validationGetSchema), ValidationV2Controller.findAll);
ValidationV2Router.get('/:id', ValidationV2Controller.findOne);
ValidationV2Router.put('/:id', ValidationV2Controller.update);
ValidationV2Router.delete('/:id', ValidationV2Controller.destroy);

export { ValidationV2Router };
