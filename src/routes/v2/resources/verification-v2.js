import express from 'express';
import { VerificationV2Controller } from '../../../controllers/v2/index.js';

const VerificationV2Router = express.Router();

// Create verification
VerificationV2Router.post('/', (req, res) => {
  return VerificationV2Controller.create(req, res);
});

// Get all verifications
VerificationV2Router.get('/', (req, res) => {
  return VerificationV2Controller.findAll(req, res);
});

// Get verification by ID
VerificationV2Router.get('/:id', (req, res) => {
  return VerificationV2Controller.findOne(req, res);
});

// Update verification
VerificationV2Router.put('/:id', (req, res) => {
  return VerificationV2Controller.update(req, res);
});

// Delete verification
VerificationV2Router.delete('/:id', (req, res) => {
  return VerificationV2Controller.destroy(req, res);
});

export { VerificationV2Router };
