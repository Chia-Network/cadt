'use strict';

import ModelTypes from './address-book.modeltypes.cjs';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize, safeMirrorDbHandler } from '../../database/index.js';
import { AddressBookMirror } from './address-book.model.mirror.js';

class AddressBook extends Model {
  static async create(values, options) {
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await AddressBookMirror.create(values, mirrorOptions);
    });
    return super.create(values, options);
  }

  static async update(values, options) {
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await AddressBookMirror.update(values, mirrorOptions);
    });
    return super.update(values, options);
  }

  static async destroy(options) {
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await AddressBookMirror.destroy(mirrorOptions);
    });
    return super.destroy(options);
  }
}

AddressBook.init(ModelTypes, {
  sequelize,
  modelName: 'addressBook',
  freezeTableName: true,
  timestamps: true,
  createdAt: true,
  updatedAt: true,
});

export { AddressBook };
