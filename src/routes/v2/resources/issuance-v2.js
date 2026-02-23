import express from 'express';
import joiExpress from 'express-joi-validation';
import Joi from 'joi';
import * as IssuanceV2Controller from '../../../controllers/v2/issuance-v2.controller.js';
import { paginationSchema } from '../../../validations/v2/pagination-v2.validations.js';

const validator = joiExpress.createValidator({ passError: true });
const IssuanceV2Router = express.Router();

const issuanceGetSchema = Joi.object({
  ...paginationSchema,
  orgUid: Joi.string().optional(),
});

// CRUD routes for issuance
IssuanceV2Router.post('/', IssuanceV2Controller.create);
IssuanceV2Router.get('/', validator.query(issuanceGetSchema), IssuanceV2Controller.findAll);
IssuanceV2Router.get('/:id', IssuanceV2Controller.findOne);
IssuanceV2Router.put('/:id', IssuanceV2Controller.update);
IssuanceV2Router.delete('/:id', IssuanceV2Controller.destroy);

export { IssuanceV2Router };
