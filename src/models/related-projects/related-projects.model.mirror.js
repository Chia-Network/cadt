'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelizeMirror } from '../database';
import ModelTypes from './related-projects.modeltypes.cjs';

class RelatedProjectMirror extends Model {}

if (process.env.DB_USE_MIRROR === 'true') {
  RelatedProjectMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'relatedProject',
  });
}

export { RelatedProjectMirror };
