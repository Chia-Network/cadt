'use strict';

import express from 'express';
import bodyParser from 'body-parser';
import { V1Router } from './v1';
import { sequelize } from '../models/database';

const app = express();

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use('/v1', V1Router);

sequelize.authenticate().then(() => console.log('Connected to database'));

export default app;
