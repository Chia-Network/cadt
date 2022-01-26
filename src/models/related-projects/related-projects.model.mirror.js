'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelizeMirror, safeMirrorDbHandler } from '../database';
import ModelTypes from './related-projects.modeltypes.cjs';

class RelatedProjectMirror extends Model {}

safeMirrorDbHandler(() => {
  RelatedProjectMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'relatedProject',
    timestamps: true,
  });
});

export { RelatedProjectMirror };
