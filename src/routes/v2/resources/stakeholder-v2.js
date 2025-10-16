import express from 'express';
import { StakeholderV2Controller } from '../../../controllers/v2/index.js';

const StakeholderV2Router = express.Router();

// Create stakeholder
StakeholderV2Router.post('/', (req, res) => {
  return StakeholderV2Controller.create(req, res);
});

// Get all stakeholders
StakeholderV2Router.get('/', (req, res) => {
  return StakeholderV2Controller.findAll(req, res);
});

// Get stakeholder by ID
StakeholderV2Router.get('/:id', (req, res) => {
  return StakeholderV2Controller.findOne(req, res);
});

// Update stakeholder
StakeholderV2Router.put('/:id', (req, res) => {
  return StakeholderV2Controller.update(req, res);
});

// Delete stakeholder
StakeholderV2Router.delete('/:id', (req, res) => {
  return StakeholderV2Controller.destroy(req, res);
});

export { StakeholderV2Router };
