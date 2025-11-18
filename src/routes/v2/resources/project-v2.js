import express from 'express';
import multer from 'multer';
import * as ProjectV2Controller from '../../../controllers/v2/project-v2.controller.js';

const ProjectV2Router = express.Router();
const upload = multer();

// Advanced routes (must come before generic :id routes)
// PUT /v2/project/transfer - Transfer project between organizations
ProjectV2Router.put('/transfer', ProjectV2Controller.transfer);

// PUT /v2/project/xlsx - Update projects from XLSX file
ProjectV2Router.put(
  '/xlsx',
  upload.single('xlsx'),
  ProjectV2Controller.updateFromXLS,
);

// POST /v2/project/batch - Batch upload projects from CSV file
ProjectV2Router.post(
  '/batch',
  upload.single('csv'),
  ProjectV2Controller.batchUpload,
);

// CRUD routes for project
ProjectV2Router.post('/', ProjectV2Controller.create);
ProjectV2Router.get('/', ProjectV2Controller.findAll);
ProjectV2Router.get('/:id', ProjectV2Controller.findOne);
ProjectV2Router.put('/:id', ProjectV2Controller.update);
ProjectV2Router.delete('/:id', ProjectV2Controller.destroy);

export { ProjectV2Router };
