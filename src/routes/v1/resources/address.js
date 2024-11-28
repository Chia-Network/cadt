'use strict';

import express from 'express';
import { AddressBookController } from '../../../controllers';
import joiExpress from 'express-joi-validation';

import {
  addressBookPostSchema,
  addressBookGetQuerySchema,
  addressBookUpdateSchema,
  addressBookDeleteSchema,
} from '../../../validations';

const validator = joiExpress.createValidator({ passError: true });
const AddressBookRouter = express.Router();

AddressBookRouter.get(
  '/',
  validator.query(addressBookGetQuerySchema),
  (req, res) => {
    return AddressBookController.findAll(req, res);
  },
);

AddressBookRouter.post(
  '/',
  validator.body(addressBookPostSchema),
  AddressBookController.create,
);

AddressBookRouter.put(
  '/',
  validator.body(addressBookUpdateSchema),
  (req, res) => AddressBookController.update(req, res, false),
);

AddressBookRouter.delete(
  '/',
  validator.body(addressBookDeleteSchema),
  AddressBookController.destroy,
);

export { AddressBookRouter };
