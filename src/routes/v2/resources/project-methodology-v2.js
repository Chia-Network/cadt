import express from 'express';
import { ProjectMethodologyV2Controller } from '../../../controllers/v2/index.js';

const ProjectMethodologyV2Router = express.Router();

// Create project-methodology
ProjectMethodologyV2Router.post('/', (req, res) => {
  return ProjectMethodologyV2Controller.create(req, res);
});

// Get all project-methodologies
ProjectMethodologyV2Router.get('/', (req, res) => {
  return ProjectMethodologyV2Controller.findAll(req, res);
});

// Get project-methodology by ID
ProjectMethodologyV2Router.get('/:id', (req, res) => {
  return ProjectMethodologyV2Controller.findOne(req, res);
});

// Update project-methodology
ProjectMethodologyV2Router.put('/:id', (req, res) => {
  return ProjectMethodologyV2Controller.update(req, res);
});

// Delete project-methodology
ProjectMethodologyV2Router.delete('/:id', (req, res) => {
  return ProjectMethodologyV2Controller.destroy(req, res);
});

export { ProjectMethodologyV2Router };
