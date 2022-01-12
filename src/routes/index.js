'use strict';

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

app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.status(500).send({ error: err });
});
export default app;
