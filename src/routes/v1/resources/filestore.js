'use strict';

import express from 'express';
import joiExpress from 'express-joi-validation';
import multer from 'multer';

const validator = joiExpress.createValidator({ passError: true });
const FileStoreRouter = express.Router();

const upload = multer();

import { FileStoreController } from '../../../controllers';
import { getFileSchema, subscribedSchema } from '../../../validations';

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

FileStoreRouter.post('/add_file', upload.single('file'), (req, res) => {
  return FileStoreController.addFileToFileStore(req, res);
});

FileStoreRouter.post(
  '/subscribe',
  validator.body(subscribedSchema),
  (req, res) => {
    return FileStoreController.subscribeToFileStore(req, res);
  },
);

FileStoreRouter.post(
  '/unsubscribe',
  validator.body(subscribedSchema),
  (req, res) => {
    return FileStoreController.unsubscribeFromFileStore(req, res);
  },
);

export { FileStoreRouter };
