'use strict';

import express from 'express';
import multer from 'multer';
import * as OfferV2Controller from '../../../controllers/v2/offer-v2.controller.js';

const OfferV2Router = express.Router();

// Configure multer with file size limit for offer files (5MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for offer files
});

// Route ordering: More specific routes MUST come before less specific routes
// This prevents Express from matching the wrong route

// 1. GET /v2/offer/accept - Get current offer info (MUST be before /)
OfferV2Router.get('/accept', (req, res) => {
  return OfferV2Controller.getCurrentOfferInfo(req, res);
});

// 2. POST /v2/offer/accept/import - Import offer file (MUST be before /accept/commit)
OfferV2Router.post('/accept/import', upload.single('file'), (req, res) => {
  return OfferV2Controller.importOfferFile(req, res);
});

// 3. POST /v2/offer/accept/commit - Commit imported offer
OfferV2Router.post('/accept/commit', (req, res) => {
  return OfferV2Controller.commitImportedOffer(req, res);
});

// 4. DELETE /v2/offer/accept/cancel - Cancel imported offer
OfferV2Router.delete('/accept/cancel', (req, res) => {
  return OfferV2Controller.cancelImportedOffer(req, res);
});

// 5. GET /v2/offer - Generate offer file
OfferV2Router.get('/', (req, res) => {
  return OfferV2Controller.generateOfferFile(req, res);
});

// 6. DELETE /v2/offer - Cancel active offer
OfferV2Router.delete('/', (req, res) => {
  return OfferV2Controller.cancelActiveOffer(req, res);
});

export { OfferV2Router };

