import express from 'express';
import * as ProjectV2Controller from '../../../controllers/v2/project-v2.controller.js';

const ProjectV2Router = express.Router();

// CRUD routes for project
ProjectV2Router.post('/', ProjectV2Controller.create);
ProjectV2Router.get('/', ProjectV2Controller.findAll);
ProjectV2Router.get('/:id', ProjectV2Controller.findOne);
ProjectV2Router.put('/:id', ProjectV2Controller.update);
ProjectV2Router.delete('/:id', ProjectV2Controller.destroy);

export { ProjectV2Router };
