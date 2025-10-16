import express from 'express';
import { EstimationV2Controller } from '../../../controllers/v2/index.js';

const EstimationV2Router = express.Router();

// Create estimation
EstimationV2Router.post('/', (req, res) => {
  return EstimationV2Controller.create(req, res);
});

// Get all estimations
EstimationV2Router.get('/', (req, res) => {
  return EstimationV2Controller.findAll(req, res);
});

// Get estimation by ID
EstimationV2Router.get('/:id', (req, res) => {
  return EstimationV2Controller.findOne(req, res);
});

// Update estimation
EstimationV2Router.put('/:id', (req, res) => {
  return EstimationV2Controller.update(req, res);
});

// Delete estimation
EstimationV2Router.delete('/:id', (req, res) => {
  return EstimationV2Controller.destroy(req, res);
});

export { EstimationV2Router };
