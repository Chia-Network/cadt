'use strict';

import express from 'express';
import { RatingController } from '../../../controllers';
const RatingRouter = express.Router();

RatingRouter.get('/', (req, res) => {
  return req.query.id
    ? RatingController.findOne(req, res)
    : RatingController.findAll(req, res);
});

RatingRouter.post('/', RatingController.create);
RatingRouter.put('/', RatingController.update);
RatingRouter.delete('/', RatingController.destroy);

export { RatingRouter };
