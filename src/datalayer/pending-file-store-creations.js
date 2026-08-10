/**
 * Orgs currently minting a file store, keyed by org uid.
 *
 * Creation is detached from the request that triggers it, so without this every
 * retry of the "try again later" error would mint another store, each costing
 * coins and orphaning the last. Shared between the v1 and v2 file store models
 * because an upgraded org keeps the same file store on both sides
 * (see OrganizationsV2.upgradeFromV1), so a per-model guard would let one
 * request slip past the other.
 *
 * The entry covers only the mint and the write that records the new id, not the
 * subsequent org-store push. A cleared entry therefore does not mean the store
 * has been registered on the org store, only that no further mint is needed.
 */
const pendingFileStoreCreations = new Set();

/**
 * File store ids that have been minted and recorded but not yet registered on
 * the org store, keyed by org uid.
 *
 * Until that push lands the org store has no fileStoreId of its own, and v2 org
 * reconciliation takes the org store as the source of truth and clears the
 * recorded id (see OrganizationsV2.reconcileOrganization). The store exists and
 * is paid for, so the creation flow consults this map before minting and
 * re-adopts the id rather than paying for a replacement.
 *
 * An entry outlives a failed push so a later request can retry the org-store
 * registration instead of minting a replacement. This protection is
 * process-local: a restart while a push is failing leaves the recorded id as
 * the only copy.
 */
const fileStoreIdsPendingOrgStorePush = new Map();

const getFileStoreIdPendingOrgStorePush = (orgUid) =>
  fileStoreIdsPendingOrgStorePush.get(orgUid)?.fileStoreId || null;

const markFileStoreOrgStorePushStarted = (orgUid, fileStoreId) => {
  fileStoreIdsPendingOrgStorePush.set(orgUid, {
    fileStoreId,
    pushInProgress: true,
  });
};

const markFileStoreOrgStorePushFailed = (orgUid, fileStoreId) => {
  const entry = fileStoreIdsPendingOrgStorePush.get(orgUid);
  if (entry && entry.fileStoreId !== fileStoreId) {
    return;
  }

  fileStoreIdsPendingOrgStorePush.set(orgUid, {
    fileStoreId,
    pushInProgress: false,
  });
};

const claimFailedFileStoreOrgStorePush = (orgUid) => {
  const entry = fileStoreIdsPendingOrgStorePush.get(orgUid);
  if (!entry || entry.pushInProgress) {
    return null;
  }

  entry.pushInProgress = true;
  return entry.fileStoreId;
};

const clearFileStoreIdPendingOrgStorePush = (orgUid, fileStoreId = null) => {
  const entry = fileStoreIdsPendingOrgStorePush.get(orgUid);
  if (fileStoreId !== null && entry?.fileStoreId !== fileStoreId) {
    return;
  }

  fileStoreIdsPendingOrgStorePush.delete(orgUid);
};

export {
  claimFailedFileStoreOrgStorePush,
  clearFileStoreIdPendingOrgStorePush,
  fileStoreIdsPendingOrgStorePush,
  getFileStoreIdPendingOrgStorePush,
  markFileStoreOrgStorePushFailed,
  markFileStoreOrgStorePushStarted,
};

export default pendingFileStoreCreations;
