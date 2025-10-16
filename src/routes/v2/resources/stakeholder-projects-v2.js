import express from 'express';
import { StakeholderProjectsV2Controller } from '../../../controllers/v2/index.js';

const StakeholderProjectsV2Router = express.Router();

// Create stakeholder-projects
StakeholderProjectsV2Router.post('/', (req, res) => {
  return StakeholderProjectsV2Controller.create(req, res);
});

// Get all stakeholder-projects
StakeholderProjectsV2Router.get('/', (req, res) => {
  return StakeholderProjectsV2Controller.findAll(req, res);
});

// Get stakeholder-projects by ID
StakeholderProjectsV2Router.get('/:id', (req, res) => {
  return StakeholderProjectsV2Controller.findOne(req, res);
});

// Update stakeholder-projects
StakeholderProjectsV2Router.put('/:id', (req, res) => {
  return StakeholderProjectsV2Controller.update(req, res);
});

// Delete stakeholder-projects
StakeholderProjectsV2Router.delete('/:id', (req, res) => {
  return StakeholderProjectsV2Controller.destroy(req, res);
});

export { StakeholderProjectsV2Router };
