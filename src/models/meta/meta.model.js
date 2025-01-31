'use strict';

import Sequelize from 'sequelize';

const { Model } = Sequelize;
import { sequelize } from '../../database';
import ModelTypes from './meta.modeltypes.cjs';

export const USER_DELETED_ORGS = 'userDeletedOrgs';

class Meta extends Model {
  /**
   *
   * @returns {Promise<[string] | undefined>}
   */
  static async getUserDeletedOrgUids() {
    const deletedOrgsString = await Meta.findOne({
      where: { metaKey: USER_DELETED_ORGS },
      raw: true,
    });
    if (!deletedOrgsString?.metaValue) {
      return undefined;
    }
    return JSON.parse(deletedOrgsString.metaValue);
  }

  /**
   * @param orgUid {string}
   * @returns {Promise<void>}
   */
  static async addUserDeletedOrgUid(orgUid) {
    const userDeletedOrgUids = await Meta.getUserDeletedOrgUids();
    if (!userDeletedOrgUids) {
      await Meta.create({
        metaKey: USER_DELETED_ORGS,
        metaValue: JSON.stringify([orgUid]),
      });
      return;
    }

    userDeletedOrgUids.push(orgUid);
    await Meta.update(
      { metaValue: JSON.stringify(userDeletedOrgUids) },
      { where: { metaKey: USER_DELETED_ORGS } },
    );
  }

  /**
   * @param orgUid {string}
   * @returns {Promise<void>}
   */
  static async removeUserDeletedOrgUid(orgUid) {
    const userDeletedOrgUids = await Meta.getUserDeletedOrgUids();
    if (!userDeletedOrgUids) {
      return;
    }
    const revisedOrgUidArr = userDeletedOrgUids.filter(
      (orgUidInArr) => orgUidInArr !== orgUid,
    );
    await Meta.update(
      { metaValue: JSON.stringify(revisedOrgUidArr) },
      { where: { metaKey: USER_DELETED_ORGS } },
    );
  }
}

Meta.init(ModelTypes, {
  sequelize,
  modelName: 'meta',
  freezeTableName: true,
  timestamps: false,
  createdAt: false,
  updatedAt: false,
});

export { Meta };
