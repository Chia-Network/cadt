import express from 'express';
import { ActivityV2Controller } from '../../../controllers/v2/index.js';

const ActivityV2Router = express.Router();

// Create activity
ActivityV2Router.post('/', (req, res) => {
  return ActivityV2Controller.create(req, res);
});

// Get all activities
ActivityV2Router.get('/', (req, res) => {
  return ActivityV2Controller.findAll(req, res);
});

// Get activity by ID
ActivityV2Router.get('/:id', (req, res) => {
  return ActivityV2Controller.findOne(req, res);
});

// Update activity
ActivityV2Router.put('/:id', (req, res) => {
  return ActivityV2Controller.update(req, res);
});

// Delete activity
ActivityV2Router.delete('/:id', (req, res) => {
  return ActivityV2Controller.destroy(req, res);
});

export { ActivityV2Router };
