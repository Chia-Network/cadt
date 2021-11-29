'use strict';

import express from 'express';
import { CoBenifetController } from '../../../controllers';
const CoBenifetRouter = express.Router();

CoBenifetRouter.get('/', (req, res) => {
  return req.query.id
    ? CoBenifetController.findOne(req, res)
    : CoBenifetController.findAll(req, res);
});

CoBenifetRouter.post('/', CoBenifetController.create);
CoBenifetRouter.put('/', CoBenifetController.update);
CoBenifetRouter.delete('/', CoBenifetController.destroy);

export { CoBenifetRouter };
