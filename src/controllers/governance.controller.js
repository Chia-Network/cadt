import _ from 'lodash';

import { Governance } from '../models';

import {
  assertIsActiveGovernanceBody,
  assertIfReadOnlyMode,
  assertWalletIsSynced,
  assertCanBeGovernanceBody,
} from '../utils/data-assertions';

export const findAll = async (req, res) => {
  try {
    const results = await Governance.findAll();
    return res.json(results);
  } catch (error) {
    res.status(400).json({
      message: 'Can not retreive Governance Data',
      error: error.message,
    });
  }
};

export const findOrgList = async (req, res) => {
  try {
    const results = await Governance.findOne({ where: { metaKey: 'orgList' } });
    return res.json(JSON.parse(_.get(results, 'metaValue', {})));
  } catch (error) {
    res.status(400).json({
      message: 'Can not retreive Governance Data',
      error: error.message,
    });
  }
};

export const findPickList = async (req, res) => {
  try {
    const results = await Governance.findOne({
      where: { metaKey: 'pickList' },
    });
    return res.json(JSON.parse(_.get(results, 'metaValue', {})));
  } catch (error) {
    res.status(400).json({
      message: 'Can not retreive Governance Data',
      error: error.message,
    });
  }
};

// eslint-disable-next-line
export const createGoveranceBody = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertWalletIsSynced();
    await assertCanBeGovernanceBody();

    await Governance.createGoveranceBody();

    return res.json({
      message:
        'Setting up new Governance Body on this node, this can tae a few mins',
    });
  } catch (error) {
    res.status(400).json({
      message: 'Cant update default orgs',
      error: error.message,
    });
  }
};

// eslint-disable-next-line
export const setDefaultOrgList = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertWalletIsSynced();
    await assertIsActiveGovernanceBody();

    const orgList = JSON.stringify(req.body);

    await Governance.updateGoveranceBodyData([
      { key: 'orgList', value: orgList },
    ]);

    return res.json({
      message: 'Committed this new organization list to the datalayer',
    });
  } catch (error) {
    console.trace(error);
    res.status(400).json({
      message: 'Cant update default orgs',
      error: error.message,
    });
  }
};

// eslint-disable-next-line
export const setPickList = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertWalletIsSynced();
    await assertIsActiveGovernanceBody();

    const pickList = JSON.stringify(req.body);

    await Governance.updateGoveranceBodyData([
      { key: 'pickList', value: pickList },
    ]);

    return res.json({
      message: 'Committed this pick list to the datalayer',
    });
  } catch (error) {
    res.status(400).json({
      message: 'Cant update picklist',
      error: error.message,
    });
  }
};
