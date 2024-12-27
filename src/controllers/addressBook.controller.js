import _ from 'lodash';
import { AddressBook } from '../models';
import {
  paginationParams,
  optionallyPaginatedResponse,
} from '../utils/helpers';
import { genericSortColumnRegex } from '../utils/string-utils';

export const findAll = async (req, res) => {
  try {
    let { page, limit, order } = req.query;

    let pagination = paginationParams(page, limit);

    // default to DESC
    let resultOrder = [['createdAt', 'DESC']];

    if (order?.match(genericSortColumnRegex)) {
      const matches = order.match(genericSortColumnRegex);
      resultOrder = [[matches[1], matches[2]]];
    }

    let results;

    results = await AddressBook.findAndCountAll({
      order: resultOrder,
      ...pagination,
    });

    return res.json(optionallyPaginatedResponse(results, page, limit));
  } catch (error) {
    res.status(400).json({
      message: 'Can not retrieve address book data',
      error: error.message,
      success: false,
    });
  }
};

export const findOne = async (req, res) => {
  try {
    const query = {
      where: { id: req.query.id },
    };

    res.json(await AddressBook.findOne(query));
  } catch (error) {
    res.status(400).json({
      message: 'Error retrieving address',
      error: error.message,
      success: false,
    });
  }
};

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
      where: {
        id,
      },
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
