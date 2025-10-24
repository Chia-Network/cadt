import express from 'express';
import * as UnitV2Controller from '../../../controllers/v2/unit-v2.controller.js';

const UnitV2Router = express.Router();

// CRUD routes for unit
UnitV2Router.post('/', UnitV2Controller.create);
UnitV2Router.get('/', UnitV2Controller.findAll);
UnitV2Router.get('/:id', UnitV2Controller.findOne);
UnitV2Router.put('/:id', UnitV2Controller.update);
UnitV2Router.delete('/:id', UnitV2Controller.destroy);

export { UnitV2Router };
