'use strict';

import express from 'express';
import { CoBenefitController } from '../../../controllers';
const CoBenefitRouter = express.Router();

CoBenefitRouter.get('/', (req, res) => {
  return req.query.id
    ? CoBenefitController.findOne(req, res)
    : CoBenefitController.findAll(req, res);
});

CoBenefitRouter.post('/', CoBenefitController.create);
CoBenefitRouter.put('/', CoBenefitController.update);
CoBenefitRouter.delete('/', CoBenefitController.destroy);

export { CoBenefitRouter };
