import express from 'express';
import multer from 'multer';
import * as OfferV2Controller from '../../../controllers/v2/offer-v2.controller.js';

const OfferV2Router = express.Router();
const upload = multer();

// Generate offer (maker)
OfferV2Router.get('/', (req, res) => {
  return OfferV2Controller.generateOfferFile(req, res);
});

// Cancel active offer (maker)
OfferV2Router.delete('/', (req, res) => {
  return OfferV2Controller.cancelActiveOffer(req, res);
});

// Import offer (taker)
OfferV2Router.post('/accept/import', upload.single('file'), (req, res) => {
  return OfferV2Controller.importOfferFile(req, res);
});

// Commit offer (taker)
OfferV2Router.post('/accept/commit', (req, res) => {
  return OfferV2Controller.commitImportedOfferFile(req, res);
});

// Cancel imported offer (taker)
OfferV2Router.delete('/accept/cancel', (req, res) => {
  return OfferV2Controller.cancelImportedOfferFile(req, res);
});

// Get offer info
OfferV2Router.get('/accept', (req, res) => {
  return OfferV2Controller.getCurrentOfferInfo(req, res);
});

export { OfferV2Router };
