'use strict';

import express from 'express';
import { RelatedProjectController } from '../../../controllers';
const RelatedProjectRouter = express.Router();

RelatedProjectRouter.get('/', (req, res) => {
  return req.query.id
    ? RelatedProjectController.findOne(req, res)
    : RelatedProjectController.findAll(req, res);
});

RelatedProjectRouter.post('/', RelatedProjectController.create);
RelatedProjectRouter.put('/', RelatedProjectController.update);
RelatedProjectRouter.delete('/', RelatedProjectController.destroy);

export { RelatedProjectRouter };
