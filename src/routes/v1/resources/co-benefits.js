'use strict';

import express from 'express';
import { CoBenefitController } from '../../../controllers';
const CoBenifetRouter = express.Router();

CoBenifetRouter.get('/', (req, res) => {
  return req.query.id
    ? CoBenefitController.findOne(req, res)
    : CoBenefitController.findAll(req, res);
});

CoBenifetRouter.post('/', CoBenefitController.create);
CoBenifetRouter.put('/', CoBenefitController.update);
CoBenifetRouter.delete('/', CoBenefitController.destroy);

export { CoBenifetRouter };
