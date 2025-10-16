import express from 'express';
import { AefT5AuthorizedEntitiesV2Controller } from '../../../controllers/v2/index.js';

const AefT5AuthorizedEntitiesV2Router = express.Router();

// Create aef-t5-authorized-entities
AefT5AuthorizedEntitiesV2Router.post('/', (req, res) => {
  return AefT5AuthorizedEntitiesV2Controller.create(req, res);
});

// Get all aef-t5-authorized-entities
AefT5AuthorizedEntitiesV2Router.get('/', (req, res) => {
  return AefT5AuthorizedEntitiesV2Controller.findAll(req, res);
});

// Get aef-t5-authorized-entities by ID
AefT5AuthorizedEntitiesV2Router.get('/:id', (req, res) => {
  return AefT5AuthorizedEntitiesV2Controller.findOne(req, res);
});

// Update aef-t5-authorized-entities
AefT5AuthorizedEntitiesV2Router.put('/:id', (req, res) => {
  return AefT5AuthorizedEntitiesV2Controller.update(req, res);
});

// Delete aef-t5-authorized-entities
AefT5AuthorizedEntitiesV2Router.delete('/:id', (req, res) => {
  return AefT5AuthorizedEntitiesV2Controller.destroy(req, res);
});

export { AefT5AuthorizedEntitiesV2Router };
