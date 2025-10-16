import express from 'express';
import { LocationV2Controller } from '../../../controllers/v2/index.js';

const LocationV2Router = express.Router();

// Create location
LocationV2Router.post('/', (req, res) => {
  return LocationV2Controller.create(req, res);
});

// Get all locations
LocationV2Router.get('/', (req, res) => {
  return LocationV2Controller.findAll(req, res);
});

// Get location by ID
LocationV2Router.get('/:id', (req, res) => {
  return LocationV2Controller.findOne(req, res);
});

// Update location
LocationV2Router.put('/:id', (req, res) => {
  return LocationV2Controller.update(req, res);
});

// Delete location
LocationV2Router.delete('/:id', (req, res) => {
  return LocationV2Controller.destroy(req, res);
});

export { LocationV2Router };
