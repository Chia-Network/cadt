import express from 'express';
import * as ValidationV2Controller from '../../../controllers/v2/validation-v2.controller.js';

const ValidationV2Router = express.Router();

// CRUD routes for validation
ValidationV2Router.post('/', ValidationV2Controller.create);
ValidationV2Router.get('/', ValidationV2Controller.findAll);
ValidationV2Router.get('/:id', ValidationV2Controller.findOne);
ValidationV2Router.put('/:id', ValidationV2Controller.update);
ValidationV2Router.delete('/:id', ValidationV2Controller.destroy);

export { ValidationV2Router };
