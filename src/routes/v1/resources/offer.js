'use strict';

import express from 'express';
import { OfferController } from '../../../controllers';

const OfferRouter = express.Router();

OfferRouter.get('/', (req, res) => {
  return OfferController.generateOfferFile(req, res);
});

OfferRouter.delete('/', (req, res) => {
  return OfferController.cancelActiveOffer(req, res);
});

export { OfferRouter };
