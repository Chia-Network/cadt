'use strict';

import express from 'express';
import bodyParser from 'body-parser';
import { V1Router } from './v1';
const app = express();

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use('/v1', V1Router);

export default app;
