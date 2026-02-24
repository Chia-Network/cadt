import express from 'express';
import joiExpress from 'express-joi-validation';
import Joi from 'joi';
import * as MethodologyV2Controller from '../../../controllers/v2/methodology-v2.controller.js';
import { paginationSchema } from '../../../validations/v2/pagination-v2.validations.js';

const validator = joiExpress.createValidator({ passError: true });
const MethodologyV2Router = express.Router();

const methodologyGetSchema = Joi.object({
  ...paginationSchema,
  orgUid: Joi.string().optional(),
});

// CRUD routes for methodology
MethodologyV2Router.post('/', MethodologyV2Controller.create);
MethodologyV2Router.get('/', validator.query(methodologyGetSchema), MethodologyV2Controller.findAll);
MethodologyV2Router.get('/:id', MethodologyV2Controller.findOne);
MethodologyV2Router.put('/:id', MethodologyV2Controller.update);
MethodologyV2Router.delete('/:id', MethodologyV2Controller.destroy);

export { MethodologyV2Router };
