import { sequelize } from '../database';
import datalayer from '../datalayer';

import {
  assertHomeOrgExists,
  assertWalletIsSynced,
  assertIfReadOnlyMode,
  assertNoPendingCommits,
  assertOrgDoesNotExist,
  assertStoreIsOwned,
} from '../utils/data-assertions';


import { ModelKeys, Audit, Organization, Staging, Meta } from '../models';
import { getOwnedStores, getSubscriptions, getStoreData as getRawStoreData } from '../datalayer/persistance.js';
import * as simulator from '../datalayer/simulator.js';
import { decodeDataLayerResponse } from '../utils/datalayer-utils.js';
import { getConfig } from '../utils/config-loader.js';
import { logger } from '../config/logger';
import {
  tryAcquireOrgLock,
  releaseOrgLock,
  getOrgLockStatus,
} from '../utils/org-operation-lock.js';
import { hasInProgressCreation } from '../utils/organization-creation-state.js';

const { USE_SIMULATOR } = getConfig().APP;

const isReclaimConflictError = (error) => {
  const message = `${error?.message || ''}`.toLowerCase();
  const code = error?.parent?.code || error?.original?.code || error?.code;

  return (
    code === '40001'
    || code === '40P01'
    || code === '1213'
    || code === 'ER_LOCK_DEADLOCK'
    || code === 'SQLITE_BUSY'
    || message.includes('could not serialize access')
    || message.includes('serialization failure')
    || message.includes('deadlock')
    || message.includes('database is locked')
  );
};

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

    const { sync_status } = await datalayer.getDataLayerStoreSyncStatus(homeOrg.orgUid);

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

/**
 * Get organization creation status
 * Returns the status of any in-progress or recently completed/failed organization creation.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getCreationStatus = async (req, res) => {
  try {
    const status = await Organization.getCreationStatus();
    return res.json({
      ...status,
      success: true,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Error getting organization creation status',
      error: error.message,
      success: false,
    });
  }
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
      if (await hasInProgressCreation(Meta, 'v1')) {
        return res.status(409).json({
          message: 'A V1 organization creation is still in progress (from a previous session). Check status at GET /v1/organizations/creation-status.',
          success: false,
        });
      }

      if (!tryAcquireOrgLock('V1 organization creation')) {
        const lockStatus = getOrgLockStatus();
        return res.status(409).json({
          message: `A home organization operation is already in progress: ${lockStatus.operation}. Please wait for it to complete.`,
          operationStatus: lockStatus,
          success: false,
        });
      }

      const { name } = req.body;
      let icon;

      if (req.file) {
        const buffer = req.file.buffer;
        icon = `data:image/png;base64, ${buffer.toString('base64')}`;
      } else {
        icon = '';
      }

      const dataModelVersion = 'v1';

      Organization.createHomeOrganization(name, icon, dataModelVersion)
        .catch((error) => {
          logger.error(
            `[v1]: Error creating home organization in background: ${error.message}`,
          );
        })
        .finally(() => {
          releaseOrgLock();
        });

      return res.json({
        message:
          'New organization is currently being created. It can take up to 30 mins. Please do not interrupt this process.',
        success: true,
      });
    }
  } catch (error) {
    releaseOrgLock();
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
      const { name, icon } = req.body;

      // Validate name is required
      if (!name) {
        return res.status(400).json({
          message: 'Organization name is required',
          success: false,
        });
      }

      if (await hasInProgressCreation(Meta, 'v1')) {
        return res.status(409).json({
          message: 'A V1 organization creation is still in progress (from a previous session). Check status at GET /v1/organizations/creation-status.',
          success: false,
        });
      }

      if (!tryAcquireOrgLock('V1 organization creation')) {
        const lockStatus = getOrgLockStatus();
        return res.status(409).json({
          message: `A home organization operation is already in progress: ${lockStatus.operation}. Please wait for it to complete.`,
          operationStatus: lockStatus,
          success: false,
        });
      }

      // Icon is optional - use provided value or default to empty string
      // Icon can be any string (URL, base64-encoded data, etc.) or empty
      const iconValue = icon !== undefined && icon !== null ? icon : '';

      const dataModelVersion = 'v1';

      // Call createHomeOrganization asynchronously (don't await)
      // This allows the HTTP request to return immediately while creation happens in background
      Organization.createHomeOrganization(name, iconValue, dataModelVersion)
        .catch((error) => {
          logger.error(
            `[v1]: Error creating home organization in background: ${error.message}`,
          );
        })
        .finally(() => {
          releaseOrgLock();
        });

      return res.json({
        message:
          'New organization is currently being created. It can take up to 30 mins. Please do not interrupt this process.',
        success: true,
      });
    }
  } catch (error) {
    releaseOrgLock();
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

      const instanceDataModelVersion = 'v1';
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

/**
 * Reclaim an existing organization as the home organization.
 * Verifies store ownership and singleton integrity before promoting.
 * @param {Object} req - Express request object with { orgUid } in body
 * @param {Object} res - Express response object
 */
export const reclaimHome = async (req, res) => {
  try {
    await assertIfReadOnlyMode();

    if (!tryAcquireOrgLock('V1 home organization reclaim')) {
      const lockStatus = getOrgLockStatus();
      return res.status(409).json({
        message: `A home organization operation is already in progress: ${lockStatus.operation}. Please wait for it to complete.`,
        operationStatus: lockStatus,
        success: false,
      });
    }

    try {
    await assertWalletIsSynced();
    const { orgUid } = req.body;

    const org = await Organization.findOne({
      where: { orgUid },
      raw: true,
    });

    if (!org) {
      return res.status(404).json({
        message: `Organization ${orgUid} not found.`,
        success: false,
      });
    }

    if (org.isHome) {
      return res.json({
        message: `Organization ${orgUid} is already the home organization.`,
        success: true,
      });
    }

    const existingHome = await Organization.findOne({
      where: { isHome: true },
      raw: true,
    });

    if (existingHome) {
      return res.status(409).json({
        message: `Another organization (${existingHome.orgUid}) is already set as home. Remove or resolve it before reclaiming.`,
        success: false,
      });
    }

    const pendingOrg = await Organization.findOne({
      where: { orgUid: 'PENDING' },
      raw: true,
    });

    if (pendingOrg) {
      return res.status(409).json({
        message: 'An organization creation is currently in progress. Wait for it to complete before reclaiming.',
        success: false,
      });
    }

    await assertStoreIsOwned(orgUid);

    if (!org.registryId) {
      return res.status(400).json({
        message: 'Organization is missing registryId. Organization data may be incomplete.',
        success: false,
      });
    }
    await assertStoreIsOwned(org.registryId);

    if (!org.dataModelVersionStoreId) {
      return res.status(400).json({
        message: 'Organization is missing dataModelVersionStoreId. Organization data may be incomplete.',
        success: false,
      });
    }
    await assertStoreIsOwned(org.dataModelVersionStoreId);

    const nullHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
    if (!org.orgHash || org.orgHash === '0' || org.orgHash === nullHash) {
      return res.status(400).json({
        message: 'Organization orgHash is not populated. Organization creation may not have completed.',
        success: false,
      });
    }

    const singletonData = USE_SIMULATOR
      ? await simulator.getStoreData(org.dataModelVersionStoreId)
      : await getRawStoreData(org.dataModelVersionStoreId);

    if (!singletonData || singletonData instanceof Error || !singletonData.keys_values?.length) {
      return res.status(400).json({
        message: 'Cannot read singleton store data. Organization may be incomplete or blockchain data unavailable.',
        success: false,
      });
    }

    const decodedData = decodeDataLayerResponse(singletonData);
    const singletonMap = decodedData.reduce((obj, current) => {
      obj[current.key] = current.value;
      return obj;
    }, {});

    if (!singletonMap.v1) {
      return res.status(400).json({
        message: 'Singleton store does not contain a v1 key. Not a valid V1 home organization.',
        success: false,
      });
    }

    if (singletonMap.v1 !== org.registryId) {
      return res.status(400).json({
        message: `Singleton v1 registry (${singletonMap.v1}) does not match organization registryId (${org.registryId}). On-chain data is inconsistent with the database.`,
        success: false,
      });
    }

    const transaction = await sequelize.transaction({
      isolationLevel: 'SERIALIZABLE',
    });
    try {
      const lockOptions = sequelize.getDialect() === 'sqlite'
        ? {}
        : { lock: transaction.LOCK.UPDATE };

      const existingHomeTx = await Organization.findOne({
        where: { isHome: true },
        raw: true,
        transaction,
        ...lockOptions,
      });

      if (existingHomeTx) {
        await transaction.rollback();
        if (existingHomeTx.orgUid === orgUid) {
          return res.json({
            message: `Organization ${orgUid} is already the home organization.`,
            success: true,
          });
        }

        return res.status(409).json({
          message: `Another organization (${existingHomeTx.orgUid}) is already set as home. Remove or resolve it before reclaiming.`,
          success: false,
        });
      }

      const [updatedCount] = await Organization.update(
        { isHome: true },
        { where: { orgUid, isHome: false }, transaction },
      );

      if (updatedCount === 0) {
        await transaction.rollback();
        return res.status(409).json({
          message: 'Organization could not be reclaimed because home state changed during request processing. Retry the request.',
          success: false,
        });
      }

      await transaction.commit();
    } catch (txError) {
      await transaction.rollback();
      if (isReclaimConflictError(txError)) {
        return res.status(409).json({
          message: 'Organization could not be reclaimed because a concurrent request updated home state. Retry the request.',
          success: false,
        });
      }
      throw txError;
    }

    logger.info(`[v1]: Organization ${orgUid} reclaimed as home organization`);

    return res.json({
      message: `Organization ${orgUid} has been reclaimed as the home organization.`,
      success: true,
    });
    } finally {
      releaseOrgLock();
    }
  } catch (error) {
    releaseOrgLock();
    logger.error(`[v1]: Error reclaiming home organization: ${error.message}`);
    res.status(400).json({
      message: 'Error reclaiming home organization',
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
