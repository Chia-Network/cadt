import express from 'express';
import { UnitV2Controller } from '../../../controllers/v2/index.js';

const UnitV2Router = express.Router();

// Create unit
UnitV2Router.post('/', (req, res) => {
  return UnitV2Controller.create(req, res);
});

// Get all units
UnitV2Router.get('/', (req, res) => {
  return UnitV2Controller.findAll(req, res);
});

// Get unit by ID
UnitV2Router.get('/:id', (req, res) => {
  return UnitV2Controller.findOne(req, res);
});

// Update unit
UnitV2Router.put('/:id', (req, res) => {
  return UnitV2Controller.update(req, res);
});

// Delete unit
UnitV2Router.delete('/:id', (req, res) => {
  return UnitV2Controller.destroy(req, res);
});

export { UnitV2Router };
