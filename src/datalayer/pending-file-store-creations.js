/**
 * Orgs with a file store creation already running, keyed by org uid.
 *
 * Creation is detached from the request that triggers it, so without this every
 * retry of the "try again later" error would mint another store, each costing
 * coins and orphaning the last. Shared between the v1 and v2 file store models
 * because an upgraded org keeps the same file store on both sides
 * (see OrganizationsV2.upgradeFromV1), so a per-model guard would let one
 * request slip past the other.
 */
const pendingFileStoreCreations = new Set();

export default pendingFileStoreCreations;
