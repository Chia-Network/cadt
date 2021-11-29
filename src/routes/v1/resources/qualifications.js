'use strict';

import express from 'express';
import { QualificationController } from '../../../controllers';
const QualificationRouter = express.Router();

QualificationRouter.get('/', (req, res) => {
  return req.query.id
    ? QualificationController.findOne(req, res)
    : QualificationController.findAll(req, res);
});

QualificationRouter.post('/', QualificationController.create);
QualificationRouter.put('/', QualificationController.update);
QualificationRouter.delete('/', QualificationController.destroy);

export { QualificationRouter };
