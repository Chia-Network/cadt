import express from 'express';
import joiExpress from 'express-joi-validation';
import Joi from 'joi';
import * as ProgramV2Controller from '../../../controllers/v2/program-v2.controller.js';
import { paginationSchema } from '../../../validations/v2/pagination-v2.validations.js';

const validator = joiExpress.createValidator({ passError: true });
const ProgramV2Router = express.Router();

const programGetSchema = Joi.object({
  ...paginationSchema,
  orgUid: Joi.string().optional(),
});

// CRUD routes for program
ProgramV2Router.post('/', ProgramV2Controller.create);
ProgramV2Router.get('/', validator.query(programGetSchema), ProgramV2Controller.findAll);
ProgramV2Router.get('/:id', ProgramV2Controller.findOne);
ProgramV2Router.put('/:id', ProgramV2Controller.update);
ProgramV2Router.delete('/:id', ProgramV2Controller.destroy);

export { ProgramV2Router };
