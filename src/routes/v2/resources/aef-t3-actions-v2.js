import express from 'express';
import { AefT3ActionsV2Controller } from '../../../controllers/v2/index.js';

const AefT3ActionsV2Router = express.Router();

// Create aef-t3-actions
AefT3ActionsV2Router.post('/', (req, res) => {
  return AefT3ActionsV2Controller.create(req, res);
});

// Get all aef-t3-actions
AefT3ActionsV2Router.get('/', (req, res) => {
  return AefT3ActionsV2Controller.findAll(req, res);
});

// Get aef-t3-actions by ID
AefT3ActionsV2Router.get('/:id', (req, res) => {
  return AefT3ActionsV2Controller.findOne(req, res);
});

// Update aef-t3-actions
AefT3ActionsV2Router.put('/:id', (req, res) => {
  return AefT3ActionsV2Controller.update(req, res);
});

// Delete aef-t3-actions
AefT3ActionsV2Router.delete('/:id', (req, res) => {
  return AefT3ActionsV2Controller.destroy(req, res);
});

export { AefT3ActionsV2Router };
