import _ from 'lodash';
import { AddressBook } from '../models';

export const create = async (req, res) => {
  try {
    const newRecord = _.cloneDeep(req.body);

    await AddressBook.create({
      name: newRecord.name,
      walletAddress: newRecord.walletAddress,
    });

    res.json({
      message: 'successfully created address book entry',
      success: true,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
      success: false,
    });
  }
};

export const update = async (req, res) => {
  try {
    const data = _.cloneDeep(req.body);
    const id = data.id;

    await AddressBook.update(
      {
        ...data,
      },
      {
        where: {
          id,
        },
      },
    );

    res.json({
      message: 'successfully updated address book entry',
      success: true,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
      success: false,
    });
  }
};

export const destroy = async (req, res) => {
  try {
    const data = _.cloneDeep(req.body);
    const id = data.id;

    const result = await AddressBook.destroy({
      id,
    });
    if (result)
      res.json({
        message: 'Address deleted successfully',
        success: true,
      });
    else res.status(204).json({ message: 'No rows deleted', success: false });
  } catch (error) {
    res.status(400).json({
      message: error.message,
      success: false,
    });
  }
};
