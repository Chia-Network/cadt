'use strict';

import express from 'express';
import { OfferController } from '../../../controllers/index.js';
import multer from 'multer';

const OfferRouter = express.Router();
const upload = multer();

OfferRouter.get('/', (req, res) => {
  return OfferController.generateOfferFile(req, res);
});

OfferRouter.delete('/', (req, res) => {
  return OfferController.cancelActiveOffer(req, res);
});

OfferRouter.post('/accept/import', upload.single('file'), (req, res) => {
  return OfferController.importOfferFile(req, res);
});

OfferRouter.post('/accept/commit', (req, res) => {
  return OfferController.commitImportedOfferFile(req, res);
});

OfferRouter.delete('/accept/cancel', (req, res) => {
  return OfferController.cancelImportedOfferFile(req, res);
});

OfferRouter.get('/accept', (req, res) => {
  return OfferController.getCurrentOfferInfo(req, res);
});

export { OfferRouter };
