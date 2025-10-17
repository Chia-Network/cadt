import express from 'express';
import { ProjectV2Controller } from '../../../controllers/v2/index.js';

const ProjectV2Router = express.Router();

// Create project
ProjectV2Router.post('/', (req, res) => {
  return ProjectV2Controller.create(req, res);
});

// Get all projects
ProjectV2Router.get('/', (req, res) => {
  return ProjectV2Controller.findAll(req, res);
});

// Get project by ID
ProjectV2Router.get('/:id', (req, res) => {
  return ProjectV2Controller.findOne(req, res);
});

// Update project
ProjectV2Router.put('/:id', (req, res) => {
  return ProjectV2Controller.update(req, res);
});

// Delete project
ProjectV2Router.delete('/:id', (req, res) => {
  return ProjectV2Controller.destroy(req, res);
});

export { ProjectV2Router };



