import { sequelize } from '../database';
import { Organization } from '../models/organizations';
import datalayer from '../datalayer';

import {
  assertHomeOrgExists,
  assertIfReadOnlyMode,
  assertNoPendingCommits,
  assertOrgDoesNotExist,
  assertWalletIsSynced,
} from '../utils/data-assertions';

import { getDataModelVersion } from '../utils/helpers';

import { Audit, ModelKeys, Staging } from '../models';
import { getOwnedStores, getSubscriptions } from '../datalayer/persistance.js';

export const findAll = async (req, res) => {
  return res.json(await Organization.getOrgsMap());
};

export const homeOrgSyncStatus = async (req, res) => {
  try {
    await assertHomeOrgExists();
    const walletSynced = await datalayer.walletIsSynced();
    const homeOrg = await Organization.getHomeOrg();
    const pendingCommitsCount = await Staging.count({
      where: { commited: true },
    });

    const { sync_status } = await datalayer.getSyncStatus(homeOrg.orgUid);

    return res.json({
      ready:
        walletSynced && Boolean(homeOrg?.synced) && pendingCommitsCount === 0,
      status: {
        wallet_synced: walletSynced,
        home_org_synced: Boolean(homeOrg?.synced),
        pending_commits: pendingCommitsCount,
        home_org_profile_synced:
          sync_status.target_root_hash === homeOrg.orgHash?.split('0x')?.[1],
      },
      success: true,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
      success: false,
    });
  }
};

export const editHomeOrg = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertWalletIsSynced();
    await assertHomeOrgExists();

    const { name, prefix } = req.body;

    let icon;

    if (req.file) {
      const buffer = req.file.buffer;
      icon = `data:image/png;base64, ${buffer.toString('base64')}`;
    } else {
      icon = '';
    }

    Organization.editOrgMeta({ name, icon, prefix });

    return res.json({
      message: 'Home org currently being updated, will be completed soon.',
      success: true,
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
        success: false,
      });
    } else {
      const { name, prefix } = req.body;
      let icon;

      if (req.file) {
        const buffer = req.file.buffer;
        icon = `data:image/png;base64, ${buffer.toString('base64')}`;
      } else {
        icon = '';
      }

      const dataModelVersion = getDataModelVersion();

      Organization.createHomeOrganization({
        name,
        prefix,
        icon,
        dataModelVersion,
      });

      return res.json({
        message:
          'New organization is currently being created. It can take up to 30 mins. Please do not interrupt this process.',
        success: true,
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
        success: false,
      });
    } else {
      const { name, icon, prefix } = req.body;
      const dataModelVersion = getDataModelVersion();

      return res.json({
        message: 'New organization created successfully.',
        success: true,
        orgId: await Organization.createHomeOrganization({
          name,
          icon,
          dataModelVersion,
          prefix,
        }),
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

export const importOrganization = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertWalletIsSynced();

    const { orgUid, isHome } = req.body;
    await assertOrgDoesNotExist(orgUid);

    await Organization.importOrganization(orgUid, isHome);

    res.status(200).json({
      message: `Successfully imported ${isHome ? 'home' : ''} organization. CADT will begin syncing data from datalayer shortly`,
      success: true,
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

    await Organization.subscribeToOrganization(req.body.orgUid);

    return res.json({
      message: 'Subscribed to organization',
      success: true,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Error subscribing to organization',
      error: error.message,
      success: false,
    });
  }
};

export const deleteOrganization = async (req, res) => {
  const { orgUid } = req.params;

  try {
    const organization = await Organization.findOne({
      where: { orgUid },
      raw: true,
    });

    if (!organization) {
      throw new Error(
        `organization with orgUid ${orgUid} does not exist on this instance`,
      );
    }

    await Organization.deleteAllOrganizationData(orgUid);

    if (organization.isHome) {
      return res.json({
        message:
          'Your home organization was deleted from this instance. cadt will no longer sync its data. (note that this org still exists in datalayer)',
        success: true,
      });
    }

    try {
      // need to call this here because the task that normally unsubscribes cannot if there's no record of the organization
      await Organization.unsubscribeFromOrganizationStores(organization);
    } catch (error) {
      return res.status(400).json({
        message: `Removed all organization records for organization ${orgUid} from cadt, but an error prevented unsubscribing from the organization on datalayer`,
        error: error.message,
        success: false,
      });
    }

    return res.json({
      message: `Removed all organization records for organization ${orgUid} and unsubscribed from organization datalayer stores. cadt will not sync the organizations data from datalayer`,
      success: true,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Error deleting organization',
      error: error.message,
      success: false,
    });
  }
};

export const unsubscribeFromOrganization = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertWalletIsSynced();

    const { orgUid } = req.body;
    const organization = await Organization.findOne({
      where: { orgUid },
      raw: true,
    });

    if (organization?.isHome) {
      throw new Error(
        `you cannot unsubscribe from your home organization. orgUid: ${orgUid}`,
      );
    }

    if (organization) {
      await Organization.update({ subscribed: false }, { where: { orgUid } });
      res.json({
        message:
          'Organization has been marked as unsubscribed. CADT will remove the datalayer subscriptions shortly.',
        success: true,
      });
    } else {
      const { storeIds: ownedStores, success: successGettingOwnedStores } =
        await getOwnedStores();
      if (!successGettingOwnedStores) {
        throw new Error('failed to get owned stores from datalayer');
      }

      if (ownedStores.includes(orgUid)) {
        throw new Error(
          `the chia wallet this instance is connected to owns store ${orgUid}. cannot unsubscribe.`,
        );
      }

      const { storeIds: subscriptions, success: successGettingSubscriptions } =
        await getSubscriptions();
      if (!successGettingSubscriptions) {
        throw new Error('failed to get subscribed stores from datalayer');
      }

      if (!subscriptions.includes(orgUid)) {
        return res.json({
          message: `you are not subscribed to organization ${orgUid}`,
          success: true,
        });
      }

      const orgUidData = await datalayer.getCurrentStoreData(orgUid);
      // misleading "registryId" key name. this is the datamodel version store Id
      const dataModelVersionStoreId = orgUidData?.registryId;
      if (!dataModelVersionStoreId) {
        throw new Error(
          `cannot get data model singleton id from store ${orgUid}. not an organization store or a datalayer error occurred`,
        );
      }

      const instanceDataModelVersion = getDataModelVersion();
      const dataModelStoreData = await datalayer.getCurrentStoreData(
        dataModelVersionStoreId,
      );
      const registryStoreId = dataModelStoreData[instanceDataModelVersion];
      if (!registryStoreId) {
        throw new Error(
          `cannot get registry singleton id from store ${dataModelVersionStoreId}. not an organization store or a datalayer error occurred`,
        );
      }

      await Organization.unsubscribeFromOrganizationStores({
        orgUid,
        dataModelVersionStoreId,
        registryId: registryStoreId,
      });

      res.json({
        message: 'Unsubscribed from organization datalayer stores',
        success: true,
      });
    }
  } catch (error) {
    res.status(400).json({
      message: 'Error unsubscribing from organization datalayer stores',
      error: error.message,
      success: false,
    });
  }
};

export const resyncOrganization = async (req, res) => {
  let transaction;
  try {
    await assertIfReadOnlyMode();
    await assertWalletIsSynced();

    const orgUid = req.body.orgUid;
    transaction = await sequelize.transaction();

    const organization = await Organization.findOne({ where: { orgUid } });
    if (!organization) {
      throw new Error(`organization ${orgUid} does not exist on this instance`);
    }

    if (!organization?.subscribed) {
      throw new Error(
        `you are not subscribed to this organization. please subscribed to resync`,
      );
    }

    await Organization.reconcileOrganization(organization);

    await Organization.update(
      { registryHash: '0' },
      { where: { orgUid }, transaction },
    );

    await Promise.all([
      ...Object.keys(ModelKeys).map(
        async (key) =>
          await ModelKeys[key].destroy({
            where: { orgUid: req.body.orgUid },
            transaction,
          }),
      ),
      Audit.destroy({ where: { orgUid: req.body.orgUid }, transaction }),
    ]);

    await transaction.commit();

    return res.json({
      message: 'Resyncing organization process initiated',
      success: true,
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
      success: true,
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
      success: true,
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

    const rawMetadata = JSON.parse(organization.metadata);
    const cleanedMetadata = {};

    for (const [key, value] of Object.entries(rawMetadata)) {
      const newKey = key.startsWith('meta_') ? key.substring(5) : key;
      cleanedMetadata[newKey] = value;
    }

    return res.json(cleanedMetadata);
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
      success: true,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Error removing mirror for organization',
      error: error.message,
      success: false,
    });
  }
};

export const sync = async (req, res) => {
  try {
    Organization.syncOrganizationMeta();
    return res.json({
      message: 'Syncing All Organizations Metadata',
      success: true,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Cant All Organizations Metadata',
      error: error.message,
      success: false,
    });
  }
};
