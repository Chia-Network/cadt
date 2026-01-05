import express from 'express';
import * as ProgramV2Controller from '../../../controllers/v2/program-v2.controller.js';

const ProgramV2Router = express.Router();

// CRUD routes for program
ProgramV2Router.post('/', ProgramV2Controller.create);
ProgramV2Router.get('/', ProgramV2Controller.findAll);
ProgramV2Router.get('/:id', ProgramV2Controller.findOne);
ProgramV2Router.put('/:id', ProgramV2Controller.update);
ProgramV2Router.delete('/:id', ProgramV2Controller.destroy);

export { ProgramV2Router };
