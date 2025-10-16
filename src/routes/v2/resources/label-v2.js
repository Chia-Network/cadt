import express from 'express';
import { LabelV2Controller } from '../../../controllers/v2/index.js';

const LabelV2Router = express.Router();

// Create label
LabelV2Router.post('/', (req, res) => {
  return LabelV2Controller.create(req, res);
});

// Get all labels
LabelV2Router.get('/', (req, res) => {
  return LabelV2Controller.findAll(req, res);
});

// Get label by ID
LabelV2Router.get('/:id', (req, res) => {
  return LabelV2Controller.findOne(req, res);
});

// Update label
LabelV2Router.put('/:id', (req, res) => {
  return LabelV2Controller.update(req, res);
});

// Delete label
LabelV2Router.delete('/:id', (req, res) => {
  return LabelV2Controller.destroy(req, res);
});

export { LabelV2Router };
