import express from 'express';
import { MethodologyV2Controller } from '../../../controllers/v2/index.js';

const MethodologyV2Router = express.Router();

// Create methodology
MethodologyV2Router.post('/', (req, res) => {
  return MethodologyV2Controller.create(req, res);
});

// Get all methodologies
MethodologyV2Router.get('/', (req, res) => {
  return MethodologyV2Controller.findAll(req, res);
});

// Get methodology by ID
MethodologyV2Router.get('/:id', (req, res) => {
  return MethodologyV2Controller.findOne(req, res);
});

// Update methodology
MethodologyV2Router.put('/:id', (req, res) => {
  return MethodologyV2Controller.update(req, res);
});

// Delete methodology
MethodologyV2Router.delete('/:id', (req, res) => {
  return MethodologyV2Controller.destroy(req, res);
});

export { MethodologyV2Router };
