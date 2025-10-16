import express from 'express';
import { IssuanceV2Controller } from '../../../controllers/v2/index.js';

const IssuanceV2Router = express.Router();

// Create issuance
IssuanceV2Router.post('/', (req, res) => {
  return IssuanceV2Controller.create(req, res);
});

// Get all issuances
IssuanceV2Router.get('/', (req, res) => {
  return IssuanceV2Controller.findAll(req, res);
});

// Get issuance by ID
IssuanceV2Router.get('/:id', (req, res) => {
  return IssuanceV2Controller.findOne(req, res);
});

// Update issuance
IssuanceV2Router.put('/:id', (req, res) => {
  return IssuanceV2Controller.update(req, res);
});

// Delete issuance
IssuanceV2Router.delete('/:id', (req, res) => {
  return IssuanceV2Controller.destroy(req, res);
});

export { IssuanceV2Router };
