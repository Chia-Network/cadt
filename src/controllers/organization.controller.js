import _ from 'lodash';

import { Organization } from '../models/organizations';

import {
  assertHomeOrgExists,
  assertWalletIsSynced,
  assertWalletIsAvailable,
  assertDataLayerAvailable,
  assertIfReadOnlyMode,
} from '../utils/data-assertions';

export const findAll = async (req, res) => {
  return res.json(await Organization.getOrgsMap());
};

export const createV2 = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertDataLayerAvailable();
    await assertWalletIsAvailable();
    await assertWalletIsSynced();

    const myOrganization = await Organization.getHomeOrg();

    if (myOrganization) {
      return res.json({
        message: 'Your organization already exists.',
        orgId: myOrganization.orgUid,
      });
    } else {
      if (!_.get(req, 'files.svg.data')) {
        throw new Error('Missing required SVG Icon');
      }

      const { name } = req.body;
      const buffer = req.files.svg.data;
      const svgIcon = buffer.toString('utf8');

      if (!svgIcon.includes('</svg>')) {
        throw new Error('Currupted SVG Icon');
      }

      return res.json({
        message: 'New organization created successfully.',
        orgId: await Organization.createHomeOrganization(name, svgIcon, 'v1'),
      });
    }
  } catch (error) {
    console.trace(error);
    res.status(400).json({
      message: 'Error initiating your organization',
      error: error.message,
    });
  }
};

export const create = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertDataLayerAvailable();
    await assertWalletIsAvailable();
    await assertWalletIsSynced();

    const myOrganization = await Organization.getHomeOrg();

    if (myOrganization) {
      return res.json({
        message: 'Your organization already exists.',
        orgId: myOrganization.orgUid,
      });
    } else {
      const { name, icon } = req.body;
      return res.json({
        message: 'New organization created successfully.',
        orgId: await Organization.createHomeOrganization(name, icon, 'v1'),
      });
    }
  } catch (error) {
    res.status(400).json({
      message: 'Error initiating your organization',
      error: error.message,
    });
  }
};

// eslint-disable-next-line
export const importOrg = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertDataLayerAvailable();
    await assertWalletIsAvailable();
    await assertWalletIsSynced();

    const { orgUid, ip, port } = req.body;

    res.json({
      message:
        'Importing and subscribing organization this can take a few mins.',
    });

    return Organization.importOrganization(orgUid, ip, port);
  } catch (error) {
    console.trace(error);
    res.status(400).json({
      message: 'Error importing organization',
      error: error.message,
    });
  }
};

export const subscribeToOrganization = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertDataLayerAvailable();
    await assertWalletIsAvailable();
    await assertWalletIsSynced();
    await assertHomeOrgExists();

    await Organization.subscribeToOrganization(req.body.orgUid);

    return res.json({
      message: 'Subscribed to organization',
    });
  } catch (error) {
    res.status(400).json({
      message: 'Error subscribing to organization',
      error: error.message,
    });
  }
};
