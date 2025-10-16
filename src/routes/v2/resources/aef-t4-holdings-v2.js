import express from 'express';
import { AefT4HoldingsV2Controller } from '../../../controllers/v2/index.js';

const AefT4HoldingsV2Router = express.Router();

// Create aef-t4-holdings
AefT4HoldingsV2Router.post('/', (req, res) => {
  return AefT4HoldingsV2Controller.create(req, res);
});

// Get all aef-t4-holdings
AefT4HoldingsV2Router.get('/', (req, res) => {
  return AefT4HoldingsV2Controller.findAll(req, res);
});

// Get aef-t4-holdings by ID
AefT4HoldingsV2Router.get('/:id', (req, res) => {
  return AefT4HoldingsV2Controller.findOne(req, res);
});

// Update aef-t4-holdings
AefT4HoldingsV2Router.put('/:id', (req, res) => {
  return AefT4HoldingsV2Controller.update(req, res);
});

// Delete aef-t4-holdings
AefT4HoldingsV2Router.delete('/:id', (req, res) => {
  return AefT4HoldingsV2Controller.destroy(req, res);
});

export { AefT4HoldingsV2Router };
