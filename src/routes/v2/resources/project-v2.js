import express from 'express';
import multer from 'multer';
import joiExpress from 'express-joi-validation';
import Joi from 'joi';
import * as ProjectV2Controller from '../../../controllers/v2/project-v2.controller.js';

const validator = joiExpress.createValidator({ passError: true });
const ProjectV2Router = express.Router();

const projectGetSchema = Joi.object({
  page: Joi.number().integer().min(1).when('xls', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  limit: Joi.number().integer().min(1).max(1000).when('xls', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  columns: Joi.alternatives().try(
    Joi.string(),
    Joi.array().items(Joi.string()),
  ).optional(),
  xls: Joi.boolean().optional(),
  projectIds: Joi.alternatives().try(
    Joi.string(),
    Joi.array().items(Joi.string()),
  ).optional(),
  orgUid: Joi.string().optional(),
  filter: Joi.string().optional(),
  order: Joi.string().optional(),
  search: Joi.string().optional(),
  onlyMarketplaceProjects: Joi.boolean().optional(),
});

// Configure multer with file size limit for XLSX/CSV uploads (25MB)
const upload = multer({
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit for batch uploads
});

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
ProjectV2Router.get('/', validator.query(projectGetSchema), ProjectV2Controller.findAll);
ProjectV2Router.get('/:id', ProjectV2Controller.findOne);
ProjectV2Router.put('/:id', ProjectV2Controller.update);
ProjectV2Router.delete('/:id', ProjectV2Controller.destroy);

export { ProjectV2Router };
