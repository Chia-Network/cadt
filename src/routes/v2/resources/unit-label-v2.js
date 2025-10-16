import express from 'express';
import { UnitLabelV2Controller } from '../../../controllers/v2/index.js';

const UnitLabelV2Router = express.Router();

// Create unit-label
UnitLabelV2Router.post('/', (req, res) => {
  return UnitLabelV2Controller.create(req, res);
});

// Get all unit-labels
UnitLabelV2Router.get('/', (req, res) => {
  return UnitLabelV2Controller.findAll(req, res);
});

// Get unit-label by ID
UnitLabelV2Router.get('/:id', (req, res) => {
  return UnitLabelV2Controller.findOne(req, res);
});

// Update unit-label
UnitLabelV2Router.put('/:id', (req, res) => {
  return UnitLabelV2Controller.update(req, res);
});

// Delete unit-label
UnitLabelV2Router.delete('/:id', (req, res) => {
  return UnitLabelV2Controller.destroy(req, res);
});

export { UnitLabelV2Router };
