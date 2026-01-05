'use strict';

import { Sequelize, Model } from 'sequelize';

import { sequelizeV2 } from '../../database/v2/index.js';

import ModelTypes from './meta-v2.modeltypes.cjs';

export const USER_DELETED_ORGS = 'userDeletedOrgs';

class MetaV2 extends Model {
  static async create(values, options) {
    const result = await super.create(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async bulkCreate(values, options) {
    const result = await super.bulkCreate(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async update(values, options) {
    const result = await super.update(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async upsert(values, options) {
    const result = await super.upsert(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async destroy(options) {
    const result = await super.destroy(options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  /**
   * Gets list of organization UIDs that have been explicitly deleted by the user
   * These organizations should not be re-imported by sync-default-organizations-v2 task
   * @returns {Promise<string[]|undefined>} Array of org UIDs or undefined if none exist
   */
  static async getUserDeletedOrgUids() {
    const deletedOrgsString = await MetaV2.findOne({
      where: { meta_key: USER_DELETED_ORGS },
      raw: true,
    });
    if (!deletedOrgsString?.meta_value) {
      return undefined;
    }
    return JSON.parse(deletedOrgsString.meta_value);
  }

  /**
   * Adds an organization UID to the user-deleted list
   * Prevents sync-default-organizations-v2 from re-importing this organization
   * @param {string} orgUid - The organization UID to add to deleted list
   * @returns {Promise<void>}
   */
  static async addUserDeletedOrgUid(orgUid) {
    const userDeletedOrgUids = await MetaV2.getUserDeletedOrgUids();
    if (!userDeletedOrgUids) {
      await MetaV2.create({
        meta_key: USER_DELETED_ORGS,
        meta_value: JSON.stringify([orgUid]),
      });
      return;
    }

    // Don't add if already in list
    if (userDeletedOrgUids.includes(orgUid)) {
      return;
    }

    userDeletedOrgUids.push(orgUid);
    await MetaV2.update(
      { meta_value: JSON.stringify(userDeletedOrgUids) },
      { where: { meta_key: USER_DELETED_ORGS } },
    );
  }

  /**
   * Removes an organization UID from the user-deleted list
   * Allows sync-default-organizations-v2 to re-import this organization
   * @param {string} orgUid - The organization UID to remove from deleted list
   * @returns {Promise<void>}
   */
  static async removeUserDeletedOrgUid(orgUid) {
    const userDeletedOrgUids = await MetaV2.getUserDeletedOrgUids();
    if (!userDeletedOrgUids) {
      return;
    }
    const revisedOrgUidArr = userDeletedOrgUids.filter(
      (orgUidInArr) => orgUidInArr !== orgUid,
    );
    await MetaV2.update(
      { meta_value: JSON.stringify(revisedOrgUidArr) },
      { where: { meta_key: USER_DELETED_ORGS } },
    );
  }
}

MetaV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'MetaV2',
  tableName: 'meta',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

export default MetaV2;
