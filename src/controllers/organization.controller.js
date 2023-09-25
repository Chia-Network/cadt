import { sequelize } from '../database';
import { Organization } from '../models/organizations';

import {
  assertHomeOrgExists,
  assertWalletIsSynced,
  assertIfReadOnlyMode,
  assertCanDeleteOrg,
  assertNoPendingCommits,
} from '../utils/data-assertions';

import { getDataModelVersion } from '../utils/helpers';

import { ModelKeys, Audit, Staging } from '../models';

export const findAll = async (req, res) => {
  return res.json(await Organization.getOrgsMap());
};

export const editHomeOrg = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertWalletIsSynced();
    await assertHomeOrgExists();

    const { name } = req.body;

    let icon;

    if (req.file) {
      const buffer = req.file.buffer;
      icon = `data:image/png;base64, ${buffer.toString('base64')}`;
    } else {
      icon = '';
    }

    Organization.editOrgMeta({ name, icon });

    return res.json({
      message: 'Home org currently being updated, will be completed soon.',
      success: true
    });
  } catch (error) {
    console.trace(error);
    res.status(400).json({
      message: 'Error initiating your organization',
      error: error.message,
      success: false,
    });
  }
};

export const createV2 = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertWalletIsSynced();
    await assertNoPendingCommits();

    const myOrganization = await Organization.getHomeOrg();

    if (myOrganization) {
      return res.json({
        message: 'Your organization already exists.',
        orgId: myOrganization.orgUid,
      });
    } else {
      const { name } = req.body;
      let icon;

      if (req.file) {
        const buffer = req.file.buffer;
        icon = `data:image/png;base64, ${buffer.toString('base64')}`;
      } else {
        icon = '';
      }

      const dataModelVersion = getDataModelVersion();

      Organization.createHomeOrganization(name, icon, dataModelVersion);

      return res.json({
        message:
          'New organization is currently being created. It can take up to 30 mins. Please do not interrupt this process.',
      });
    }
  } catch (error) {
    console.trace(error);
    res.status(400).json({
      message: 'Error initiating your organization',
      error: error.message,
      success: false,
    });
  }
};

export const create = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertWalletIsSynced();

    const myOrganization = await Organization.getHomeOrg();

    if (myOrganization) {
      return res.json({
        message: 'Your organization already exists.',
        orgId: myOrganization.orgUid,
      });
    } else {
      const { name, icon } = req.body;
      const dataModelVersion = getDataModelVersion();

      return res.json({
        message: 'New organization created successfully.',
        orgId: await Organization.createHomeOrganization(
          name,
          icon,
          dataModelVersion,
        ),
      });
    }
  } catch (error) {
    res.status(400).json({
      message: 'Error initiating your organization',
      error: error.message,
      success: false,
    });
  }
};

export const resetHomeOrg = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertWalletIsSynced();

    await Promise.all([
      Organization.destroy({ where: { isHome: true } }),
      Staging.destroy({
        where: {},
        truncate: true,
      }),
    ]);

    res.json({
      message: 'Your home organization was reset, please create a new one.',
    });
  } catch (error) {
    res.status(400).json({
      message: 'Error resetting your organization',
      error: error.message,
      success: false,
    });
  }
};

export const importOrg = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertWalletIsSynced();

    const { orgUid } = req.body;

    res.json({
      message:
        'Importing and subscribing organization this can take a few mins.',
    });

    return Organization.importOrganization(orgUid);
  } catch (error) {
    console.trace(error);
    res.status(400).json({
      message: 'Error importing organization',
      error: error.message,
      success: false,
    });
  }
};

export const importHomeOrg = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertWalletIsSynced();

    const { orgUid } = req.body;

    await Organization.importHomeOrg(orgUid);

    res.json({
      message: 'Importing home organization.',
    });
  } catch (error) {
    console.trace(error);
    res.status(400).json({
      message: 'Error importing organization',
      error: error.message,
      success: false,
    });
  }
};

export const subscribeToOrganization = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
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
      success: false,
    });
  }
};

export const deleteImportedOrg = async (req, res) => {
  let transaction;
  try {
    await assertIfReadOnlyMode();
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
      success: false,
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
      success: false,
    });

    if (transaction) {
      await transaction.rollback();
    }
  }
};

export const resyncOrganization = async (req, res) => {
  let transaction;
  try {
    await assertIfReadOnlyMode();
    await assertWalletIsSynced();
    await assertHomeOrgExists();

    transaction = await sequelize.transaction();

    await Organization.update(
      { registryHash: '0' },
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
      message: 'Resyncing organization completed',
    });
  } catch (error) {
    res.status(400).json({
      message: 'Error resyncing organization',
      error: error.message,
      success: false,
    });

    if (transaction) {
      await transaction.rollback();
    }
  }
};

export const addMetadata = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertWalletIsSynced();
    await assertHomeOrgExists();

    Organization.addMetadata(req.body);

    return res.json({
      message: 'Home org currently being updated, will be completed soon.',
      success: true
    });
  } catch (error) {
    console.trace(error);
    res.status(400).json({
      message: 'Error adding metadata to your organization',
      error: error.message,
      success: false,
    });
  }
};

export const addMirror = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertWalletIsSynced();
    await assertHomeOrgExists();

    await Organization.addMirror(req.body.storeId, req.body.url);
    return res.json({
      message: `Mirror added for ${req.body.storeId}.`,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Error adding mirror',
      error: error.message,
      success: false,
    });
  }
};

export const getMetaData = async (req, res) => {
  try {
    await assertWalletIsSynced();

    const organization = await Organization.findOne({
      where: { orgUid: req.query.orgUid },
    });

    return res.json(JSON.parse(organization.metadata));
  } catch (error) {
    res.status(400).json({
      message: 'Error getting metadata for organization',
      error: error.message,
      success: false,
    });
  }
};

export const removeMirror = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertWalletIsSynced();
    await assertHomeOrgExists();

    await Organization.removeMirror(req.body.storeId, req.body.coinId);
    return res.json({
      message: `Mirror removed for ${req.body.storeId}.`,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Error removing mirror for organization',
      success: false,
    });
  }
};

export const sync = async (req, res) => {
  try {
    Organization.syncOrganizationMeta();
    return res.json({
      message: 'Syncing All Organizations Metadata',
    });
  } catch (error) {
    res.status(400).json({
      message: 'Cant All Organizations Metadata',
      error: error.message,
      success: false,
    });
  }
};
