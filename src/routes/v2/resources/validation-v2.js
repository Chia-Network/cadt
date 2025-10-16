import express from 'express';
import { ValidationV2Controller } from '../../../controllers/v2/index.js';

const ValidationV2Router = express.Router();

// Create validation
ValidationV2Router.post('/', (req, res) => {
  return ValidationV2Controller.create(req, res);
});

// Get all validations
ValidationV2Router.get('/', (req, res) => {
  return ValidationV2Controller.findAll(req, res);
});

// Get validation by ID
ValidationV2Router.get('/:id', (req, res) => {
  return ValidationV2Controller.findOne(req, res);
});

// Update validation
ValidationV2Router.put('/:id', (req, res) => {
  return ValidationV2Controller.update(req, res);
});

// Delete validation
ValidationV2Router.delete('/:id', (req, res) => {
  return ValidationV2Controller.destroy(req, res);
});

export { ValidationV2Router };
