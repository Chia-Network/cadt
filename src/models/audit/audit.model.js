'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelize, mirrorWrite } from '../../database';
import { AuditMirror } from './audit.model.mirror';
import ModelTypes from './audit.modeltypes.js';
import findDuplicateIssuancesSql from './sql/find-duplicate-issuances.sql.js';
import { Organization } from '../organizations/index.js';
import { waitForSyncRegistriesTransaction } from '../../utils/model-utils.js';
import { clearAuditCountCache } from '../../utils/audit-count-cache.js';

class Audit extends Model {
  static async create(values, options) {
    await mirrorWrite(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await AuditMirror.create(values, mirrorOptions);
    }, options?.mirrorTransaction);
    const result = await super.create(values, options);
    clearAuditCountCache();
    return result;
  }

  static async bulkCreate(values, options) {
    await mirrorWrite(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await AuditMirror.bulkCreate(values, mirrorOptions);
    }, options?.mirrorTransaction);
    const result = await super.bulkCreate(values, options);
    clearAuditCountCache();
    return result;
  }

  static async destroy(options) {
    await mirrorWrite(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await AuditMirror.destroy(mirrorOptions);
    }, options?.mirrorTransaction);
    const result = await super.destroy(options);
    clearAuditCountCache();
    return result;
  }

  static async upsert(values, options) {
    await mirrorWrite(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await AuditMirror.upsert(values, mirrorOptions);
    }, options?.mirrorTransaction);
    const result = await super.upsert(values, options);
    clearAuditCountCache();
    return result;
  }

  static async findConflicts() {
    const [results] = await sequelize.query(findDuplicateIssuancesSql);
    return results;
  }

  static async resetToGeneration(generation, orgUid) {
    const where = {
      generation: { [Sequelize.Op.gt]: generation },
    };

    if (orgUid) {
      where.orgUid = orgUid;
    }

    return await Audit.destroy({ where });
  }

  static async resetToDate(date, includeHomeOrg) {
    const timestampInSeconds = Math.round(new Date(date).valueOf() / 1000);
    const homeOrgUid = Organization.getHomeOrg()?.uid;

    const conditions = [
      sequelize.where(
        sequelize.cast(
          sequelize.col('onChainConfirmationTimeStamp'),
          'UNSIGNED',
        ),
        { [Sequelize.Op.gt]: timestampInSeconds },
      ),
    ];

    if (!includeHomeOrg && homeOrgUid) {
      conditions.push({ orguid: { [Sequelize.Op.ne]: homeOrgUid } });
    }

    return await Audit.destroy({ where: { [Sequelize.Op.and]: conditions } });
  }

  static async resetOrgToDate(date, orgUid) {
    const timestampInSeconds = Math.round(new Date(date).valueOf() / 1000);

    return await Audit.destroy({
      where: {
        orgUid: orgUid,
        [Sequelize.Op.and]: sequelize.where(
          sequelize.cast(
            sequelize.col('onchainConfirmationTimeStamp'),
            'UNSIGNED',
          ),
          { [Sequelize.Op.gt]: timestampInSeconds },
        ),
      },
    });
  }
}

Audit.init(ModelTypes, {
  sequelize,
  modelName: 'audit',
  freezeTableName: true,
  timestamps: true,
  createdAt: true,
  updatedAt: true,
});

Audit.addHook('beforeFind', async () => {
  await waitForSyncRegistriesTransaction();
});

export { Audit };
