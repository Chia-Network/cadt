import express from 'express';
import multer from 'multer';
import joiExpress from 'express-joi-validation';
import * as UnitV2Controller from '../../../controllers/v2/unit-v2.controller.js';
import { unitV2QuerySchema } from '../../../validations/v2/unit-v2.validations.js';

const validator = joiExpress.createValidator({ passError: true });
const UnitV2Router = express.Router();

// Configure multer with file size limit for XLSX/CSV uploads (25MB)
const upload = multer({
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit for batch uploads
});

// Advanced routes (must come before generic :id routes)
// POST /v2/unit/split - Split unit into multiple units
UnitV2Router.post('/split', UnitV2Controller.split);

// PUT /v2/unit/xlsx - Update units from XLSX file
UnitV2Router.put(
  '/xlsx',
  upload.single('xlsx'),
  UnitV2Controller.updateFromXLS,
);

// POST /v2/unit/batch - Batch upload units from CSV file
UnitV2Router.post(
  '/batch',
  upload.single('csv'),
  UnitV2Controller.batchUpload,
);

// CRUD routes for unit
UnitV2Router.post('/', UnitV2Controller.create);
UnitV2Router.get('/', validator.query(unitV2QuerySchema), UnitV2Controller.findAll);
UnitV2Router.get('/:id', UnitV2Controller.findOne);
UnitV2Router.put('/:id', UnitV2Controller.update);
UnitV2Router.delete('/:id', UnitV2Controller.destroy);

export { UnitV2Router };
