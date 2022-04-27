import _ from 'lodash';
import { sequelize } from '../database';
import { Organization } from '../models/organizations';

import {
  assertHomeOrgExists,
  assertWalletIsSynced,
  assertWalletIsAvailable,
  assertDataLayerAvailable,
  assertIfReadOnlyMode,
  assertCanDeleteOrg,
} from '../utils/data-assertions';

import { ModelKeys, Audit } from '../models';

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
      if (!_.get(req, 'files.file.data')) {
        throw new Error('Missing required Icon');
      }

      const { name } = req.body;
      const buffer = req.files.file.data;
      const icon = `data:image/png;base64, ${buffer.toString('base64')}`;

      return res.json({
        message: 'New organization created successfully.',
        orgId: await Organization.createHomeOrganization(name, icon, 'v1'),
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

export const resetHomeOrg = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertDataLayerAvailable();
    await assertWalletIsAvailable();
    await assertWalletIsSynced();

    await Organization.destroy({ where: { isHome: true } });

    res.json({
      message: 'Your home organization was reset, please create a new one.',
    });
  } catch (error) {
    res.status(400).json({
      message: 'Error resetting your organization',
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

export const deleteImportedOrg = async (req, res) => {
  let transaction;
  try {
    await assertIfReadOnlyMode();
    await assertDataLayerAvailable();
    await assertWalletIsAvailable();
    await assertWalletIsSynced();
    await assertHomeOrgExists();
    await assertCanDeleteOrg(req.body.orgUid);

    transaction = await sequelize.transaction();

    await Organization.destroy({ where: { orgUid: req.body.orgUid } });

    await Promise.all([
      ...Object.keys(ModelKeys).map(
        async (key) =>
          await ModelKeys[key].destroy({ where: { orgUid: req.body.orgUid } }),
      ),
      Audit.destroy({ where: { orgUid: req.body.orgUid } }),
    ]);

    await transaction.commit();

    return res.json({
      message:
        'UnSubscribed to organization, you will no longer receive updates.',
    });
  } catch (error) {
    res.status(400).json({
      message: 'Error unsubscribing to organization',
      error: error.message,
    });
    if (transaction) {
      await transaction.rollback();
    }
  }
};

export const unsubscribeToOrganization = async (req, res) => {
  let transaction;
  try {
    await assertIfReadOnlyMode();
    await assertDataLayerAvailable();
    await assertWalletIsAvailable();
    await assertWalletIsSynced();
    await assertHomeOrgExists();

    transaction = await sequelize.transaction();

    await Organization.update(
      { subscribed: false, registryHash: '0' },
      { where: { orgUid: req.body.orgUid } },
    );

    await Promise.all([
      ...Object.keys(ModelKeys).map(
        async (key) =>
          await ModelKeys[key].destroy({ where: { orgUid: req.body.orgUid } }),
      ),
      Audit.destroy({ where: { orgUid: req.body.orgUid } }),
    ]);

    await transaction.commit();

    return res.json({
      message:
        'UnSubscribed to organization, you will no longer receive updates.',
    });
  } catch (error) {
    res.status(400).json({
      message: 'Error unsubscribing to organization',
      error: error.message,
    });

    if (transaction) {
      await transaction.rollback();
    }
  }
};
