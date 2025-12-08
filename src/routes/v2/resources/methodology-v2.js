import express from 'express';
import * as MethodologyV2Controller from '../../../controllers/v2/methodology-v2.controller.js';

const MethodologyV2Router = express.Router();

// CRUD routes for methodology
MethodologyV2Router.post('/', MethodologyV2Controller.create);
MethodologyV2Router.get('/', MethodologyV2Controller.findAll);
MethodologyV2Router.get('/:id', MethodologyV2Controller.findOne);
MethodologyV2Router.put('/:id', MethodologyV2Controller.update);
MethodologyV2Router.delete('/:id', MethodologyV2Controller.destroy);

export { MethodologyV2Router };
