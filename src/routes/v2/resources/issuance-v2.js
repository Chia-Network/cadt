import express from 'express';
import * as IssuanceV2Controller from '../../../controllers/v2/issuance-v2.controller.js';

const IssuanceV2Router = express.Router();

// CRUD routes for issuance
IssuanceV2Router.post('/', IssuanceV2Controller.create);
IssuanceV2Router.get('/', IssuanceV2Controller.findAll);
IssuanceV2Router.get('/:id', IssuanceV2Controller.findOne);
IssuanceV2Router.put('/:id', IssuanceV2Controller.update);
IssuanceV2Router.delete('/:id', IssuanceV2Controller.destroy);

export { IssuanceV2Router };
