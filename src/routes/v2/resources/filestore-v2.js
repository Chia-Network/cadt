'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';
import multer from 'multer';

const validator = joiExpress.createValidator({ passError: true });
const FilestoreV2Router = express.Router();

// Configure multer with file size limit for file store uploads (100MB)
const upload = multer({
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for file store
});

import * as FilestoreV2Controller from '../../../controllers/v2/filestore-v2.controller.js';
import {
  getFileSchema,
  subscribedSchema,
} from '../../../validations/v2/filestore-v2.validations.js';

// GET /v2/filestore/get_file - Get file by ID
// Note: V1 uses GET with body (unusual but matches V1 pattern)
// For testing, we also support POST to work with supertest
FilestoreV2Router.get('/get_file', validator.body(getFileSchema), (req, res) => {
  return FilestoreV2Controller.getFile(req, res);
});
FilestoreV2Router.post('/get_file', validator.body(getFileSchema), (req, res) => {
  return FilestoreV2Controller.getFile(req, res);
});

// GET /v2/filestore/get_file_list - List all files
FilestoreV2Router.get('/get_file_list', (req, res) => {
  return FilestoreV2Controller.getFileList(req, res);
});

// POST /v2/filestore/add_file - Add file to filestore (with file upload)
FilestoreV2Router.post('/add_file', upload.single('file'), (req, res) => {
  return FilestoreV2Controller.addFile(req, res);
});

// POST /v2/filestore/subscribe - Subscribe to filestore
FilestoreV2Router.post(
  '/subscribe',
  validator.body(subscribedSchema),
  (req, res) => {
    return FilestoreV2Controller.subscribeToFileStore(req, res);
  },
);

// POST /v2/filestore/unsubscribe - Unsubscribe from filestore
FilestoreV2Router.post(
  '/unsubscribe',
  validator.body(subscribedSchema),
  (req, res) => {
    return FilestoreV2Controller.unsubscribeFromFileStore(req, res);
  },
);

// DELETE /v2/filestore/delete_file - Delete file from filestore
FilestoreV2Router.delete(
  '/delete_file',
  validator.body(getFileSchema),
  (req, res) => {
    return FilestoreV2Controller.deleteFile(req, res);
  },
);

export { FilestoreV2Router };

