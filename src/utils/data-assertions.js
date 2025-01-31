'use strict';

import { Organization, Unit, Project, Staging, Meta } from '../models';
import datalayer from '../datalayer';
import { formatModelAssociationName } from './model-utils.js';
import { CONFIG } from '../user-config';
import { getOwnedStores } from '../datalayer/persistance.js';

/* deprecated */
export const assertChiaNetworkMatchInConfiguration = async () => {
  /*if (!USE_SIMULATOR) {
    const networkInfo = await datalayer.getActiveNetwork();
    const network = _.get(networkInfo, 'network_name', '');

    if (!network.includes(CHIA_NETWORK)) {
      throw new Error(
        `Your node is on ${network} but your climate warehouse is set to ${CHIA_NETWORK}, please change your config so they match`,
      );
    }
  }*/

  return true;
};

export const assertCanBeGovernanceBody = async () => {
  if (!CONFIG().CADT.IS_GOVERNANCE_BODY) {
    throw new Error(
      'You are not an governance body and can not use this functionality',
    );
  }
};

export const assertIsActiveGovernanceBody = async () => {
  const governanceBodyIsSetUp = Meta.findAll({
    where: { metaKey: 'governanceBodyId' },
  });

  if (!governanceBodyIsSetUp) {
    throw new Error(
      'You are not an governance body and can not use this functionality',
    );
  }
};

export const assertDataLayerAvailable = async () => {
  const isAvailable = await datalayer.dataLayerAvailable();

  if (!isAvailable) {
    throw new Error('Can not establish connection to Chia Datalayer');
  }
};

export const assertIfReadOnlyMode = async () => {
  if (CONFIG().CADT.READ_ONLY) {
    throw new Error('You can not use this API in read-only mode');
  }
};

export const assertNoPendingCommits = async () => {
  if (CONFIG().CADT.USE_SIMULATOR) {
    const pendingCommits = await Staging.findAll({
      where: { commited: true, failedCommit: false },
      raw: true,
    });

    if (pendingCommits.length > 0) {
      throw new Error(
        'You currently have changes pending on the blockchain. Please wait for them to propagate before making more changes',
      );
    }
  } else {
    if (await datalayer.hasUnconfirmedTransactions()) {
      throw new Error(
        'You currently have changes pending on the blockchain. Please wait for them to propagate before making more changes',
      );
    }
  }
};

export const assertWalletIsSynced = async () => {
  if (!CONFIG().CADT.USE_SIMULATOR) {
    if (!(await datalayer.walletIsSynced())) {
      throw new Error(
        'Your wallet is syncing, please wait for it to sync and try again',
      );
    }
  }
};

export const assertWalletIsAvailable = async () => {
  if (!CONFIG().CADT.USE_SIMULATOR) {
    if (!(await datalayer.walletIsAvailable())) {
      throw new Error(
        'Your wallet is not available, please turn it on to continue using CADT',
      );
    }
  }
};

export const assertRecordExistance = async (Model, pk) => {
  const record = await Model.findByPk(pk);
  if (!record) {
    throw new Error(`${Model.name} does not have a record for ${pk}`);
  }

  return record;
};

export const assertHomeOrgExists = async () => {
  const homeOrg = await Organization.getHomeOrg();
  if (!homeOrg) {
    throw new Error(
      `No Home organization found, please create an organization to write data`,
    );
  }

  if (!homeOrg.subscribed) {
    throw new Error(
      `Your Home organization is still confirming, please wait a little longer for it to finish.`,
    );
  }

  return homeOrg;
};

export const assertOrgUidIsValid = async (orgUid, fieldName) => {
  const orgMap = await Organization.getOrgsMap();
  if (!orgMap[orgUid]) {
    throw new Error(
      `The orgUid: ${orgUid}, provided for '${fieldName}' is not in the list of subscribed organizations, either remove it or add it to your organizations and try again`,
    );
  }

  return orgMap;
};

export const assertCsvFileInRequest = (req) => {
  if (!req.file) {
    throw new Error('Cannot find the required csv file in request');
  }

  return req.file;
};

export const assertOrgIsHomeOrg = async (orgUid) => {
  const homeOrg = await Organization.getHomeOrg();

  if (homeOrg.orgUid !== orgUid) {
    throw new Error(
      `Restricted data: can not modify this record with orgUid ${orgUid}`,
    );
  }

  return orgUid;
};

export const assertUnitRecordExists = async (
  warehouseUnitId,
  customMessage,
) => {
  const record = await Unit.findByPk(warehouseUnitId, {
    include: Unit.getAssociatedModels().map((association) => {
      return {
        model: association.model,
        as: formatModelAssociationName(association),
      };
    }),
  });
  if (!record) {
    throw new Error(
      customMessage ||
        `The unit record for the warehouseUnitId: ${warehouseUnitId} does not exist.`,
    );
  }

  return record.dataValues;
};

export const assertStagingTableNotEmpty = async () => {
  const records = await Staging.findAll({ raw: true });

  if (!records || records.length === 0) {
    throw new Error(`Cant commit empty staging table`);
  }
};

export const assertStagingRecordExists = async (stagingId) => {
  const record = await Staging.findOne({ where: { uuid: stagingId } });

  if (!record) {
    throw new Error(
      `The staging record for the staging ID: ${stagingId} does not exist.`,
    );
  }

  return record.dataValues;
};

export const assertProjectRecordExists = async (
  warehouseProjectId,
  customMessage,
) => {
  const record = await Project.findByPk(warehouseProjectId, {
    include: Project.getAssociatedModels().map(
      (association) => association.model,
    ),
  });

  if (!record) {
    throw new Error(
      customMessage ||
        `The project record for the warehouseProjectId: ${warehouseProjectId} does not exist.`,
    );
  }

  return record.dataValues;
};

export const assertStagingTableIsEmpty = async (customMessage) => {
  const count = await Staging.count({ raw: true });

  if (count > 0) {
    throw new Error(customMessage || `Staging table is not empty.`);
  }
};

export const assertActiveOfferFile = async () => {
  const activeOfferFile = await Meta.findOne({
    where: { metaKey: 'activeOffer' },
  });

  if (!activeOfferFile) {
    throw new Error(`There is no active offer pending`);
  }
};

export const assertNoActiveOfferFile = async () => {
  const activeOfferFile = await Meta.findOne({
    where: { metaKey: 'activeOffer' },
  });

  if (activeOfferFile) {
    throw new Error(`There is an active offer pending`);
  }
};

export const assertStoreIsOwned = async (storeId) => {
  const { storeIds, success } = await getOwnedStores();
  if (!success) {
    throw new Error('failed to get owned stores list from datalayer');
  }

  if (!storeIds.includes(storeId)) {
    throw new Error(`store id ${storeId} is not owned by this chia wallet`);
  }
};

export const assertOrgDoesNotExist = async (orgUid) => {
  const result = await Organization.findOne({ where: { orgUid }, raw: true });
  if (result) {
    throw new Error(
      `organization ${orgUid} already exists in the CADT database`,
    );
  }
};
