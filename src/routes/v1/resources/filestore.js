'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';

const validator = joiExpress.createValidator({ passError: true });
const FileStoreRouter = express.Router();

import { FileStoreController } from '../../../controllers';
import { getFileSchema } from '../../../validations';

FileStoreRouter.post('/get_file', validator.body(getFileSchema), (req, res) => {
  return FileStoreController.getFile(req, res);
});

FileStoreRouter.delete(
  '/delete_file',
  validator.body(getFileSchema),
  (req, res) => {
    return FileStoreController.deleteFile(req, res);
  },
);

FileStoreRouter.get('/get_file_list', (req, res) => {
  return FileStoreController.getFileList(req, res);
});

FileStoreRouter.post('/add_file', (req, res) => {
  return FileStoreController.addFileToFileStore(req, res);
});

export { FileStoreRouter };
