import { Governance } from '../models';

export const findAll = async (req, res) => {
  try {
    const results = await Governance.findAll();
    return res.json(results);
  } catch (error) {
    res.status(400).json({
      message: 'Can not retreive issuances',
      error: error.message,
    });
  }
};

// eslint-disable-next-line
export const createGoveranceBody = async (req, res) => {};

// eslint-disable-next-line
export const setDefaultOrgList = async (req, res) => {};

// eslint-disable-next-line
export const setPickList = async (req, res) => {};

// eslint-disable-next-line
export const subscribeToGovernanceBody = async (req, res) => {};
