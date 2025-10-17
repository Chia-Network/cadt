import express from 'express';
import { ProgramV2Controller } from '../../../controllers/v2/index.js';

const ProgramV2Router = express.Router();

// Create program
ProgramV2Router.post('/', (req, res) => {
  return ProgramV2Controller.create(req, res);
});

// Get all programs
ProgramV2Router.get('/', (req, res) => {
  return ProgramV2Controller.findAll(req, res);
});

// Get program by ID
ProgramV2Router.get('/:id', (req, res) => {
  return ProgramV2Controller.findOne(req, res);
});

// Update program
ProgramV2Router.put('/:id', (req, res) => {
  return ProgramV2Controller.update(req, res);
});

// Delete program
ProgramV2Router.delete('/:id', (req, res) => {
  return ProgramV2Controller.destroy(req, res);
});

export { ProgramV2Router };
