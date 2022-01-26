'use strict';

import _ from 'lodash';

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import fileUpload from 'express-fileupload';

import { V1Router } from './v1';
import { sequelize } from '../models/database';

const app = express();

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(fileUpload());

app.use('/v1', V1Router);

sequelize.authenticate().then(() => console.log('Connected to database'));

app.use((err, req, res, next) => {
  if (err) {
    if (_.get(err, 'error.details')) {
      // format Joi validation errors
      return res.status(400).json({
        message: 'API Validation error',
        errors: err.error.details.map((detail) => detail.message),
      });
    }

    return res.status(err.status).json(err);
  }

  next();
});
export default app;
