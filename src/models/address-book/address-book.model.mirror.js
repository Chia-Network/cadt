'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelizeMirror, safeMirrorDbHandler } from '../../database';
import ModelTypes from './address-book.modeltypes.cjs';

class AddressBookMirror extends Model {}

safeMirrorDbHandler(() => {
  AddressBookMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'addressBook',
    freezeTableName: true,
    timezone: '+00:00',
    define: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_general_ci',
    },
    dialectOptions: {
      charset: 'utf8mb4',
      dateStrings: true,
      typeCast: true,
    },
  });
});

export { AddressBookMirror };
